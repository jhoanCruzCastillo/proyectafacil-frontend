import { leerLibroXlsx, type CeldaLeida, type LibroLeido } from './xlsxXmlReader';
import { aFechaISO, aAnio, textoABooleano } from './conversionesExcel';
import type { FilaDinamica } from './tableRowHelpers';
import type { Plantilla, Campo, Seccion, ConfigTabla, ColumnaTabla, TipoCampo, TipoColumna } from '@/types';

// Volcado de datos Excel -> valores de un ejemplo: el inverso de excelWriter.ts. Recorre la
// plantilla igual que `insertarValoresEnExcel`, pero en vez de escribir cada campo en su celda de
// `captura`, lee esa misma celda y arma el Record<identificador, valor> del ejemplo.
//
// Alcance actual (por fases, pedido del usuario):
//  - Campos simples: mapeo 1:1 celda -> valor.
//  - Tablas SIMPLES (filas planas, columnas fijas, sin agrupador): se leen las `filas_base`
//    declaradas y, si el Excel tiene filas insertadas debajo, se siguen leyendo mientras el
//    FORMATO de la fila coincida con el de las filas base (ver esDeLaMismaTabla) — el estilo de
//    celda (bordes+relleno+fuente) delimita la tabla igual que a simple vista. Ese crecimiento
//    desplaza hacia abajo todo lo que sigue en la misma hoja, espejo de LibroEdits.desplazamientoPara.
//  - Tablas jerárquicas / con agrupador / con columnas dinámicas: fuera de alcance todavía.
//
// Regla de no-destrucción, simétrica a la del writer ("celda vacía no toca el Excel"): una celda
// vacía en el Excel NO borra el valor que el ejemplo ya tuviera — en tablas se aplica CELDA POR
// CELDA (el dato del Excel gana solo donde existe; el resto de la fila conserva lo actual).

// Convierte lo leído del Excel al formato que guarda el campo según su tipo. Devuelve null cuando
// el contenido no es utilizable para ese tipo (se omite el campo en vez de guardar algo inválido).
// Fechas y años NO se convierten aquí: pasan siempre por lib/conversionesExcel.ts, que es el punto
// único donde vive la aritmética de seriales de Excel.
function valorParaCampo(campo: Campo, celda: CeldaLeida): string | null {
  const texto = celda.valor.trim();
  if (texto === '') return null;

  // Celda con formato de solo año ("yyyy"): interesa el año, no la fecha completa que codifica el
  // serial. Aplica sin importar cómo esté tipado el campo — el formato de la celda manda.
  if (celda.soloAnio) return aAnio(celda.valor, true);
  if (celda.esFecha) return aFechaISO(celda.valor, true);

  switch (campo.tipo) {
    case 'booleano':
      return textoABooleano(texto, campo.etiquetasBooleano);
    case 'fecha':
      return aFechaISO(celda.valor, false) ?? texto;
    case 'numero':
    case 'decimal': {
      const n = Number(texto.replace(/\s/g, '').replace(',', '.'));
      return Number.isFinite(n) ? String(n) : texto; // texto no numérico se conserva tal cual
    }
    // 'mapa_coordenadas' cae aquí a propósito: por ahora las coordenadas se tratan como texto
    // simple (decisión del usuario), sin intentar parsearlas a {lat,lng}.
    default:
      return celda.valor; // texto_corto / texto_largo / catálogos: sin recortar, el original manda
  }
}

// Variante para celdas de tabla — mismos criterios, pero el tipo viene de la columna.
function valorParaColumna(tipo: TipoColumna, celda: CeldaLeida): string {
  const texto = celda.valor.trim();
  if (texto === '') return '';

  if (celda.soloAnio) return aAnio(celda.valor, true) ?? '';
  if (celda.esFecha) return aFechaISO(celda.valor, true) ?? '';

  switch (tipo) {
    case 'booleano':
      return textoABooleano(texto) ?? '';
    case 'fecha':
      return aFechaISO(celda.valor, false) ?? texto;
    case 'numero':
    case 'decimal': {
      const n = Number(texto.replace(/\s/g, '').replace(',', '.'));
      return Number.isFinite(n) ? String(n) : texto;
    }
    default:
      return celda.valor;
  }
}

// --- Tablas simples ---

// "Simple" = el único subtipo soportado por ahora: filas planas, columnas fijas, sin agrupador y
// sin columna dinámica, con captura completa (fila inicial + filas base + columnas mapeadas).
export function esTablaSimpleLegible(campo: Campo): boolean {
  if (campo.tipo !== 'tabla' || !campo.configTabla) return false;
  const c = campo.configTabla;
  return (
    c.subtipo === 'filas_dinamicas' &&
    !c.agrupador &&
    !c.columnaDinamicaId &&
    typeof c.captura?.filaInicial === 'number' &&
    typeof c.captura?.filasBase === 'number' &&
    c.captura.filasBase > 0 &&
    c.columnas.some((col) => col.columnaExcel)
  );
}

// Tope de seguridad para la detección de filas insertadas: si el formato "no termina nunca"
// (plantillas con miles de filas pre-formateadas), no leemos el libro entero.
const MAX_FILAS_EXTRA = 300;

interface FilaLeida {
  valores: FilaDinamica;
  tieneDatos: boolean;
}

function leerFilaTabla(libro: LibroLeido, hoja: string, config: ConfigTabla, filaFisica: number): FilaLeida {
  const valores: FilaDinamica = {};
  let tieneDatos = false;
  for (const col of config.columnas) {
    if (!col.columnaExcel) { valores[col.id] = ''; continue; }
    const celda = libro.celda(hoja, `${col.columnaExcel}${filaFisica}`);
    const v = celda ? valorParaColumna(col.tipo, celda) : '';
    valores[col.id] = v;
    if (v !== '') tieneDatos = true;
  }
  return { valores, tieneDatos };
}

// ¿La fila física pertenece a la misma tabla que las filas base? La respuesta la da el FORMATO:
// cada celda con dato debe usar un estilo ya visto en su columna dentro de las filas base (el
// índice de estilo encapsula bordes/relleno/fuente). La fila que sigue a la tabla (una "Nota:", el
// título de la siguiente subsección) rompe el patrón y corta la lectura. Verificado contra el
// Excel real: las filas de datos comparten estilos por columna; la Nota usa otros.
function esDeLaMismaTabla(
  libro: LibroLeido,
  hoja: string,
  cols: ColumnaTabla[],
  filaFisica: number,
  estilosBase: Map<string, Set<number>>,
): boolean {
  let coincidencias = 0;
  for (const col of cols) {
    if (!col.columnaExcel) continue;
    const estilo = libro.estilo(hoja, `${col.columnaExcel}${filaFisica}`);
    const base = estilosBase.get(col.id);
    if (estilo === undefined || !base || base.size === 0) return false;
    if (!base.has(estilo)) return false;
    coincidencias++;
  }
  return coincidencias > 0;
}

interface TablaLeida {
  filas: FilaDinamica[];
  filasConDatos: number;
  filasExtra: number;
}

function leerTablaSimple(libro: LibroLeido, hoja: string, config: ConfigTabla, filaFisicaInicial: number): TablaLeida {
  const filasBase = config.captura!.filasBase!;
  const filas: FilaDinamica[] = [];
  let filasConDatos = 0;

  // Estilos por columna de las filas base — el "patrón visual" contra el que se comparan las
  // filas siguientes para decidir si son parte de la tabla.
  const estilosBase = new Map<string, Set<number>>();
  for (const col of config.columnas) {
    if (!col.columnaExcel) continue;
    const set = new Set<number>();
    for (let i = 0; i < filasBase; i++) {
      const estilo = libro.estilo(hoja, `${col.columnaExcel}${filaFisicaInicial + i}`);
      if (estilo !== undefined) set.add(estilo);
    }
    estilosBase.set(col.id, set);
  }

  for (let i = 0; i < filasBase; i++) {
    const fila = leerFilaTabla(libro, hoja, config, filaFisicaInicial + i);
    filas.push(fila.valores);
    if (fila.tieneDatos) filasConDatos++;
  }

  // Filas insertadas más allá de la base: siguen el mismo formato Y traen algún dato. Una fila
  // vacía con el formato correcto también corta — no hay forma de distinguirla del relleno
  // pre-formateado de la plantilla, y una tabla real llenada no deja huecos intermedios.
  let filasExtra = 0;
  while (filasExtra < MAX_FILAS_EXTRA) {
    const filaFisica = filaFisicaInicial + filasBase + filasExtra;
    if (!esDeLaMismaTabla(libro, hoja, config.columnas, filaFisica, estilosBase)) break;
    const fila = leerFilaTabla(libro, hoja, config, filaFisica);
    if (!fila.tieneDatos) break;
    filas.push(fila.valores);
    filasConDatos++;
    filasExtra++;
  }

  return { filas, filasConDatos, filasExtra };
}

// Fusión celda por celda con las filas que el ejemplo ya tenía: el dato del Excel gana solo donde
// existe; una celda vacía del Excel conserva el valor actual (ej. los N° 1..5 que vienen de la
// estructura base, o texto que el usuario ya había tipeado en el editor).
function fusionarFilas(actuales: FilaDinamica[], leidas: FilaDinamica[], config: ConfigTabla): FilaDinamica[] {
  const total = Math.max(actuales.length, leidas.length);
  const out: FilaDinamica[] = [];
  for (let i = 0; i < total; i++) {
    const actual = actuales[i] ?? {};
    const leida = leidas[i];
    if (!leida) { out.push(actual); continue; }
    const fila: FilaDinamica = {};
    for (const col of config.columnas) {
      const nuevo = leida[col.id];
      fila[col.id] = typeof nuevo === 'string' && nuevo !== '' ? nuevo : (actual[col.id] ?? '');
    }
    out.push(fila);
  }
  return out;
}

function parseFilasActuales(raw: string | undefined): FilaDinamica[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) && (p.length === 0 || (!('value' in p[0]) && !('filas' in p[0])))) return p as FilaDinamica[];
  } catch { /* el valor actual no era JSON de filas — se ignora */ }
  return [];
}

// --- Recorrido del documento ---

export interface OpcionesVolcado {
  /** Leer campos simples (texto, número, fecha, booleano…) */
  camposSimples: boolean;
  /** Leer tablas simples (filas planas / columnas fijas / sin agrupador) */
  tablasSimples: boolean;
  /** Ids de las secciones a incluir — las demás no se tocan */
  seccionesIds: Set<string>;
  /** Valores actuales del ejemplo — base de la fusión celda a celda en tablas */
  valoresActuales: Record<string, string>;
}

export interface ResultadoVolcado {
  /** Valores listos para fusionar con los del ejemplo, por identificador de campo */
  valores: Record<string, string>;
  /** Campos simples que sí traían dato en el Excel */
  camposLeidos: number;
  /** Campos simples cuya celda estaba vacía — no se tocan */
  camposVacios: number;
  /** Tablas simples leídas (con al menos una celda con dato) */
  tablasLeidas: number;
  /** Filas con datos encontradas entre todas las tablas leídas */
  filasTablaLeidas: number;
  /** Filas insertadas detectadas más allá de las filas base (crecimiento) */
  filasExtraDetectadas: number;
  /** Campos tabla fuera del alcance actual (jerárquicas, agrupadores, columnas dinámicas) */
  tablasOmitidas: number;
  /** Hojas que la plantilla declara pero el Excel no tiene (nombres cambiados, otro archivo) */
  hojasFaltantes: string[];
}

const TIPOS_TABLA: TipoCampo[] = ['tabla', 'tabla_jerarquica'];

interface Tarea { seccion: Seccion; campo: Campo }

export async function leerValoresDeExcel(
  dataUrl: string,
  plantilla: Plantilla,
  opciones?: Partial<OpcionesVolcado>,
): Promise<ResultadoVolcado> {
  const ops: OpcionesVolcado = {
    camposSimples: opciones?.camposSimples ?? true,
    tablasSimples: opciones?.tablasSimples ?? false,
    seccionesIds: opciones?.seccionesIds ?? new Set(plantilla.secciones.map((s) => s.id)),
    valoresActuales: opciones?.valoresActuales ?? {},
  };

  const libro = await leerLibroXlsx(dataUrl);
  const hojasDelLibro = new Set(libro.hojas);

  const resultado: ResultadoVolcado = {
    valores: {},
    camposLeidos: 0,
    camposVacios: 0,
    tablasLeidas: 0,
    filasTablaLeidas: 0,
    filasExtraDetectadas: 0,
    tablasOmitidas: 0,
    hojasFaltantes: [],
  };

  // Tareas de las secciones seleccionadas, agrupadas por hoja: las tablas de una hoja se procesan
  // primero y en orden (para conocer los crecimientos), después los campos simples con su
  // desplazamiento aplicado — espejo de las dos pasadas de insertarValoresEnExcel.
  const tareasPorHoja = new Map<string, Tarea[]>();
  const hojasFaltantes = new Set<string>();
  for (const seccion of plantilla.secciones) {
    if (!ops.seccionesIds.has(seccion.id)) continue;
    if (!seccion.hoja) continue;
    if (!hojasDelLibro.has(seccion.hoja)) { hojasFaltantes.add(seccion.hoja); continue; }
    const lista = tareasPorHoja.get(seccion.hoja) ?? [];
    for (const sub of seccion.subsecciones) for (const campo of sub.campos) lista.push({ seccion, campo });
    tareasPorHoja.set(seccion.hoja, lista);
  }
  resultado.hojasFaltantes = Array.from(hojasFaltantes);

  for (const [hoja, tareas] of tareasPorHoja) {
    // Crecimientos detectados en esta hoja, en coordenadas de la plantilla original:
    // todo lo que esté debajo de una tabla crecida se lee más abajo de donde la estructura dice.
    const crecimientos: { despuesDeFila: number; cantidad: number }[] = [];
    const shift = (filaOriginal: number) =>
      crecimientos.reduce((total, c) => (c.despuesDeFila < filaOriginal ? total + c.cantidad : total), 0);

    // 1) Tablas, en orden de aparición en la hoja
    const tablas = tareas
      .filter((t) => TIPOS_TABLA.includes(t.campo.tipo))
      .sort((a, b) => (a.campo.configTabla?.captura?.filaInicial ?? 0) - (b.campo.configTabla?.captura?.filaInicial ?? 0));

    for (const { campo } of tablas) {
      if (!ops.tablasSimples || !esTablaSimpleLegible(campo)) { resultado.tablasOmitidas++; continue; }
      const config = campo.configTabla!;
      const filaOriginal = config.captura!.filaInicial!;
      const lectura = leerTablaSimple(libro, hoja, config, filaOriginal + shift(filaOriginal));

      if (lectura.filasExtra > 0) {
        crecimientos.push({ despuesDeFila: filaOriginal + config.captura!.filasBase! - 1, cantidad: lectura.filasExtra });
        resultado.filasExtraDetectadas += lectura.filasExtra;
      }
      if (lectura.filasConDatos === 0) continue; // tabla vacía en el Excel: no tocar nada

      const actuales = parseFilasActuales(ops.valoresActuales[campo.identificador] ?? campo.valorEjemplo);
      resultado.valores[campo.identificador] = JSON.stringify(fusionarFilas(actuales, lectura.filas, config));
      resultado.tablasLeidas++;
      resultado.filasTablaLeidas += lectura.filasConDatos;
    }

    // 2) Campos simples, con el desplazamiento acumulado de las tablas crecidas de arriba
    if (!ops.camposSimples) continue;
    for (const { campo } of tareas) {
      if (TIPOS_TABLA.includes(campo.tipo)) continue;
      // Un campo calculado guarda su fórmula (ej. "=6.01.10-6.01.01"), no un dato tecleado:
      // sobrescribirlo con el número que Excel dejó cacheado rompería el cálculo.
      if (campo.tipo === 'calculado' || !campo.editable) continue;
      if (!campo.captura?.columna || !campo.captura.fila) continue;

      const fila = campo.captura.fila + shift(campo.captura.fila);
      const celda = libro.celda(hoja, `${campo.captura.columna}${fila}`);
      if (!celda) { resultado.camposVacios++; continue; }

      const valor = valorParaCampo(campo, celda);
      if (valor === null) { resultado.camposVacios++; continue; }

      resultado.valores[campo.identificador] = valor;
      resultado.camposLeidos++;
    }
  }

  return resultado;
}
