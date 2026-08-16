import JSZip from 'jszip';

// Lector de celdas de un .xlsx/.xlsm — el inverso exacto de xlsxXmlPatcher.ts. Abre el archivo
// como ZIP y extrae el valor "plano" de cada celda de cada hoja, resolviendo las tres formas en que
// OOXML guarda un valor (sharedStrings, inlineStr, valor directo) y detectando las celdas con
// formato de fecha para convertir el número serial de Excel a una fecha legible.
//
// No usa SheetJS por la misma razón que el patcher: aquí solo se necesita leer valores, y hacerlo
// sobre el XML crudo evita cargar toda la maquinaria de una librería completa de hojas de cálculo.
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// Formatos de número integrados de OOXML que representan fecha y/u hora (ECMA-376, §18.8.30).
const BUILTIN_FECHA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

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
}

function textoDe(el: Element): string {
  // Un <si>/<is> puede tener varios <t> cuando el texto tiene formato mixto (negritas parciales,
  // etc.) — se concatenan en orden para reconstruir la cadena completa.
  return Array.from(el.getElementsByTagName('t'))
    .map((t) => t.textContent ?? '')
    .join('');
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(doc.getElementsByTagName('si')).map(textoDe);
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

// Códigos de los formatos numéricos integrados que declaran decimales o porcentaje (ECMA-376,
// §18.8.30). El archivo puede redefinirlos en <numFmts>; esta tabla es el respaldo cuando no lo hace.
const BUILTIN_CODIGOS: Record<number, string> = {
  2: '0.00', 4: '#,##0.00', 9: '0%', 10: '0.00%', 39: '#,##0.00', 40: '#,##0.00', 43: '#,##0.00', 44: '#,##0.00',
};

// El código de formato aplicado a la celda: el que declare el archivo tiene prioridad sobre el
// integrado, porque un .xlsx puede redefinir cualquier numFmtId en <numFmts>.
function codigoDeFormato(numFmtId: number, codigoPorNumFmt: Map<number, string>): string | undefined {
  return codigoPorNumFmt.get(numFmtId) ?? BUILTIN_CODIGOS[numFmtId];
}

// Los literales entre comillas y las secciones [entre corchetes] no son tokens de formato: un
// código como `0.00" %"` muestra un "%" pero NO escala el número por 100.
function tokensDeFormato(code: string): string {
  return code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
}

/**
 * Cuántos decimales muestra el formato de la celda, o undefined si no lo declara.
 *
 * Hace falta para presentar el resultado de una fórmula como lo presenta Excel: una división da
 * 1.4054794520547946, pero si la celda tiene formato `#,##0.00` lo que se ve en el Excel es 1.41.
 */
function decimalesDeFormato(numFmtId: number, codigoPorNumFmt: Map<number, string>): number | undefined {
  const code = codigoDeFormato(numFmtId, codigoPorNumFmt);
  if (!code) return undefined;
  const m = tokensDeFormato(code).split(';')[0].match(/\.(0+)/);
  return m ? m[1].length : undefined;
}

/**
 * ¿El formato es de porcentaje? Un "%" entre los tokens del código hace que Excel muestre el número
 * multiplicado por 100: la celda guarda 0.011 y en la hoja se lee 1.10%.
 */
function esPorcentajeFormato(numFmtId: number, codigoPorNumFmt: Map<number, string>): boolean {
  const code = codigoDeFormato(numFmtId, codigoPorNumFmt);
  return code ? tokensDeFormato(code).split(';')[0].includes('%') : false;
}

// Un formato es de fecha si es uno de los integrados, o si su código contiene tokens de fecha
// (d/m/y) fuera de los literales entre comillas y de las secciones [entre corchetes].
function analizarFormato(numFmtId: number, codigoPorNumFmt: Map<number, string>): { esFecha: boolean; soloAnio: boolean } {
  if (BUILTIN_FECHA.has(numFmtId)) return { esFecha: true, soloAnio: false };
  const code = codigoPorNumFmt.get(numFmtId);
  if (!code) return { esFecha: false, soloAnio: false };

  const limpio = tokensDeFormato(code);
  const esFecha = /[dmy]/i.test(limpio);
  if (!esFecha) return { esFecha: false, soloAnio: false };

  // "yyyy;@" -> primera sección "yyyy" -> solo año
  const primeraSeccion = limpio.split(';')[0].trim();
  return { esFecha: true, soloAnio: /^y+$/i.test(primeraSeccion) };
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

interface HojaParseada {
  celdas: Map<string, CeldaLeida>;
  /** Fórmula de cada celda que la tenga, sin el `=` inicial. La usa el evaluador en vivo
   * (excelFormulaEval) para reproducir lo que el Excel calcularía. */
  formulas: Map<string, string>;
  /** Formato por celda, incluso si está vacía — `celdas` solo trae las que tienen valor, y una
   * celda con fórmula sin calcular está vacía pero conserva su formato. */
  formatos: Map<string, { esFecha: boolean; soloAnio: boolean; esPorcentaje: boolean; decimales?: number }>;
  /** Estilo de TODA celda presente en el XML, tenga valor o no — base de la detección por formato */
  estilos: Map<string, number>;
  /** Fusiones indexadas por su celda ancla (esquina superior-izquierda del rango) */
  fusiones: Map<string, FusionLeida>;
  /** Listas desplegables de la hoja. Son pocas (decenas), así que se recorren linealmente en vez de
   * indexarse celda por celda: una sola validación puede cubrir miles de celdas (`H35:H1048542`). */
  validaciones: ValidacionParseada[];
}

interface Rect {
  c1: number;
  f1: number;
  c2: number;
  f2: number;
}

interface ValidacionParseada {
  rects: Rect[];
  formula: string;
}

function indiceColumna(letra: string): number {
  let n = 0;
  for (const ch of letra.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
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

// Referencia A1 dentro de una fórmula, con sus `$` opcionales. Se usa para trasladar las fórmulas
// compartidas; por eso importa distinguir la parte absoluta (con `$`, no se mueve) de la relativa.
const RE_REF_EN_FORMULA = /(\$?)([A-Z]{1,3})(\$?)([0-9]{1,7})/g;

function letraColumna(n: number): string {
  let s = '';
  let i = n;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

/**
 * Traslada las referencias RELATIVAS de una fórmula, como hace Excel al copiarla a otra celda.
 *
 * Hace falta para las fórmulas compartidas (`<f t="shared">`): Excel guarda el texto UNA sola vez,
 * en la celda maestra, y las demás celdas del rango solo apuntan a ella con su `si`. Sin expandirlas
 * esas celdas parecen no tener fórmula — en el formato oficial son 109, casi todas columnas de
 * totales que se repiten fila a fila.
 */
function trasladarFormula(formula: string, dCol: number, dFila: number): string {
  if (dCol === 0 && dFila === 0) return formula;
  let out = '';
  let i = 0;
  // Lo que va entre comillas es texto literal y no se toca.
  const partes = formula.split(/("(?:[^"]|"")*")/);
  for (const parte of partes) {
    if (i++ % 2 === 1) {
      out += parte;
      continue;
    }
    out += parte.replace(RE_REF_EN_FORMULA, (todo, absCol, col, absFila, fila, offset: number) => {
      // Un nombre de función (`LOG10(`) o un identificador más largo no es una referencia
      const siguiente = parte[offset + todo.length];
      const anterior = parte[offset - 1];
      if (siguiente === '(' || (anterior && /[A-Za-z0-9_.]/.test(anterior))) return todo;

      const nCol = absCol ? col : letraColumna(Math.max(indiceColumna(col) + dCol, 1));
      const nFila = absFila ? fila : String(Math.max(Number(fila) + dFila, 1));
      return `${absCol}${nCol}${absFila}${nFila}`;
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

function parseHoja(
  xml: string,
  shared: string[],
  numFmtPorEstilo: number[],
  codigoPorNumFmt: Map<number, string>,
): HojaParseada {
  const celdas = new Map<string, CeldaLeida>();
  const estilos = new Map<string, number>();
  const formulas = new Map<string, string>();
  const formatos = new Map<string, { esFecha: boolean; soloAnio: boolean; esPorcentaje: boolean; decimales?: number }>();
  // Fórmulas compartidas: `si` -> celda que sí trae el texto, y las que solo la referencian.
  const maestras = new Map<string, { formula: string; ref: string }>();
  const pendientes: { ref: string; si: string }[] = [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  for (const c of Array.from(doc.getElementsByTagName('c'))) {
    const ref = c.getAttribute('r');
    if (!ref) continue;
    const tipo = c.getAttribute('t');

    const estiloAttr = c.getAttribute('s');
    if (estiloAttr !== null) estilos.set(ref, Number(estiloAttr));

    // El formato se guarda para TODA celda, tenga valor o no: una celda con fórmula todavía sin
    // calcular aparece vacía, y aun así su resultado debe mostrarse con su formato (R53 = TODAY()
    // con formato "yyyy;@" se ve como el año, no como una fecha completa).
    const numFmtCelda = estiloAttr !== null ? (numFmtPorEstilo[Number(estiloAttr)] ?? 0) : 0;
    const decimales = decimalesDeFormato(numFmtCelda, codigoPorNumFmt);
    const esPorcentaje = esPorcentajeFormato(numFmtCelda, codigoPorNumFmt);
    const formatoCelda = { ...analizarFormato(numFmtCelda, codigoPorNumFmt), esPorcentaje, decimales };
    if (formatoCelda.esFecha || esPorcentaje || decimales !== undefined) formatos.set(ref, formatoCelda);

    const f = c.getElementsByTagName('f')[0];
    if (f) {
      const textoFormula = f.textContent?.trim() ?? '';
      const si = f.getAttribute('t') === 'shared' ? f.getAttribute('si') : null;
      if (si !== null && textoFormula === '') {
        // Celda que solo referencia una fórmula compartida: se resuelve al final, cuando ya se
        // conocen todas las maestras.
        pendientes.push({ ref, si });
      } else if (textoFormula) {
        formulas.set(ref, textoFormula);
        if (si !== null) maestras.set(si, { formula: textoFormula, ref });
      }
    }

    let valor: string | null = null;
    if (tipo === 'inlineStr') {
      const is = c.getElementsByTagName('is')[0];
      valor = is ? textoDe(is) : '';
    } else {
      const v = c.getElementsByTagName('v')[0];
      if (!v) continue; // celda solo con estilo, sin valor
      const raw = v.textContent ?? '';
      if (tipo === 's') valor = shared[Number(raw)] ?? '';
      else if (tipo === 'b') valor = raw === '1' ? 'true' : 'false';
      else valor = raw; // 'n' (número), 'str' (resultado textual de fórmula), o sin tipo
    }

    if (valor === null || valor === '') continue;

    // Solo tiene sentido interpretar el formato de fecha o de porcentaje sobre un número: una celda
    // de texto con ese formato heredado seguiría siendo texto.
    const esNumero = tipo == null || tipo === 'n';
    const { esFecha, soloAnio, esPorcentaje: pct } = esNumero
      ? formatoCelda
      : { esFecha: false, soloAnio: false, esPorcentaje: false };

    celdas.set(ref, { valor, esFecha, soloAnio, esPorcentaje: pct, decimales: formatoCelda.decimales });
  }
  // Expansión de las fórmulas compartidas: cada celda recibe la fórmula de su maestra trasladada
  // por la diferencia de fila y columna entre ambas, que es exactamente lo que hace Excel.
  for (const { ref, si } of pendientes) {
    const maestra = maestras.get(si);
    if (!maestra) continue;
    const destino = partirRef(ref);
    const origen = partirRef(maestra.ref);
    if (!destino || !origen) continue;
    formulas.set(ref, trasladarFormula(maestra.formula, destino.col - origen.col, destino.fila - origen.fila));
  }

  return { celdas, estilos, formulas, formatos, fusiones: parseFusiones(doc), validaciones: parseValidaciones(doc) };
}

function partirRef(ref: string): { col: number; fila: number } | undefined {
  const m = ref.match(/^([A-Z]+)([0-9]+)$/i);
  return m ? { col: indiceColumna(m[1]), fila: Number(m[2]) } : undefined;
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

/** `fuente` puede ser un data URI (el archivo que el usuario acaba de soltar, leído con FileReader)
 * o una URL http(s) — el Excel de un ejemplo vive en Cloudinary. Se resuelve con `fetch`, que
 * entiende ambas, igual que hace el parcheador. Antes se asumía data URI y se intentaba decodificar
 * la URL como base64, lo que reventaba con "Invalid base64 input, bad content length". */
export async function leerLibroXlsx(fuente: string): Promise<LibroLeido> {
  const { fetchBinario } = await import('./fetchBinario');
  const zip = await JSZip.loadAsync(await (await fetchBinario(fuente)).arrayBuffer());

  const shared = parseSharedStrings((await zip.file('xl/sharedStrings.xml')?.async('string')) ?? null);
  const { numFmtPorEstilo, codigoPorNumFmt } = parseEstilos((await zip.file('xl/styles.xml')?.async('string')) ?? null);
  const { rutaPorHoja, nombresDefinidos } = await leerMapaHojas(zip);

  // Las hojas se parsean bajo demanda (y se memorizan): un libro real trae ~24 hojas y la plantilla
  // solo consulta las que tiene mapeadas.
  const cache = new Map<string, HojaParseada>();
  const pendientes = new Map<string, string>(); // hoja -> xml sin parsear
  for (const [nombre, ruta] of rutaPorHoja) {
    const file = zip.file(ruta);
    if (file) pendientes.set(nombre, await file.async('string'));
  }

  function hojaParseada(hoja: string): HojaParseada | undefined {
    let parseada = cache.get(hoja);
    if (!parseada) {
      const xml = pendientes.get(hoja);
      if (xml === undefined) return undefined;
      parseada = parseHoja(xml, shared, numFmtPorEstilo, codigoPorNumFmt);
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
    validacionLista(hoja: string, ref: string): string | undefined {
      const m = ref.match(/^\$?([A-Z]+)\$?(\d+)$/i);
      if (!m) return undefined;
      const col = indiceColumna(m[1]);
      const fila = Number(m[2]);
      for (const v of hojaParseada(hoja)?.validaciones ?? []) {
        if (v.rects.some((r) => col >= r.c1 && col <= r.c2 && fila >= r.f1 && fila <= r.f2)) return v.formula;
      }
      return undefined;
    },
  };
}
