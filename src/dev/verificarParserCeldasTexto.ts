// Arnés de paridad del parser por texto (xlsxCeldasTexto.ts) contra el parser DOMParser ORIGINAL,
// que se conserva abajo como copia textual congelada (referencia, no se usa en la app). Compara
// TODOS los Maps de TODAS las hojas, en orden, entrada por entrada — por el camino del hilo
// principal (libro.hojaCompleta) y por el del worker (serializar → structuredClone → reconstruir).
// Uso en dev, desde la consola:
//   await import('/src/dev/verificarParserCeldasTexto.ts')
//   await window.verificarParserCeldasTexto('/api/archivos/98/contenido')
import { leerLibroXlsx, type CeldaLeida, type FusionLeida, type HojaParseada } from '@/lib/xlsxXmlReader';
import { libroDesdeSnapshot, serializarLibro } from '@/lib/excelVivoSnapshot';

// ---------- Referencia: copia textual del parser original con DOMParser ----------
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const BUILTIN_FECHA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
const BUILTIN_CODIGOS: Record<number, string> = {
  2: '0.00', 4: '#,##0.00', 9: '0%', 10: '0.00%', 39: '#,##0.00', 40: '#,##0.00', 43: '#,##0.00', 44: '#,##0.00',
};
function textoDe(el: Element): string {
  return Array.from(el.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('');
}
function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(doc.getElementsByTagName('si')).map(textoDe);
}
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
  const cellXfs = doc.getElementsByTagName('cellXfs')[0];
  if (cellXfs) {
    for (const xf of Array.from(cellXfs.getElementsByTagName('xf'))) {
      numFmtPorEstilo.push(Number(xf.getAttribute('numFmtId') ?? 0) || 0);
    }
  }
  return { numFmtPorEstilo, codigoPorNumFmt };
}
function codigoDeFormato(numFmtId: number, codigoPorNumFmt: Map<number, string>): string | undefined {
  return codigoPorNumFmt.get(numFmtId) ?? BUILTIN_CODIGOS[numFmtId];
}
function tokensDeFormato(code: string): string {
  return code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
}
function decimalesDeFormato(numFmtId: number, codigoPorNumFmt: Map<number, string>): number | undefined {
  const code = codigoDeFormato(numFmtId, codigoPorNumFmt);
  if (!code) return undefined;
  const m = tokensDeFormato(code).split(';')[0].match(/\.(0+)/);
  return m ? m[1].length : undefined;
}
function esPorcentajeFormato(numFmtId: number, codigoPorNumFmt: Map<number, string>): boolean {
  const code = codigoDeFormato(numFmtId, codigoPorNumFmt);
  return code ? tokensDeFormato(code).split(';')[0].includes('%') : false;
}
function analizarFormato(numFmtId: number, codigoPorNumFmt: Map<number, string>): { esFecha: boolean; soloAnio: boolean } {
  if (BUILTIN_FECHA.has(numFmtId)) return { esFecha: true, soloAnio: false };
  const code = codigoPorNumFmt.get(numFmtId);
  if (!code) return { esFecha: false, soloAnio: false };
  const limpio = tokensDeFormato(code);
  const esFecha = /[dmy]/i.test(limpio);
  if (!esFecha) return { esFecha: false, soloAnio: false };
  const primeraSeccion = limpio.split(';')[0].trim();
  return { esFecha: true, soloAnio: /^y+$/i.test(primeraSeccion) };
}
async function leerRutas(zip: HojaZip): Promise<Map<string, string>> {
  const parser = new DOMParser();
  const wbDoc = parser.parseFromString(await zip.file('xl/workbook.xml')!.async('string'), 'application/xml');
  const relsDoc = parser.parseFromString(await zip.file('xl/_rels/workbook.xml.rels')!.async('string'), 'application/xml');
  const ridToTarget = new Map<string, string>();
  for (const rel of Array.from(relsDoc.getElementsByTagName('Relationship'))) {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) ridToTarget.set(id, target);
  }
  const out = new Map<string, string>();
  for (const sheetEl of Array.from(wbDoc.getElementsByTagName('sheet'))) {
    const nombre = sheetEl.getAttribute('name');
    const rid = sheetEl.getAttributeNS(R_NS, 'id') || sheetEl.getAttribute('r:id');
    if (!nombre || !rid) continue;
    const target = ridToTarget.get(rid);
    if (!target) continue;
    out.set(nombre, target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`);
  }
  return out;
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
    out.set(`${m[1].toUpperCase()}${m[2]}`, { filas: Number(m[4]) - Number(m[2]) + 1, columnas: indiceColumna(m[3]) - indiceColumna(m[1]) + 1 });
  }
  return out;
}
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
function trasladarFormula(formula: string, dCol: number, dFila: number): string {
  if (dCol === 0 && dFila === 0) return formula;
  let out = '';
  let i = 0;
  const partes = formula.split(/("(?:[^"]|"")*")/);
  for (const parte of partes) {
    if (i++ % 2 === 1) {
      out += parte;
      continue;
    }
    out += parte.replace(RE_REF_EN_FORMULA, (todo, absCol, col, absFila, fila, offset: number) => {
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
function parseSqref(sqref: string) {
  const out: { c1: number; f1: number; c2: number; f2: number }[] = [];
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
function parseValidaciones(doc: Document) {
  const contenedores: Element[] = [];
  for (const el of Array.from(doc.documentElement.children)) {
    if (el.localName === 'dataValidations') contenedores.push(el);
    else if (el.localName === 'extLst') {
      for (const desc of Array.from(el.getElementsByTagName('*'))) {
        if (desc.localName === 'dataValidations') contenedores.push(desc);
      }
    }
  }
  const out: { rects: ReturnType<typeof parseSqref>; formula: string }[] = [];
  for (const cont of contenedores) {
    for (const dv of Array.from(cont.children)) {
      if (dv.localName !== 'dataValidation' || dv.getAttribute('type') !== 'list') continue;
      const sqref = dv.getAttribute('sqref') ?? hijoLocal(dv, 'sqref')?.textContent ?? '';
      const f1 = hijoLocal(dv, 'formula1');
      const formula = (hijoLocal(f1, 'f')?.textContent ?? f1?.textContent ?? '').trim();
      if (!sqref || !formula) continue;
      const rects = parseSqref(sqref);
      if (rects.length > 0) out.push({ rects, formula });
    }
  }
  return out;
}
function partirRef(ref: string): { col: number; fila: number } | undefined {
  const m = ref.match(/^([A-Z]+)([0-9]+)$/i);
  return m ? { col: indiceColumna(m[1]), fila: Number(m[2]) } : undefined;
}
function parseHojaDOM(xml: string, shared: string[], numFmtPorEstilo: number[], codigoPorNumFmt: Map<number, string>): HojaParseada {
  const celdas = new Map<string, CeldaLeida>();
  const estilos = new Map<string, number>();
  const formulas = new Map<string, string>();
  const formatos = new Map<string, { esFecha: boolean; soloAnio: boolean; esPorcentaje: boolean; decimales?: number; codigo?: string }>();
  const maestras = new Map<string, { formula: string; ref: string }>();
  const pendientes: { ref: string; si: string }[] = [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  let filaMaxima = 0;
  for (const c of Array.from(doc.getElementsByTagName('c'))) {
    const ref = c.getAttribute('r');
    if (!ref) continue;
    const tipo = c.getAttribute('t');
    const filaDeRef = Number(ref.match(/[0-9]+$/)?.[0]);
    if (Number.isFinite(filaDeRef) && filaDeRef > filaMaxima) filaMaxima = filaDeRef;
    const estiloAttr = c.getAttribute('s');
    if (estiloAttr !== null) estilos.set(ref, Number(estiloAttr));
    const numFmtCelda = estiloAttr !== null ? (numFmtPorEstilo[Number(estiloAttr)] ?? 0) : 0;
    const codigo = codigoDeFormato(numFmtCelda, codigoPorNumFmt);
    const decimales = decimalesDeFormato(numFmtCelda, codigoPorNumFmt);
    const esPorcentaje = esPorcentajeFormato(numFmtCelda, codigoPorNumFmt);
    const formatoCelda = { ...analizarFormato(numFmtCelda, codigoPorNumFmt), esPorcentaje, decimales, codigo };
    if (formatoCelda.esFecha || esPorcentaje || decimales !== undefined || (codigo && numFmtCelda !== 0 && numFmtCelda !== 49)) {
      formatos.set(ref, formatoCelda);
    }
    const f = c.getElementsByTagName('f')[0];
    if (f) {
      const textoFormula = f.textContent?.trim() ?? '';
      const si = f.getAttribute('t') === 'shared' ? f.getAttribute('si') : null;
      if (si !== null && textoFormula === '') {
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
      if (!v) continue;
      const raw = v.textContent ?? '';
      if (tipo === 's') valor = shared[Number(raw)] ?? '';
      else if (tipo === 'b') valor = raw === '1' ? 'true' : 'false';
      else valor = raw;
    }
    if (valor === null || valor === '') continue;
    const esNumero = tipo == null || tipo === 'n';
    const { esFecha, soloAnio, esPorcentaje: pct } = esNumero ? formatoCelda : { esFecha: false, soloAnio: false, esPorcentaje: false };
    celdas.set(ref, {
      valor, esFecha, soloAnio, esPorcentaje: pct, decimales: formatoCelda.decimales,
      codigoFormato: codigo && numFmtCelda !== 0 && numFmtCelda !== 49 ? codigo : undefined,
      esTexto: tipo === 's' || tipo === 'inlineStr',
    });
  }
  for (const { ref, si } of pendientes) {
    const maestra = maestras.get(si);
    if (!maestra) continue;
    const destino = partirRef(ref);
    const origen = partirRef(maestra.ref);
    if (!destino || !origen) continue;
    formulas.set(ref, trasladarFormula(maestra.formula, destino.col - origen.col, destino.fila - origen.fila));
  }
  return { celdas, estilos, formulas, formatos, fusiones: parseFusiones(doc), validaciones: parseValidaciones(doc), filaMaxima };
}
// ---------- Fin de la referencia ----------

type HojaZip = { file(ruta: string): { async(t: 'string'): Promise<string> } | null };

// JSON.stringify no distingue `decimales: undefined` de la clave ausente — se normaliza igual en
// ambos lados, y el orden de claves de los objetos es el mismo por construcción.
function compararMap<V>(nombre: string, ref: Map<string, V>, nuevo: Map<string, V>, diffs: string[]) {
  if (ref.size !== nuevo.size) diffs.push(`${nombre}: tamaño ${ref.size} vs ${nuevo.size}`);
  const a = Array.from(ref.entries());
  const b = Array.from(nuevo.entries());
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n && diffs.length < 50; i++) {
    if (a[i][0] !== b[i][0]) {
      diffs.push(`${nombre}[${i}]: clave ${a[i][0]} vs ${b[i][0]} (orden distinto)`);
      continue;
    }
    const va = typeof a[i][1] === 'object' ? JSON.stringify(a[i][1]) : String(a[i][1]);
    const vb = typeof b[i][1] === 'object' ? JSON.stringify(b[i][1]) : String(b[i][1]);
    if (va !== vb) diffs.push(`${nombre}[${a[i][0]}]: ${va} vs ${vb}`);
  }
}

function compararHoja(etiqueta: string, ref: HojaParseada, nuevo: HojaParseada | undefined, diffs: string[]) {
  if (!nuevo) {
    diffs.push(`${etiqueta}: hoja ausente`);
    return;
  }
  compararMap(`${etiqueta}.celdas`, ref.celdas, nuevo.celdas, diffs);
  compararMap(`${etiqueta}.estilos`, ref.estilos, nuevo.estilos, diffs);
  compararMap(`${etiqueta}.formulas`, ref.formulas, nuevo.formulas, diffs);
  compararMap(`${etiqueta}.formatos`, ref.formatos, nuevo.formatos, diffs);
  compararMap(`${etiqueta}.fusiones`, ref.fusiones, nuevo.fusiones, diffs);
  if (JSON.stringify(ref.validaciones) !== JSON.stringify(nuevo.validaciones)) diffs.push(`${etiqueta}.validaciones distintas`);
  if (ref.filaMaxima !== nuevo.filaMaxima) diffs.push(`${etiqueta}.filaMaxima ${ref.filaMaxima} vs ${nuevo.filaMaxima}`);
}

async function verificarParserCeldasTexto(url: string) {
  const libro = await leerLibroXlsx(url);
  const zip = libro.zip as unknown as HojaZip;
  const diffs: string[] = [];

  const sharedRef = parseSharedStrings((await zip.file('xl/sharedStrings.xml')?.async('string')) ?? null);
  const datos = libro.datosParaWorker();
  if (sharedRef.length !== datos.shared.length) diffs.push(`sharedStrings: ${sharedRef.length} vs ${datos.shared.length}`);
  for (let i = 0; i < sharedRef.length && diffs.length < 50; i++) {
    if (sharedRef[i] !== datos.shared[i]) diffs.push(`sharedStrings[${i}]: ${JSON.stringify(sharedRef[i])} vs ${JSON.stringify(datos.shared[i])}`);
  }

  const { numFmtPorEstilo, codigoPorNumFmt } = parseEstilos((await zip.file('xl/styles.xml')?.async('string')) ?? null);
  const rutas = await leerRutas(zip);
  const libroWorker = libroDesdeSnapshot(structuredClone(serializarLibro(libro)));

  const resumen: [string, number][] = [];
  for (const [hoja, ruta] of rutas) {
    const xml = await zip.file(ruta)!.async('string');
    const ref = parseHojaDOM(xml, sharedRef, numFmtPorEstilo, codigoPorNumFmt);
    compararHoja(`${hoja} (principal)`, ref, libro.hojaCompleta(hoja), diffs);
    compararHoja(`${hoja} (worker)`, ref, libroWorker.hojaCompleta(hoja), diffs);
    resumen.push([hoja, ref.celdas.size]);
  }

  const total = resumen.reduce((acc, [, n]) => acc + n, 0);
  if (diffs.length === 0) console.log(`[paridad-parser] ✅ PARIDAD EXACTA — ${rutas.size} hojas, ${total} celdas con valor, ${sharedRef.length} sharedStrings`, resumen);
  else console.error(`[paridad-parser] ❌ ${diffs.length} diferencias`, diffs);
  return { ok: diffs.length === 0, hojas: rutas.size, celdas: total, sharedStrings: sharedRef.length, diffs };
}

if (import.meta.env.DEV) {
  (window as unknown as { verificarParserCeldasTexto: typeof verificarParserCeldasTexto }).verificarParserCeldasTexto = verificarParserCeldasTexto;
}
