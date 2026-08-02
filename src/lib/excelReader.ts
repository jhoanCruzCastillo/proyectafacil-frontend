import { leerLibroXlsx, type CeldaLeida, type LibroLeido } from './xlsxXmlReader';
import { aFechaISO, aAnio, textoABooleano } from './conversionesExcel';
import { esCeldaPartida, esJerarquica, getPeriodos, type FilaDinamica, type GrupoFilas, type TreeNode } from './tableRowHelpers';
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
// CELDA (el dato del Excel gana solo donde existe; el resto de la fila conserva lo actual), y en
// columnas con subcolumnas (4.8) PARTE POR PARTE.

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

// --- Tablas ---

// Una tabla es legible si la estructura declara DÓNDE está en el Excel: fila inicial, cuántas filas
// reservó la plantilla oficial (`filasBase`) y al menos una columna mapeada. Eso alcanza para todos
// los subtipos —planas, agrupadas, jerárquicas, con columnas dinámicas—: la estructura ya es el
// mapa. La contrapartida deliberada es que solo se leen las `filasBase` declaradas; si el Excel
// tiene la tabla crecida, las filas de más no se leen (decisión del usuario: una cantidad fija de
// datos ya es ayuda suficiente). La excepción es la tabla plana simple, donde la detección de
// crecimiento por formato ya estaba hecha y probada, así que se conserva.
export function esTablaLegible(campo: Campo): boolean {
  if (campo.tipo !== 'tabla' && campo.tipo !== 'tabla_jerarquica') return false;
  const c = campo.configTabla;
  if (!c) return false;
  return (
    typeof c.captura?.filaInicial === 'number' &&
    typeof c.captura?.filasBase === 'number' &&
    c.captura.filasBase > 0 &&
    c.columnas.some((col) => columnasExcelDe(col).length > 0)
  );
}

// Tabla plana sin agrupador ni columnas dinámicas: la única que además detecta filas insertadas.
function esTablaPlanaSimple(config: ConfigTabla): boolean {
  return config.subtipo === 'filas_dinamicas' && !config.agrupador && !config.columnaDinamicaId;
}

// Tope de seguridad para la detección de filas insertadas: si el formato "no termina nunca"
// (plantillas con miles de filas pre-formateadas), no leemos el libro entero.
const MAX_FILAS_EXTRA = 300;

interface FilaLeida {
  valores: FilaDinamica;
  tieneDatos: boolean;
}

// Aritmética de letras de columna (A, B, ..., Z, AA...) — misma que en excelWriter.addCols.
function sumarColumnas(letra: string, delta: number): string {
  let n = 0;
  for (const ch of letra.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  n += delta;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out || letra;
}

// Letras de columna Excel que ocupa una columna lógica. Con subcolumnas (4.8) son varias — leer
// solo la del padre perdería las otras partes y las machacaría al fusionar.
function columnasExcelDe(col: ColumnaTabla): string[] {
  if (col.subcolumnas?.length) {
    return col.subcolumnas.map((s) => s.columnaExcel).filter((c): c is string => Boolean(c));
  }
  return col.columnaExcel ? [col.columnaExcel] : [];
}

// Lee una columna partida (4.8): cada parte desde su propia celda. La FORMA del resultado la decide
// el dato, igual que en el documento — si solo la primera parte trae algo, el Excel tenía la celda
// fusionada y devolvemos texto plano; si hay dato en otra parte, estaba partida y devolvemos objeto.
function leerCeldaPartida(libro: LibroLeido, hoja: string, col: ColumnaTabla, filaFisica: number): string | Record<string, string> {
  const partes: Record<string, string> = {};
  let algunaExtra = false;
  col.subcolumnas!.forEach((sub, i) => {
    const celda = sub.columnaExcel ? libro.celda(hoja, `${sub.columnaExcel}${filaFisica}`) : undefined;
    const v = celda ? valorParaColumna(sub.tipo, celda) : '';
    partes[sub.id] = v;
    if (i > 0 && v !== '') algunaExtra = true;
  });
  if (algunaExtra) return partes;
  return partes[col.subcolumnas![0].id] ?? '';
}

// Columna que se repite por período: N celdas horizontales desde `columnaExcel`, cada una del ancho
// declarado — espejo exacto del bucle de writeFilaColumnas.
function leerCeldasPeriodos(
  libro: LibroLeido,
  hoja: string,
  col: ColumnaTabla,
  filaFisica: number,
  periodos: string[],
): string[] {
  const ancho = col.abarcaColumnasExcel ?? 1;
  return periodos.map((_, i) => {
    const letra = sumarColumnas(col.columnaExcel!, i * ancho);
    const celda = libro.celda(hoja, `${letra}${filaFisica}`);
    return celda ? valorParaColumna(col.tipo, celda) : '';
  });
}

function leerFilaTabla(
  libro: LibroLeido,
  hoja: string,
  config: ConfigTabla,
  filaFisica: number,
  periodos: string[] = [],
): FilaLeida {
  const valores: FilaDinamica = {};
  let tieneDatos = false;
  for (const col of config.columnas) {
    if (col.id === config.columnaDinamicaId && col.columnaExcel && periodos.length > 0) {
      const arr = leerCeldasPeriodos(libro, hoja, col, filaFisica, periodos);
      valores[col.id] = arr;
      if (arr.some((v) => v !== '')) tieneDatos = true;
      continue;
    }
    if (col.subcolumnas?.length) {
      const v = leerCeldaPartida(libro, hoja, col, filaFisica);
      valores[col.id] = v;
      if (typeof v === 'string' ? v !== '' : Object.values(v).some((p) => p !== '')) tieneDatos = true;
      continue;
    }
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
    // Una columna partida aporta el estilo de su PRIMERA parte: las demás pueden estar fusionadas
    // en unas filas y separadas en otras, así que su estilo no es un patrón estable.
    const letra = columnasExcelDe(col)[0];
    if (!letra) continue;
    const estilo = libro.estilo(hoja, `${letra}${filaFisica}`);
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

function leerTablaSimple(
  libro: LibroLeido,
  hoja: string,
  config: ConfigTabla,
  filaFisicaInicial: number,
  periodos: string[] = [],
  detectarCrecimiento = true,
): TablaLeida {
  const filasBase = config.captura!.filasBase!;
  const filas: FilaDinamica[] = [];
  let filasConDatos = 0;

  // Estilos por columna de las filas base — el "patrón visual" contra el que se comparan las
  // filas siguientes para decidir si son parte de la tabla.
  const estilosBase = new Map<string, Set<number>>();
  for (const col of config.columnas) {
    const letra = columnasExcelDe(col)[0];
    if (!letra) continue;
    const set = new Set<number>();
    for (let i = 0; i < filasBase; i++) {
      const estilo = libro.estilo(hoja, `${letra}${filaFisicaInicial + i}`);
      if (estilo !== undefined) set.add(estilo);
    }
    estilosBase.set(col.id, set);
  }

  for (let i = 0; i < filasBase; i++) {
    const fila = leerFilaTabla(libro, hoja, config, filaFisicaInicial + i, periodos);
    filas.push(fila.valores);
    if (fila.tieneDatos) filasConDatos++;
  }

  // Filas insertadas más allá de la base: siguen el mismo formato Y traen algún dato. Una fila
  // vacía con el formato correcto también corta — no hay forma de distinguirla del relleno
  // pre-formateado de la plantilla, y una tabla real llenada no deja huecos intermedios.
  let filasExtra = 0;
  while (detectarCrecimiento && filasExtra < MAX_FILAS_EXTRA) {
    const filaFisica = filaFisicaInicial + filasBase + filasExtra;
    if (!esDeLaMismaTabla(libro, hoja, config.columnas, filaFisica, estilosBase)) break;
    const fila = leerFilaTabla(libro, hoja, config, filaFisica, periodos);
    if (!fila.tieneDatos) break;
    filas.push(fila.valores);
    filasConDatos++;
    filasExtra++;
  }

  return { filas, filasConDatos, filasExtra };
}

// --- Tablas agrupadas (config.agrupador) ---

// Ancho físico en columnas de Excel que ocupan las primeras `n` columnas lógicas — espejo de
// anchoFisicoPrimerasColumnas en excelWriter, y con eso sabemos cuánto abarca la fila de título.
function anchoFisico(config: ConfigTabla, n: number, periodos: string[]): number {
  let total = 0;
  for (let i = 0; i < n && i < config.columnas.length; i++) {
    const col = config.columnas[i];
    const ancho = col.abarcaColumnasExcel ?? 1;
    total += col.id === config.columnaDinamicaId && periodos.length > 0 ? periodos.length * ancho : ancho;
  }
  return total;
}

interface TablaAgrupadaLeida {
  grupos: GrupoFilas[];
  filasConDatos: number;
}

// La fila de TÍTULO de un grupo se reconoce por su fusión horizontal: el escritor la fusiona sobre
// las primeras `agrupadorAbarcaColumnas` columnas, así que en el Excel esa celda arranca un rango
// de varias columnas. Una fila de datos normal no lo hace. Leer la fusión real (y no adivinar por
// "las demás celdas están vacías") es lo que hace determinista la separación grupo/dato.
function leerTablaAgrupada(
  libro: LibroLeido,
  hoja: string,
  config: ConfigTabla,
  filaFisicaInicial: number,
  periodos: string[],
): TablaAgrupadaLeida {
  const filasBase = config.captura!.filasBase!;
  const columnaInicial = config.captura?.columnaInicial ?? config.columnas[0]?.columnaExcel;
  const abarcaCabeceras = Math.min(config.agrupadorAbarcaColumnas ?? config.columnas.length, config.columnas.length);
  const minAncho = Math.max(anchoFisico(config, abarcaCabeceras, periodos), 2);

  const grupos: GrupoFilas[] = [];
  let filasConDatos = 0;

  for (let i = 0; i < filasBase; i++) {
    const row = filaFisicaInicial + i;
    const fusion = columnaInicial ? libro.fusion(hoja, `${columnaInicial}${row}`) : undefined;
    const esTitulo = Boolean(fusion && fusion.columnas >= minAncho);

    if (esTitulo) {
      const celda = libro.celda(hoja, `${columnaInicial}${row}`);
      const titulo = celda ? celda.valor : '';
      // La fila de título también puede traer valores propios a la derecha de la fusión (grupos
      // "resumen" sin filas hijas) — se leen igual que una fila de datos y se guardan aparte.
      const propios = leerFilaTabla(libro, hoja, config, row, periodos);
      grupos.push({ grupo: titulo, filas: [], ...(propios.tieneDatos ? { valoresGrupo: propios.valores } : {}) });
      if (titulo !== '' || propios.tieneDatos) filasConDatos++;
      continue;
    }

    const fila = leerFilaTabla(libro, hoja, config, row, periodos);
    // Filas de datos antes de cualquier título: van a un grupo sin nombre, para no perderlas.
    if (grupos.length === 0) grupos.push({ grupo: '', filas: [] });
    grupos[grupos.length - 1].filas.push(fila.valores);
    if (fila.tieneDatos) filasConDatos++;
  }

  return { grupos, filasConDatos };
}

// --- Tablas jerárquicas ---

interface ArbolLeido {
  nodos: TreeNode[];
  filasConDatos: number;
}

// Reconstruye el árbol desde las fusiones VERTICALES: el escritor pone el valor de un padre una
// sola vez, en la primera fila de su subárbol, y fusiona esa celda sobre todas las filas que ocupa.
// Así, la altura de la fusión ES la cantidad de hijos que cuelgan de él. Sin fusión, el nodo ocupa
// una sola fila (el escritor solo fusiona cuando abarca más de una).
function leerArbol(
  libro: LibroLeido,
  hoja: string,
  config: ConfigTabla,
  profundidad: number,
  filaInicio: number,
  filasDisponibles: number,
  periodos: string[],
  colIdx = profundidad,
): ArbolLeido {
  // Un nivel de agrupador no consume columna (ver writeArbol): el índice de columna avanza solo en
  // los niveles normales, así que no coincide con la profundidad del árbol cuando hay agrupador.
  const col = config.columnas[colIdx];
  const nodos: TreeNode[] = [];
  let filasConDatos = 0;
  const fin = filaInicio + filasDisponibles;

  let row = filaInicio;
  while (row < fin) {
    const letra = columnasExcelDe(col)[0];
    const fusion = letra ? libro.fusion(hoja, `${letra}${row}`) : undefined;
    // La fusión nunca puede exceder el espacio que le cedió el padre: si la plantilla trae un rango
    // más alto de lo que queda (tabla mal formada, o el padre acortado), se recorta.
    const span = Math.min(Math.max(fusion?.filas ?? 1, 1), fin - row);

    let value: string | string[];
    if (col?.id === config.columnaDinamicaId && col.columnaExcel && periodos.length > 0) {
      const arr = leerCeldasPeriodos(libro, hoja, col, row, periodos);
      value = arr;
      if (arr.some((v) => v !== '')) filasConDatos++;
    } else {
      const celda = letra ? libro.celda(hoja, `${letra}${row}`) : undefined;
      value = celda ? valorParaColumna(col?.tipo ?? 'texto_corto', celda) : '';
      if (value !== '') filasConDatos++;
    }

    let children: TreeNode[] = [];
    if (colIdx + 1 < config.columnas.length) {
      const sub = leerArbol(libro, hoja, config, profundidad + 1, row, span, periodos, colIdx + 1);
      children = sub.nodos;
      filasConDatos += sub.filasConDatos;
    }

    nodos.push({ value, children });
    row += span;
  }

  return { nodos, filasConDatos };
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
      // Celda partida (4.8): la no-destrucción se aplica PARTE POR PARTE, no a la celda entera.
      if (esCeldaPartida(nuevo)) {
        const previo = esCeldaPartida(actual[col.id]) ? (actual[col.id] as Record<string, string>) : {};
        const partes: Record<string, string> = {};
        for (const sub of col.subcolumnas ?? []) {
          partes[sub.id] = nuevo[sub.id] !== '' && nuevo[sub.id] != null ? nuevo[sub.id] : (previo[sub.id] ?? '');
        }
        fila[col.id] = partes;
        continue;
      }
      // Columna dinámica: array de un valor por período — se fusiona período a período.
      if (Array.isArray(nuevo)) {
        const previo = Array.isArray(actual[col.id]) ? (actual[col.id] as string[]) : [];
        fila[col.id] = nuevo.map((v, k) => (v !== '' ? v : (previo[k] ?? '')));
        continue;
      }
      fila[col.id] = typeof nuevo === 'string' && nuevo !== '' ? nuevo : (actual[col.id] ?? '');
    }
    out.push(fila);
  }
  return out;
}

// Misma regla, grupo a grupo: el nombre del grupo y cada fila hija se fusionan por separado.
function fusionarGrupos(actuales: GrupoFilas[], leidos: GrupoFilas[], config: ConfigTabla): GrupoFilas[] {
  const total = Math.max(actuales.length, leidos.length);
  const out: GrupoFilas[] = [];
  for (let i = 0; i < total; i++) {
    const actual = actuales[i];
    const leido = leidos[i];
    if (!leido) { if (actual) out.push(actual); continue; }
    const propiosLeidos = leido.valoresGrupo;
    const propiosActuales = actual?.valoresGrupo;
    out.push({
      grupo: leido.grupo !== '' ? leido.grupo : (actual?.grupo ?? ''),
      filas: fusionarFilas(actual?.filas ?? [], leido.filas, config),
      ...(propiosLeidos || propiosActuales
        ? { valoresGrupo: fusionarFilas(propiosActuales ? [propiosActuales] : [], propiosLeidos ? [propiosLeidos] : [], config)[0] ?? {} }
        : {}),
    });
  }
  return out;
}

// Misma regla, nodo a nodo: el árbol leído manda en su forma (la que dicta el Excel), y cada valor
// vacío conserva el que tuviera el nodo equivalente del ejemplo.
function fusionarArbol(actuales: TreeNode[], leidos: TreeNode[]): TreeNode[] {
  return leidos.map((leido, i) => {
    const actual = actuales[i];
    let value: string | string[];
    if (Array.isArray(leido.value)) {
      const previo = Array.isArray(actual?.value) ? actual.value : [];
      value = leido.value.map((v, k) => (v !== '' ? v : (previo[k] ?? '')));
    } else {
      value = leido.value !== '' ? leido.value : (typeof actual?.value === 'string' ? actual.value : '');
    }
    return { value, children: fusionarArbol(actual?.children ?? [], leido.children) };
  });
}

function parseFilasActuales(raw: string | undefined): FilaDinamica[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) && (p.length === 0 || (!('value' in p[0]) && !('filas' in p[0])))) return p as FilaDinamica[];
  } catch { /* el valor actual no era JSON de filas — se ignora */ }
  return [];
}

function parseGruposActuales(raw: string | undefined): GrupoFilas[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) && p.length > 0 && 'filas' in p[0]) return p as GrupoFilas[];
  } catch { /* no era JSON de grupos */ }
  return [];
}

function parseArbolActual(raw: string | undefined): TreeNode[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) && p.length > 0 && 'value' in p[0]) return p as TreeNode[];
  } catch { /* no era JSON de árbol */ }
  return [];
}

// --- Recorrido del documento ---

export interface OpcionesVolcado {
  /** Leer campos simples (texto, número, fecha, booleano…) */
  camposSimples: boolean;
  /** Leer tablas — todos los subtipos, siempre acotado a las `filasBase` declaradas */
  tablas: boolean;
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
  /** Tablas leídas (con al menos una celda con dato) */
  tablasLeidas: number;
  /** Filas con datos encontradas entre todas las tablas leídas */
  filasTablaLeidas: number;
  /** Filas insertadas detectadas más allá de las filas base (crecimiento) */
  filasExtraDetectadas: number;
  /** Campos tabla sin posición declarada en la estructura — no hay dónde leer */
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
    tablas: opciones?.tablas ?? false,
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
      if (!ops.tablas || !esTablaLegible(campo)) { resultado.tablasOmitidas++; continue; }
      const config = campo.configTabla!;
      const filaOriginal = config.captura!.filaInicial!;
      const filaFisica = filaOriginal + shift(filaOriginal);
      const periodos = getPeriodos(config);
      const raw = ops.valoresActuales[campo.identificador] ?? campo.valorEjemplo;

      // Jerárquica: la forma la dictan las fusiones verticales del Excel.
      if (esJerarquica(config.subtipo)) {
        const lectura = leerArbol(libro, hoja, config, 0, filaFisica, config.captura!.filasBase!, periodos);
        if (lectura.filasConDatos === 0) continue;
        resultado.valores[campo.identificador] = JSON.stringify(fusionarArbol(parseArbolActual(raw), lectura.nodos));
        resultado.tablasLeidas++;
        resultado.filasTablaLeidas += lectura.filasConDatos;
        continue;
      }

      // Agrupada: las filas de título se reconocen por su fusión horizontal.
      if (config.agrupador) {
        const lectura = leerTablaAgrupada(libro, hoja, config, filaFisica, periodos);
        if (lectura.filasConDatos === 0) continue;
        resultado.valores[campo.identificador] = JSON.stringify(fusionarGrupos(parseGruposActuales(raw), lectura.grupos, config));
        resultado.tablasLeidas++;
        resultado.filasTablaLeidas += lectura.filasConDatos;
        continue;
      }

      // Plana (con o sin columnas dinámicas). Solo la variante simple detecta filas insertadas.
      const lectura = leerTablaSimple(libro, hoja, config, filaFisica, periodos, esTablaPlanaSimple(config));
      if (lectura.filasExtra > 0) {
        crecimientos.push({ despuesDeFila: filaOriginal + config.captura!.filasBase! - 1, cantidad: lectura.filasExtra });
        resultado.filasExtraDetectadas += lectura.filasExtra;
      }
      if (lectura.filasConDatos === 0) continue; // tabla vacía en el Excel: no tocar nada

      resultado.valores[campo.identificador] = JSON.stringify(fusionarFilas(parseFilasActuales(raw), lectura.filas, config));
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
