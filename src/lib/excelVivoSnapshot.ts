// Puente entre el LibroLeido real (abierto en el hilo principal) y el Web Worker donde corre el
// cálculo (excelFormulaEval.ts + xlsxListas.ts, 100% puro). El worker nunca descarga el .xlsx:
// recibe este snapshot y reconstruye un objeto con la MISMA interfaz LibroLeido — así el motor de
// fórmulas/listas corre tal cual, sin saber que está del otro lado de un postMessage.
//
// Las celdas viajan como XML CRUDO y el worker las parsea él mismo (xlsxCeldasTexto.ts, sin DOM):
// antes viajaban ya parseadas, y eso obligaba a parsear en el hilo principal TODAS las hojas —
// incluida "Padron_web", 1.2M celdas — y a copiar esa estructura enorme al worker: ~7.6 s de
// bloqueo total en la primera apertura de una ficha (medido 2026-09-26), que congelaba hasta la
// animación de la pantalla de carga.
import { indiceColumna, parseCeldasTexto } from './xlsxCeldasTexto';
import type { FusionLeida, HojaParseada, LibroLeido, ValidacionParseada } from './xlsxXmlReader';

interface HojaCrudaSerializada {
  xmlCeldas: string;
  fusiones: [string, FusionLeida][];
  validaciones: ValidacionParseada[];
}

export interface LibroSerializado {
  hojas: string[];
  /** Pares en vez de Map — más simple de tipar en el mensaje postMessage; se reconstruye al vuelo. */
  nombresDefinidos: [string, string][];
  shared: string[];
  numFmtPorEstilo: number[];
  codigoPorNumFmt: [number, string][];
  porHoja: [string, HojaCrudaSerializada][];
}

export function serializarLibro(libro: LibroLeido): LibroSerializado {
  const datos = libro.datosParaWorker();
  const porHoja: [string, HojaCrudaSerializada][] = [];
  for (const [hoja, cruda] of datos.hojas) {
    porHoja.push([hoja, { xmlCeldas: cruda.xmlCeldas, fusiones: Array.from(cruda.fusiones), validaciones: cruda.validaciones }]);
  }
  return {
    hojas: libro.hojas,
    nombresDefinidos: Array.from(libro.nombresDefinidos.entries()),
    shared: datos.shared,
    numFmtPorEstilo: datos.numFmtPorEstilo,
    codigoPorNumFmt: Array.from(datos.codigoPorNumFmt),
    porHoja,
  };
}

/** Reconstruye un LibroLeido a partir del snapshot, con las mismas firmas que xlsxXmlReader.ts
 * para que catalogoDeListas()/calcularCelda() no noten la diferencia. Cada hoja se parsea recién la
 * primera vez que se la consulta (y se memoriza). `zip` queda como placeholder nunca invocado: solo
 * lo usa xlsxImageReader (imágenes embebidas), que no corre en el worker. `datosParaWorker` no
 * aplica acá (el worker no vuelve a serializar) y lanza si alguien lo llamara. */
export function libroDesdeSnapshot(snapshot: LibroSerializado): LibroLeido {
  const crudas = new Map<string, HojaCrudaSerializada>(snapshot.porHoja);
  const nombresDefinidos = new Map<string, string>(snapshot.nombresDefinidos);
  const codigoPorNumFmt = new Map<number, string>(snapshot.codigoPorNumFmt);
  const cache = new Map<string, HojaParseada>();

  function hoja(nombre: string): HojaParseada | undefined {
    let parseada = cache.get(nombre);
    if (!parseada) {
      const cruda = crudas.get(nombre);
      if (!cruda) return undefined;
      parseada = {
        ...parseCeldasTexto(cruda.xmlCeldas, snapshot.shared, snapshot.numFmtPorEstilo, codigoPorNumFmt),
        fusiones: new Map(cruda.fusiones),
        validaciones: cruda.validaciones,
      };
      cache.set(nombre, parseada);
    }
    return parseada;
  }

  return {
    hojas: snapshot.hojas,
    nombresDefinidos,
    zip: null as unknown as LibroLeido['zip'],
    celda: (h, ref) => hoja(h)?.celdas.get(ref),
    estilo: (h, ref) => hoja(h)?.estilos.get(ref),
    fusion: (h, ref) => hoja(h)?.fusiones.get(ref),
    formulaDe: (h, ref) => hoja(h)?.formulas.get(ref),
    formatoFecha: (h, ref) => {
      const f = hoja(h)?.formatos.get(ref);
      return f?.esFecha ? f : undefined;
    },
    decimalesDe: (h, ref) => hoja(h)?.formatos.get(ref)?.decimales,
    esPorcentaje: (h, ref) => hoja(h)?.formatos.get(ref)?.esPorcentaje ?? false,
    codigoFormato: (h, ref) => hoja(h)?.formatos.get(ref)?.codigo,
    filaMaxima: (h) => hoja(h)?.filaMaxima,
    validacionLista: (h, ref) => {
      const m = ref.match(/^\$?([A-Z]+)\$?(\d+)$/i);
      if (!m) return undefined;
      const col = indiceColumna(m[1]);
      const fila = Number(m[2]);
      for (const v of hoja(h)?.validaciones ?? []) {
        if (v.rects.some((r) => col >= r.c1 && col <= r.c2 && fila >= r.f1 && fila <= r.f2)) return v.formula;
      }
      return undefined;
    },
    hojaCompleta: (h) => hoja(h),
    datosParaWorker: () => {
      throw new Error('datosParaWorker() no aplica a un libro reconstruido dentro del worker');
    },
  };
}
