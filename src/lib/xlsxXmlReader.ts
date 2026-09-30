import JSZip from 'jszip';
import { indiceColumna, parseCeldasTexto, parseSharedStringsTexto, separarSheetData } from './xlsxCeldasTexto';

// Lector de celdas de un .xlsx/.xlsm — el inverso exacto de xlsxXmlPatcher.ts. Abre el archivo
// como ZIP y extrae el valor "plano" de cada celda de cada hoja, resolviendo las tres formas en que
// OOXML guarda un valor (sharedStrings, inlineStr, valor directo) y detectando las celdas con
// formato de fecha para convertir el número serial de Excel a una fecha legible.
//
// No usa SheetJS por la misma razón que el patcher: aquí solo se necesita leer valores, y hacerlo
// sobre el XML crudo evita cargar toda la maquinaria de una librería completa de hojas de cálculo.
// Las celdas y los sharedStrings se leen por texto (xlsxCeldasTexto.ts, ~70x más rápido que
// DOMParser en hojas gigantes); DOMParser queda solo para las partes chicas del libro.
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export interface CeldaLeida {
  /** Texto tal como se guardó (o el número serial, si `esFecha`) */
  valor: string;
  /** La celda tiene formato de fecha/hora — `valor` es un número serial de Excel */
  esFecha: boolean;
  /** El formato es solo de año ("yyyy") — el serial debe mostrarse como el año, no la fecha completa */
  soloAnio: boolean;
  /** La celda tiene formato de porcentaje — `valor` es la fracción (0.011 se ve como 1.10%) */
  esPorcentaje: boolean;
  /** Decimales que declara el formato, o undefined si no declara ninguno */
  decimales?: number;
  /** Código de formato numérico OOXML (`"E-"00`, `#,##0.00`, …), si la celda no es General/Texto */
  codigoFormato?: string;
  /** La celda es de tipo TEXTO en el XML (`t="s"`/`t="inlineStr"`), no un número que solo parece
   * texto. Un CODLOCAL como "325221" no trae cero a la izquierda y es indistinguible de un número
   * por su forma — sin este dato, el evaluador de fórmulas lo convertía a number y un VLOOKUP de
   * coincidencia exacta contra su TEXT(...) nunca calzaba (número 325221 !== texto "325221"). */
  esTexto: boolean;
}

export interface FusionLeida {
  /** Filas que abarca la fusión (1 = no fusionada verticalmente) */
  filas: number;
  /** Columnas que abarca la fusión (1 = no fusionada horizontalmente) */
  columnas: number;
}

export interface LibroLeido {
  /** Nombres de hoja presentes en el archivo, en el orden del libro */
  hojas: string[];
  /** Nombres definidos globales del libro (`NivelGobierno` -> `Listas!$J$3:$J$5`). Es a donde
   * apuntan casi todas las listas desplegables del formato oficial. Se excluyen los internos de
   * Excel (`_xlnm.Print_Area`) y los de ámbito de hoja. */
  nombresDefinidos: Map<string, string>;
  /** El ZIP ya abierto — lo necesita el lector de imágenes (xlsxImageReader), que trabaja sobre
   * otras partes del paquete (xl/drawings, xl/media) y no sobre las celdas. Se expone para no
   * tener que descomprimir el archivo por segunda vez. */
  zip: JSZip;
  /** Valor de una celda ("H8"), o undefined si está vacía o la hoja no existe */
  celda(hoja: string, ref: string): CeldaLeida | undefined;
  /** Índice de estilo (atributo s=) de una celda, incluso si está vacía — undefined si la celda no
   * existe físicamente en el XML. Lo usa la detección de límites de tabla por formato: dos celdas
   * con el mismo índice comparten bordes/relleno/fuente exactos. */
  estilo(hoja: string, ref: string): number | undefined;
  /** Fusión ANCLADA en esa celda (la esquina superior-izquierda del rango), o undefined si ahí no
   * empieza ninguna. Es lo que permite reconstruir la forma de una tabla: en una jerárquica, la
   * celda de un padre se fusiona verticalmente sobre todas las filas de sus hijos; la fila de
   * título de un grupo se fusiona horizontalmente sobre las primeras columnas. */
  fusion(hoja: string, ref: string): FusionLeida | undefined;
  /** Contenido crudo de `<formula1>` de la lista desplegable que cubre esa celda, o undefined si la
   * celda no tiene una. Puede ser un literal (`"A,B,C"`), un nombre definido (`NivelGobierno`), un
   * rango (`UBIGEO!$A$3:$A$1876`) o un `INDIRECT(...)`. Resolverlo a opciones es trabajo de
   * xlsxListas.ts — aquí solo se extrae. */
  validacionLista(hoja: string, ref: string): string | undefined;
  /** Fórmula de la celda, sin el `=` inicial, o undefined si no tiene */
  formulaDe(hoja: string, ref: string): string | undefined;
  /** Formato de fecha de la celda, aunque esté vacía — para dar forma al resultado de una fórmula */
  formatoFecha(hoja: string, ref: string): { esFecha: boolean; soloAnio: boolean } | undefined;
  /** Decimales que muestra el formato de la celda, o undefined si no los declara */
  decimalesDe(hoja: string, ref: string): number | undefined;
  /** La celda tiene formato de porcentaje, aunque esté vacía — para dar forma al resultado de una
   * fórmula igual que hace `formatoFecha` con las de fecha */
  esPorcentaje(hoja: string, ref: string): boolean;
  /** Código de formato numérico de la celda (`"E-"00`, …), aunque esté vacía */
  codigoFormato(hoja: string, ref: string): string | undefined;
  /** Fila más alta usada en la hoja, o undefined si la hoja no existe — acota un rango de columna
   * completa (`A:M`) a su tamaño real en vez del límite teórico de Excel. */
  filaMaxima(hoja: string): number | undefined;
  /** Estructura interna completa de una hoja ya parseada (todos sus Maps de celdas, fórmulas,
   * fusiones, formatos, estilos y validaciones) — a diferencia del resto de métodos de arriba (una
   * consulta puntual por celda), esto expone TODO de una vez. Existe para serializar el libro hacia
   * un Web Worker (ver frontend/src/lib/excelVivoSnapshot.ts): el worker no puede usar DOMParser
   * (confirmado en el spike de la Fase 0, no está disponible en WorkerGlobalScope), así que el
   * parseo se queda en el hilo principal y solo se transfieren estos datos ya puros. */
  hojaCompleta(hoja: string): HojaParseada | undefined;
  /** Lo necesario para reconstruir el libro dentro del Web Worker SIN parsear las celdas acá: el XML
   * crudo de cada `<sheetData>` (copiarlo a otro hilo es casi gratis — 20 ms para 47 MB — mientras
   * que copiar 1.2M celdas ya parseadas costaba 1.8 s) más lo ya chico y resuelto (fusiones,
   * validaciones, estilos, sharedStrings). Ver frontend/src/lib/excelVivoSnapshot.ts. */
  datosParaWorker(): DatosLibroCrudo;
}

export interface HojaCruda {
  xmlCeldas: string;
  fusiones: Map<string, FusionLeida>;
  validaciones: ValidacionParseada[];
}

export interface DatosLibroCrudo {
  shared: string[];
  numFmtPorEstilo: number[];
  codigoPorNumFmt: Map<number, string>;
  hojas: Map<string, HojaCruda>;
}

// Índice de estilo (atributo s="N" de la celda) -> numFmtId, más el diccionario de formatos
// personalizados (numFmtId >= 164), para poder decidir si una celda es fecha.
function parseEstilos(xml: string | null): { numFmtPorEstilo: number[]; codigoPorNumFmt: Map<number, string> } {
  const codigoPorNumFmt = new Map<number, string>();
  const numFmtPorEstilo: number[] = [];
  if (!xml) return { numFmtPorEstilo, codigoPorNumFmt };

  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  for (const nf of Array.from(doc.getElementsByTagName('numFmt'))) {
    const id = Number(nf.getAttribute('numFmtId'));
    const code = nf.getAttribute('formatCode');
    if (Number.isFinite(id) && code) codigoPorNumFmt.set(id, code);
  }

  // Solo <cellXfs> (estilos aplicados a celdas), no <cellStyleXfs> (estilos con nombre).
  const cellXfs = doc.getElementsByTagName('cellXfs')[0];
  if (cellXfs) {
    for (const xf of Array.from(cellXfs.getElementsByTagName('xf'))) {
      numFmtPorEstilo.push(Number(xf.getAttribute('numFmtId') ?? 0) || 0);
    }
  }
  return { numFmtPorEstilo, codigoPorNumFmt };
}

async function leerMapaHojas(zip: JSZip): Promise<{ rutaPorHoja: Map<string, string>; nombresDefinidos: Map<string, string> }> {
  const wbFile = zip.file('xl/workbook.xml');
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (!wbFile || !relsFile) throw new Error('El archivo no tiene una estructura de libro Excel válida');

  const parser = new DOMParser();
  const wbDoc = parser.parseFromString(await wbFile.async('string'), 'application/xml');
  const relsDoc = parser.parseFromString(await relsFile.async('string'), 'application/xml');

  const ridToTarget = new Map<string, string>();
  for (const rel of Array.from(relsDoc.getElementsByTagName('Relationship'))) {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) ridToTarget.set(id, target);
  }

  const nombreToPath = new Map<string, string>();
  for (const sheetEl of Array.from(wbDoc.getElementsByTagName('sheet'))) {
    const nombre = sheetEl.getAttribute('name');
    const rid = sheetEl.getAttributeNS(R_NS, 'id') || sheetEl.getAttribute('r:id');
    if (!nombre || !rid) continue;
    const target = ridToTarget.get(rid);
    if (!target) continue;
    nombreToPath.set(nombre, target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`);
  }
  return { rutaPorHoja: nombreToPath, nombresDefinidos: parseNombresDefinidos(wbDoc) };
}

export interface HojaParseada {
  celdas: Map<string, CeldaLeida>;
  /** Fórmula de cada celda que la tenga, sin el `=` inicial. La usa el evaluador en vivo
   * (excelFormulaEval) para reproducir lo que el Excel calcularía. */
  formulas: Map<string, string>;
  /** Formato por celda, incluso si está vacía — `celdas` solo trae las que tienen valor, y una
   * celda con fórmula sin calcular está vacía pero conserva su formato. */
  formatos: Map<string, { esFecha: boolean; soloAnio: boolean; esPorcentaje: boolean; decimales?: number; codigo?: string }>;
  /** Estilo de TODA celda presente en el XML, tenga valor o no — base de la detección por formato */
  estilos: Map<string, number>;
  /** Fusiones indexadas por su celda ancla (esquina superior-izquierda del rango) */
  fusiones: Map<string, FusionLeida>;
  /** Listas desplegables de la hoja. Son pocas (decenas), así que se recorren linealmente en vez de
   * indexarse celda por celda: una sola validación puede cubrir miles de celdas (`H35:H1048542`). */
  validaciones: ValidacionParseada[];
  /** Fila más alta que aparece en el XML de la hoja (tenga o no valor). Acota un rango de columna
   * completa (`Padron_web!A:M`) a su tamaño real en vez del límite teórico de Excel (1,048,576). */
  filaMaxima: number;
}

interface Rect {
  c1: number;
  f1: number;
  c2: number;
  f2: number;
}

export interface ValidacionParseada {
  rects: Rect[];
  formula: string;
}

function parseFusiones(doc: Document): Map<string, FusionLeida> {
  const out = new Map<string, FusionLeida>();
  for (const mc of Array.from(doc.getElementsByTagName('mergeCell'))) {
    const ref = mc.getAttribute('ref');
    const m = ref?.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
    if (!m) continue;
    out.set(`${m[1].toUpperCase()}${m[2]}`, {
      filas: Number(m[4]) - Number(m[2]) + 1,
      columnas: indiceColumna(m[3]) - indiceColumna(m[1]) + 1,
    });
  }
  return out;
}

function parseSqref(sqref: string): Rect[] {
  const out: Rect[] = [];
  // Un sqref son varios rangos separados por espacios: "O66:O81 G66:G81", "H8 H18".
  for (const parte of sqref.trim().split(/\s+/)) {
    const m = parte.match(/^\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/i);
    if (!m) continue;
    const c1 = indiceColumna(m[1]);
    const f1 = Number(m[2]);
    out.push({ c1, f1, c2: m[3] ? indiceColumna(m[3]) : c1, f2: m[4] ? Number(m[4]) : f1 });
  }
  return out;
}

// Una validación de datos con `sqref` de varias filas (ej. "D69:D200") guarda UNA sola fórmula de
// texto, escrita en relación a la fila ancla (la primera del rango) — igual que una fórmula normal
// de Excel: al consultar D70 hay que leerla como si dijera C70, no C69 literal. Sin este ajuste, una
// lista en cascada (Departamento->Provincia->Distrito) solo funciona en la fila ancla de su propia
// validación y falla en silencio en cualquier otra fila de una tabla de filas dinámicas — encontrado
// en vivo en "Ubicación geográfica" (Ficha Estandar D69:D70): la fila 2 (Destino) evaluaba la
// referencia a Departamento de la fila 1 (vacía) en vez de la suya propia.
// Solo se desplazan referencias de fila RELATIVA (sin "$" antes del número); una fila absoluta
// (`C$69`) se queda igual, como en Excel real. El lookbehind/lookahead evitan tocar el número de un
// identificador que no es una referencia de celda (ej. un nombre definido como "ZONA5").
const RE_REF_FILA_RELATIVA = /(?<![A-Za-z0-9_])(\$?)([A-Za-z]{1,3})(\$)?(\d{1,7})(?![A-Za-z0-9_])/g;

function desplazarFilasEnFormula(formula: string, deltaFilas: number): string {
  if (deltaFilas === 0) return formula;
  return formula.replace(RE_REF_FILA_RELATIVA, (_m, dolarCol, col, dolarFila, filaStr) => {
    if (dolarFila) return _m; // fila absoluta ($69): no se mueve, igual que en Excel
    return `${dolarCol}${col}${Number(filaStr) + deltaFilas}`;
  });
}

function hijoLocal(el: Element | null | undefined, nombre: string): Element | undefined {
  if (!el) return undefined;
  return Array.from(el.getElementsByTagName('*')).find((h) => h.localName === nombre);
}

// Las listas viven en dos sitios: el bloque `<dataValidations>` normal, y —cuando la lista apunta a
// un rango de OTRA hoja— en la extensión `<x14:dataValidations>` dentro de `<extLst>`. En el formato
// oficial las dos formas conviven, así que hay que leer ambas o se pierden las de UBIGEO y las
// dependientes de Problema-Objetivo.
function parseValidaciones(doc: Document): ValidacionParseada[] {
  const contenedores: Element[] = [];
  for (const el of Array.from(doc.documentElement.children)) {
    if (el.localName === 'dataValidations') contenedores.push(el);
    else if (el.localName === 'extLst') {
      for (const desc of Array.from(el.getElementsByTagName('*'))) {
        if (desc.localName === 'dataValidations') contenedores.push(desc);
      }
    }
  }

  const out: ValidacionParseada[] = [];
  for (const cont of contenedores) {
    for (const dv of Array.from(cont.children)) {
      if (dv.localName !== 'dataValidation' || dv.getAttribute('type') !== 'list') continue;
      // sqref es atributo en la forma normal y elemento hijo `<xm:sqref>` en la x14.
      const sqref = dv.getAttribute('sqref') ?? hijoLocal(dv, 'sqref')?.textContent ?? '';
      const f1 = hijoLocal(dv, 'formula1');
      // En la x14 la fórmula va envuelta en `<xm:f>`; en la normal es el texto directo.
      const formula = (hijoLocal(f1, 'f')?.textContent ?? f1?.textContent ?? '').trim();
      if (!sqref || !formula) continue;
      const rects = parseSqref(sqref);
      if (rects.length > 0) out.push({ rects, formula });
    }
  }
  return out;
}

/** Todo lo de la hoja que NO son celdas (fusiones, validaciones), vía DOMParser sobre el XML sin su
 * `<sheetData>` — unos pocos KB aunque la hoja pese 47 MB. Las celdas se leen aparte, por texto. */
function hojaCrudaDe(xml: string): HojaCruda {
  const { celdas, resto } = separarSheetData(xml);
  const doc = new DOMParser().parseFromString(resto, 'application/xml');
  return { xmlCeldas: celdas, fusiones: parseFusiones(doc), validaciones: parseValidaciones(doc) };
}

// Nombres definidos de ámbito global. Se descartan los internos de Excel (`_xlnm.Print_Area`, que
// además se repiten por hoja) y los de ámbito de hoja, que no son a los que apuntan las listas.
function parseNombresDefinidos(doc: Document): Map<string, string> {
  const out = new Map<string, string>();
  for (const dn of Array.from(doc.getElementsByTagName('definedName'))) {
    const nombre = dn.getAttribute('name');
    if (!nombre || nombre.startsWith('_xlnm.') || dn.getAttribute('localSheetId') !== null) continue;
    const valor = (dn.textContent ?? '').trim();
    if (valor) out.set(nombre.toLowerCase(), valor); // Excel no distingue mayúsculas en los nombres
  }
  return out;
}

/** Encontrado en vivo (2026-09-29): el Excel oficial de la plantilla se descarga directo desde
 * Cloudinary (no proxeado por el backend, a diferencia de la copia 1:1 de cada ejemplo). Un `fetch`
 * sin `signal` no tiene límite de tiempo — si Cloudinary se demora (cache fría del archivo raw) o la
 * conexión se cuelga sin cerrar ni fallar, la promesa nunca resuelve NI rechaza, y la pantalla de
 * carga de la ficha (que espera a `intentoTerminado`, ver useListasExcel.ts) se queda así para
 * siempre, sin ningún error visible. Reproducido: la misma ficha cargó en ~10s por navegación SPA y
 * se quedó colgada más de 30s tras un login recién hecho, sin que el navegador llegara a intentar la
 * descarga. Este timeout convierte ese cuelgue silencioso en un fallo real, que ya cae en el mismo
 * camino de siempre (`useLibro` lo atrapa y degrada a "sin Excel", ver comentario de la interfaz
 * `ExcelVivo` más arriba). */
const TIMEOUT_DESCARGA_LIBRO_MS = 60_000;

/** `fuente` puede ser un data URI (el archivo que el usuario acaba de soltar, leído con FileReader)
 * o una URL http(s) — el Excel de un ejemplo vive en Cloudinary. Se resuelve con `fetch`, que
 * entiende ambas, igual que hace el parcheador. Antes se asumía data URI y se intentaba decodificar
 * la URL como base64, lo que reventaba con "Invalid base64 input, bad content length". */
export async function leerLibroXlsx(fuente: string): Promise<LibroLeido> {
  const { fetchBinarioOrFalla } = await import('./fetchBinario');
  const controlador = new AbortController();
  const timer = setTimeout(
    () => controlador.abort(new Error(`La descarga del Excel tardó más de ${TIMEOUT_DESCARGA_LIBRO_MS / 1000}s — se aborta`)),
    TIMEOUT_DESCARGA_LIBRO_MS,
  );
  let zip: JSZip;
  try {
    const respuesta = await fetchBinarioOrFalla(fuente, { signal: controlador.signal });
    zip = await JSZip.loadAsync(await respuesta.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }

  const shared = parseSharedStringsTexto((await zip.file('xl/sharedStrings.xml')?.async('string')) ?? null);
  const { numFmtPorEstilo, codigoPorNumFmt } = parseEstilos((await zip.file('xl/styles.xml')?.async('string')) ?? null);
  const { rutaPorHoja, nombresDefinidos } = await leerMapaHojas(zip);

  // Las hojas se parsean bajo demanda (y se memorizan): un libro real trae ~24 hojas y la plantilla
  // solo consulta las que tiene mapeadas.
  const cache = new Map<string, HojaParseada>();
  const cacheCruda = new Map<string, HojaCruda>();
  const pendientes = new Map<string, string>(); // hoja -> xml sin parsear
  for (const [nombre, ruta] of rutaPorHoja) {
    const file = zip.file(ruta);
    if (file) pendientes.set(nombre, await file.async('string'));
  }

  function hojaCruda(hoja: string): HojaCruda | undefined {
    let cruda = cacheCruda.get(hoja);
    if (!cruda) {
      const xml = pendientes.get(hoja);
      if (xml === undefined) return undefined;
      cruda = hojaCrudaDe(xml);
      cacheCruda.set(hoja, cruda);
    }
    return cruda;
  }

  function hojaParseada(hoja: string): HojaParseada | undefined {
    let parseada = cache.get(hoja);
    if (!parseada) {
      const cruda = hojaCruda(hoja);
      if (!cruda) return undefined;
      parseada = {
        ...parseCeldasTexto(cruda.xmlCeldas, shared, numFmtPorEstilo, codigoPorNumFmt),
        fusiones: cruda.fusiones,
        validaciones: cruda.validaciones,
      };
      cache.set(hoja, parseada);
    }
    return parseada;
  }

  return {
    hojas: Array.from(rutaPorHoja.keys()),
    nombresDefinidos,
    zip,
    celda(hoja: string, ref: string): CeldaLeida | undefined {
      return hojaParseada(hoja)?.celdas.get(ref);
    },
    estilo(hoja: string, ref: string): number | undefined {
      return hojaParseada(hoja)?.estilos.get(ref);
    },
    fusion(hoja: string, ref: string): FusionLeida | undefined {
      return hojaParseada(hoja)?.fusiones.get(ref);
    },
    formulaDe(hoja: string, ref: string): string | undefined {
      return hojaParseada(hoja)?.formulas.get(ref);
    },
    formatoFecha(hoja: string, ref: string): { esFecha: boolean; soloAnio: boolean } | undefined {
      const f = hojaParseada(hoja)?.formatos.get(ref);
      return f?.esFecha ? f : undefined;
    },
    decimalesDe(hoja: string, ref: string): number | undefined {
      return hojaParseada(hoja)?.formatos.get(ref)?.decimales;
    },
    esPorcentaje(hoja: string, ref: string): boolean {
      return hojaParseada(hoja)?.formatos.get(ref)?.esPorcentaje ?? false;
    },
    codigoFormato(hoja: string, ref: string): string | undefined {
      return hojaParseada(hoja)?.formatos.get(ref)?.codigo;
    },
    filaMaxima(hoja: string): number | undefined {
      return hojaParseada(hoja)?.filaMaxima;
    },
    validacionLista(hoja: string, ref: string): string | undefined {
      const m = ref.match(/^\$?([A-Z]+)\$?(\d+)$/i);
      if (!m) return undefined;
      const col = indiceColumna(m[1]);
      const fila = Number(m[2]);
      for (const v of hojaParseada(hoja)?.validaciones ?? []) {
        const r = v.rects.find((r) => col >= r.c1 && col <= r.c2 && fila >= r.f1 && fila <= r.f2);
        if (r) return desplazarFilasEnFormula(v.formula, fila - r.f1);
      }
      return undefined;
    },
    hojaCompleta(hoja: string): HojaParseada | undefined {
      return hojaParseada(hoja);
    },
    datosParaWorker(): DatosLibroCrudo {
      const hojas = new Map<string, HojaCruda>();
      for (const nombre of rutaPorHoja.keys()) {
        const cruda = hojaCruda(nombre);
        if (cruda) hojas.set(nombre, cruda);
      }
      return { shared, numFmtPorEstilo, codigoPorNumFmt, hojas };
    },
  };
}
