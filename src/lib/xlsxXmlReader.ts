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
}

export interface LibroLeido {
  /** Nombres de hoja presentes en el archivo, en el orden del libro */
  hojas: string[];
  /** Valor de una celda ("H8"), o undefined si está vacía o la hoja no existe */
  celda(hoja: string, ref: string): CeldaLeida | undefined;
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

// Un formato es de fecha si es uno de los integrados, o si su código contiene tokens de fecha
// (d/m/y) fuera de los literales entre comillas y de las secciones [entre corchetes].
function analizarFormato(numFmtId: number, codigoPorNumFmt: Map<number, string>): { esFecha: boolean; soloAnio: boolean } {
  if (BUILTIN_FECHA.has(numFmtId)) return { esFecha: true, soloAnio: false };
  const code = codigoPorNumFmt.get(numFmtId);
  if (!code) return { esFecha: false, soloAnio: false };

  const limpio = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
  const esFecha = /[dmy]/i.test(limpio);
  if (!esFecha) return { esFecha: false, soloAnio: false };

  // "yyyy;@" -> primera sección "yyyy" -> solo año
  const primeraSeccion = limpio.split(';')[0].trim();
  return { esFecha: true, soloAnio: /^y+$/i.test(primeraSeccion) };
}

async function leerMapaHojas(zip: JSZip): Promise<Map<string, string>> {
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
  return nombreToPath;
}

function parseHoja(
  xml: string,
  shared: string[],
  numFmtPorEstilo: number[],
  codigoPorNumFmt: Map<number, string>,
): Map<string, CeldaLeida> {
  const celdas = new Map<string, CeldaLeida>();
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  for (const c of Array.from(doc.getElementsByTagName('c'))) {
    const ref = c.getAttribute('r');
    if (!ref) continue;
    const tipo = c.getAttribute('t');

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

    const estilo = Number(c.getAttribute('s') ?? -1);
    const numFmtId = estilo >= 0 ? (numFmtPorEstilo[estilo] ?? 0) : 0;
    // Solo tiene sentido interpretar el formato de fecha sobre un número: una celda de texto con
    // formato de fecha heredado seguiría siendo texto.
    const esNumero = tipo == null || tipo === 'n';
    const { esFecha, soloAnio } = esNumero
      ? analizarFormato(numFmtId, codigoPorNumFmt)
      : { esFecha: false, soloAnio: false };

    celdas.set(ref, { valor, esFecha, soloAnio });
  }
  return celdas;
}

export async function leerLibroXlsx(dataUrl: string): Promise<LibroLeido> {
  const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl;
  const zip = await JSZip.loadAsync(base64, { base64: true });

  const shared = parseSharedStrings((await zip.file('xl/sharedStrings.xml')?.async('string')) ?? null);
  const { numFmtPorEstilo, codigoPorNumFmt } = parseEstilos((await zip.file('xl/styles.xml')?.async('string')) ?? null);
  const rutaPorHoja = await leerMapaHojas(zip);

  // Las hojas se parsean bajo demanda (y se memorizan): un libro real trae ~24 hojas y la plantilla
  // solo consulta las que tiene mapeadas.
  const cache = new Map<string, Map<string, CeldaLeida>>();
  const pendientes = new Map<string, string>(); // hoja -> xml sin parsear
  for (const [nombre, ruta] of rutaPorHoja) {
    const file = zip.file(ruta);
    if (file) pendientes.set(nombre, await file.async('string'));
  }

  return {
    hojas: Array.from(rutaPorHoja.keys()),
    celda(hoja: string, ref: string): CeldaLeida | undefined {
      let celdas = cache.get(hoja);
      if (!celdas) {
        const xml = pendientes.get(hoja);
        if (xml === undefined) return undefined;
        celdas = parseHoja(xml, shared, numFmtPorEstilo, codigoPorNumFmt);
        cache.set(hoja, celdas);
      }
      return celdas.get(ref);
    },
  };
}
