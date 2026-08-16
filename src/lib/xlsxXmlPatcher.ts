import JSZip from 'jszip';
import { insertarImagenEnHoja, type ImagenAInsertar } from './xlsxImageWriter';

// Parcheador quirúrgico de OOXML (.xlsx/.xlsm): en vez de re-serializar el libro entero con
// SheetJS (XLSX.write), que en la edición gratuita descarta por completo los estilos de celda
// (rellenos, bordes, fuentes) al reconstruir el archivo, este módulo abre el .xlsx/.xlsm como un
// ZIP y edita únicamente los nodos <c> de valor dentro de cada sheetN.xml — el resto del archivo
// (styles.xml, tema, macros, formato de las celdas que no tocamos) queda byte a byte intacto.
const SML_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export interface CeldaEdicion {
  columna: string;
  fila: number;
  valor: string | number | boolean;
  /** Fórmula nativa de Excel (sin el "=" inicial) — si está presente, `valor` es solo el caché
   * numérico mostrado antes de que Excel recalcule al abrir el archivo. */
  formula?: string;
}

export interface Crecimiento {
  /** Última fila base de la tabla, antes de crecer — las filas nuevas se insertan justo debajo */
  despuesDeFila: number;
  /** Cantidad de filas nuevas a insertar */
  cantidad: number;
}

interface HojaEdits {
  celdas: CeldaEdicion[];
  merges: Set<string>;
  /** Rangos cuya fusión debe romperse antes de escribir (celdas partidas, 4.8) */
  desfusiones: Set<string>;
  crecimientos: Crecimiento[];
  /** Imágenes a incrustar (campos tipo `imagen`) — no son celdas: van a xl/media + xl/drawings */
  imagenes: ImagenAInsertar[];
  /** Celdas que deben quedar como hipervínculo: ref de celda -> URL destino */
  enlaces: Map<string, string>;
}

export class LibroEdits {
  private hojas = new Map<string, HojaEdits>();

  private getHoja(hoja: string): HojaEdits {
    let h = this.hojas.get(hoja);
    if (!h) { h = { celdas: [], merges: new Set(), desfusiones: new Set(), crecimientos: [], imagenes: [], enlaces: new Map() }; this.hojas.set(hoja, h); }
    return h;
  }

  escribirCelda(hoja: string, columna: string, fila: number, valor: string | number | boolean) {
    this.getHoja(hoja).celdas.push({ columna, fila, valor });
  }

  // Escribe una fórmula nativa de Excel (sin el "=" inicial) — Excel la recalcula al abrir el
  // archivo; `valorCache` es el número que se muestra mientras tanto (y en visores que no evalúan
  // fórmulas, como nuestra propia vista previa).
  escribirFormula(hoja: string, columna: string, fila: number, formula: string, valorCache: number) {
    this.getHoja(hoja).celdas.push({ columna, fila, valor: valorCache, formula });
  }

  fusionar(hoja: string, rango: string) {
    this.getHoja(hoja).merges.add(rango);
  }

  // Rompe la fusión que cubra ese rango. Necesario para las celdas partidas (4.8): la plantilla
  // oficial trae J:K fusionada por fila, y escribir en K dentro de una fusión deja el dato oculto
  // — Excel solo muestra la celda superior-izquierda del rango.
  desfusionar(hoja: string, rango: string) {
    this.getHoja(hoja).desfusiones.add(rango);
  }

  // Una imagen no ocupa una celda: se guarda como binario aparte y se ancla entre coordenadas.
  // Se acumula acá para que el parcheo del ZIP siga siendo el único punto que toca el archivo.
  insertarImagen(hoja: string, imagen: ImagenAInsertar) {
    this.getHoja(hoja).imagenes.push(imagen);
  }

  // Convierte la celda en un enlace en el que se puede hacer clic. El texto visible lo pone
  // escribirCelda por separado — esto solo añade el salto.
  enlazar(hoja: string, columna: string, fila: number, url: string) {
    this.getHoja(hoja).enlaces.set(`${columna}${fila}`, url);
  }

  // Registra que una tabla creció más allá de sus filas base — las filas físicas de Excel deben
  // insertarse (desplazando todo lo que está debajo) antes de escribir ningún valor.
  registrarCrecimiento(hoja: string, despuesDeFila: number, cantidad: number) {
    if (cantidad <= 0) return;
    this.getHoja(hoja).crecimientos.push({ despuesDeFila, cantidad });
  }

  // Cuánto se desplaza hacia abajo una fila que originalmente (según la plantilla oficial) estaba
  // en `filaOriginal`, por efecto de todas las tablas que crecieron ANTES de ella en la misma hoja.
  desplazamientoPara(hoja: string, filaOriginal: number): number {
    const h = this.hojas.get(hoja);
    if (!h) return 0;
    let total = 0;
    for (const c of h.crecimientos) if (c.despuesDeFila < filaOriginal) total += c.cantidad;
    return total;
  }

  entries(): [string, HojaEdits][] {
    return Array.from(this.hojas.entries());
  }
}

function colLetterToIndex(letter: string): number {
  let n = 0;
  for (const ch of letter.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseDireccion(direccion: string): { columna: string; fila: number } {
  const m = direccion.match(/^([A-Za-z]+)(\d+)$/);
  if (!m) throw new Error(`Dirección de celda inválida: ${direccion}`);
  return { columna: m[1].toUpperCase(), fila: Number(m[2]) };
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
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    nombreToPath.set(nombre, path);
  }
  return nombreToPath;
}

function limpiarHijos(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// Un número "limpio": sin ceros a la izquierda ni separadores de miles. La restricción es
// deliberada — un código como "08010" (ubigeo) o "0115" (cadena funcional) NO debe convertirse en
// número, porque perdería el cero delantero. Ante la duda, se queda como texto.
const RE_NUMERO_LIMPIO = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

/**
 * Índices de estilo cuyo formato de número es EXPLÍCITAMENTE numérico (declara dígitos con `0`/`#`):
 * moneda, decimales, porcentaje, miles… Quedan fuera `General` (0) y `Texto` (49), donde no hay
 * nada que respetar y conviene no tocar el comportamiento de siempre.
 *
 * Sirve para no meter texto en una celda que la plantilla formateó como número: Excel no aplica un
 * formato numérico a una cadena, así que un `3650` escrito como texto en la celda de "Costo
 * unitario" se ve sin su `S/` por más que el estilo de la celda siga intacto.
 */
async function estilosNumericos(zip: JSZip): Promise<Set<number>> {
  const out = new Set<number>();
  const xml = await zip.file('xl/styles.xml')?.async('string');
  if (!xml) return out;

  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const codigoPorNumFmt = new Map<number, string>();
  for (const nf of Array.from(doc.getElementsByTagName('numFmt'))) {
    const id = Number(nf.getAttribute('numFmtId'));
    const code = nf.getAttribute('formatCode');
    if (Number.isFinite(id) && code) codigoPorNumFmt.set(id, code);
  }
  // Integrados que declaran dígitos (ECMA-376, §18.8.30): enteros, decimales, miles, moneda y
  // porcentaje. Los de fecha/hora se excluyen a propósito: ahí el valor ya viaja como serial.
  const BUILTIN_NUM = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 37, 38, 39, 40, 43, 44, 48]);

  const cellXfs = doc.getElementsByTagName('cellXfs')[0];
  if (!cellXfs) return out;
  Array.from(cellXfs.getElementsByTagName('xf')).forEach((xf, i) => {
    const numFmtId = Number(xf.getAttribute('numFmtId') ?? 0) || 0;
    if (numFmtId === 0 || numFmtId === 49) return; // General y Texto
    const code = codigoPorNumFmt.get(numFmtId);
    if (code === undefined) { if (BUILTIN_NUM.has(numFmtId)) out.add(i); return; }
    // Se mira solo la primera sección (positivos) y sin literales entre comillas: el `0` de un
    // texto literal como "S/ 0 soles" no convierte el formato en numérico.
    const primera = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '').split(';')[0];
    if (/[0#]/.test(primera)) out.add(i);
  });
  return out;
}

function aplicarValorCelda(
  doc: Document,
  celda: Element,
  valor: string | number | boolean,
  formula?: string,
  destinoNumerico = false,
) {
  // La celda destino está formateada como número y lo que llega es un número escrito como texto:
  // se guarda como número para que el formato de la plantilla (moneda, decimales, miles) se vea.
  // Lo decide LA CELDA, no el tipo declarado en la estructura — una columna puede estar puesta como
  // "Texto corto" y apuntar igualmente a una celda de moneda.
  if (destinoNumerico && typeof valor === 'string' && RE_NUMERO_LIMPIO.test(valor.trim())) {
    valor = Number(valor.trim());
  }
  limpiarHijos(celda);
  if (formula) {
    // Fórmula nativa: Excel la recalcula al abrir el archivo. El <v> es solo el caché que se
    // muestra mientras tanto (y lo que usa nuestra propia vista previa, que no evalúa fórmulas).
    celda.removeAttribute('t');
    const f = doc.createElementNS(SML_NS, 'f');
    f.textContent = formula;
    celda.appendChild(f);
    const v = doc.createElementNS(SML_NS, 'v');
    v.textContent = String(valor);
    celda.appendChild(v);
    return;
  }
  if (valor === '') {
    // Vaciar de verdad: sin `t` ni hijos queda `<c r=".." s=".."/>`, celda sin contenido pero con
    // su estilo intacto (el estilo delimita la tabla al releer). Un <t/> vacío dejaría un rastro
    // de texto que confundiría a la relectura.
    celda.removeAttribute('t');
    return;
  }
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    celda.removeAttribute('t');
    const v = doc.createElementNS(SML_NS, 'v');
    v.textContent = String(valor);
    celda.appendChild(v);
  } else if (typeof valor === 'boolean') {
    celda.setAttribute('t', 'b');
    const v = doc.createElementNS(SML_NS, 'v');
    v.textContent = valor ? '1' : '0';
    celda.appendChild(v);
  } else {
    celda.setAttribute('t', 'inlineStr');
    const is = doc.createElementNS(SML_NS, 'is');
    const t = doc.createElementNS(SML_NS, 't');
    t.setAttribute('xml:space', 'preserve');
    t.textContent = valor == null ? '' : String(valor);
    is.appendChild(t);
    celda.appendChild(is);
  }
}

function ensureRow(doc: Document, sheetData: Element, fila: number): Element {
  const filas = Array.from(sheetData.children).filter((el) => el.localName === 'row');
  for (const r of filas) {
    if (Number(r.getAttribute('r')) === fila) return r;
  }
  const nueva = doc.createElementNS(SML_NS, 'row');
  nueva.setAttribute('r', String(fila));
  let before: Element | null = null;
  for (const r of filas) {
    if (Number(r.getAttribute('r')) > fila) { before = r; break; }
  }
  sheetData.insertBefore(nueva, before);
  return nueva;
}

function ensureCell(doc: Document, fila: Element, columna: string, numFila: number): Element {
  const direccion = `${columna}${numFila}`;
  const colIdx = colLetterToIndex(columna);
  const celdas = Array.from(fila.children).filter((el) => el.localName === 'c');
  for (const c of celdas) {
    if (c.getAttribute('r') === direccion) return c;
  }
  const nueva = doc.createElementNS(SML_NS, 'c');
  nueva.setAttribute('r', direccion);
  let before: Element | null = null;
  for (const c of celdas) {
    const ref = c.getAttribute('r') ?? '';
    const m = ref.match(/^([A-Za-z]+)\d+$/);
    if (m && colLetterToIndex(m[1]) > colIdx) { before = c; break; }
  }
  fila.insertBefore(nueva, before);
  return nueva;
}

// Desplaza hacia abajo (r += delta) todas las filas — y las celdas dentro de ellas — que estén
// estrictamente debajo de `desdeFila`. Se procesa de mayor a menor número de fila para no generar
// colisiones de atributos `r` duplicados mientras se reetiquetan.
function desplazarFilasDesde(sheetData: Element, desdeFila: number, delta: number) {
  const aDesplazar = Array.from(sheetData.children)
    .filter((el) => el.localName === 'row' && Number(el.getAttribute('r')) > desdeFila)
    .sort((a, b) => Number(b.getAttribute('r')) - Number(a.getAttribute('r')));
  for (const fila of aDesplazar) {
    const nuevaFila = Number(fila.getAttribute('r')) + delta;
    fila.setAttribute('r', String(nuevaFila));
    for (const celda of Array.from(fila.children).filter((el) => el.localName === 'c')) {
      const ref = celda.getAttribute('r');
      if (!ref) continue;
      const { columna } = parseDireccion(ref);
      celda.setAttribute('r', `${columna}${nuevaFila}`);
    }
  }
}

// Ajusta los rangos de <mergeCell> que caen (total o parcialmente) debajo del punto de inserción.
function desplazarMergesDesde(worksheet: Element, desdeFila: number, delta: number) {
  const mergeCellsEl = Array.from(worksheet.children).find((el) => el.localName === 'mergeCells');
  if (!mergeCellsEl) return;
  for (const mc of Array.from(mergeCellsEl.children)) {
    const ref = mc.getAttribute('ref');
    if (!ref) continue;
    const [inicioRef, finRef] = ref.split(':');
    const inicio = parseDireccion(inicioRef);
    const fin = finRef ? parseDireccion(finRef) : inicio;
    let cambio = false;
    let nuevoInicio = inicio.fila;
    let nuevoFin = fin.fila;
    if (inicio.fila > desdeFila) { nuevoInicio += delta; cambio = true; }
    if (fin.fila > desdeFila) { nuevoFin += delta; cambio = true; }
    if (cambio) {
      mc.setAttribute('ref', finRef ? `${inicio.columna}${nuevoInicio}:${fin.columna}${nuevoFin}` : `${inicio.columna}${nuevoInicio}`);
    }
  }
}

// Clona una fila existente como plantilla en blanco para una fila nueva: conserva el atributo de
// estilo (`s`) de cada celda (así la fila nueva se ve igual que la original) pero limpia su valor.
function clonarFilaComoPlantilla(filaOrigen: Element, nuevoNumero: number): Element {
  const clon = filaOrigen.cloneNode(true) as Element;
  clon.setAttribute('r', String(nuevoNumero));
  for (const celda of Array.from(clon.children).filter((el) => el.localName === 'c')) {
    const ref = celda.getAttribute('r');
    if (ref) {
      const { columna } = parseDireccion(ref);
      celda.setAttribute('r', `${columna}${nuevoNumero}`);
    }
    limpiarHijos(celda);
    celda.removeAttribute('t');
  }
  return clon;
}

// Inserta físicamente `cantidad` filas nuevas justo debajo de `despuesDeFila`, desplazando todo lo
// que está debajo (filas, celdas y fusiones) y copiando el formato de esa última fila base en las
// filas nuevas — así el estilo (bordes, colores) de la tabla se mantiene consistente al crecer.
function insertarFilasEnHoja(worksheet: Element, sheetData: Element, crecimiento: Crecimiento) {
  const { despuesDeFila, cantidad } = crecimiento;
  const filaBase = Array.from(sheetData.children).find(
    (el) => el.localName === 'row' && Number(el.getAttribute('r')) === despuesDeFila,
  );
  if (!filaBase) return; // sin fila base no hay estilo que copiar — se omite la inserción física

  desplazarFilasDesde(sheetData, despuesDeFila, cantidad);
  desplazarMergesDesde(worksheet, despuesDeFila, cantidad);

  const filaSiguiente = Array.from(sheetData.children).find(
    (el) => el.localName === 'row' && Number(el.getAttribute('r')) === despuesDeFila + cantidad + 1,
  ) ?? null;
  for (let i = 1; i <= cantidad; i++) {
    const nueva = clonarFilaComoPlantilla(filaBase, despuesDeFila + i);
    sheetData.insertBefore(nueva, filaSiguiente);
  }
}

// mergeCells siempre debe ir después de sheetData en el orden del esquema — insertarlo
// como hermano inmediato de sheetData garantiza que quede antes de cualquier otro elemento
// opcional posterior (hyperlinks, pageMargins, etc.), sin importar cuáles existan.
function ensureMergeCells(doc: Document, worksheet: Element, sheetData: Element): Element {
  const existentes = Array.from(worksheet.children).filter((el) => el.localName === 'mergeCells');
  if (existentes.length > 0) return existentes[0];
  const nuevo = doc.createElementNS(SML_NS, 'mergeCells');
  nuevo.setAttribute('count', '0');
  worksheet.insertBefore(nuevo, sheetData.nextSibling);
  return nuevo;
}

// Elementos que van DESPUÉS de <hyperlinks> en la secuencia de CT_Worksheet. El esquema es una
// `xsd:sequence`: colocar el elemento en el sitio equivocado hace que Excel no pueda leer la hoja
// y la reemplace entera.
const TRAS_HYPERLINKS = new Set([
  'printOptions', 'pageMargins', 'pageSetup', 'headerFooter', 'rowBreaks', 'colBreaks',
  'customProperties', 'cellWatches', 'ignoredErrors', 'smartTags', 'drawing', 'legacyDrawing',
  'legacyDrawingHF', 'drawingHF', 'picture', 'oleObjects', 'controls', 'webPublishItems',
  'tableParts', 'extLst',
]);

function ensureHyperlinks(doc: Document, worksheet: Element): Element {
  const existente = Array.from(worksheet.children).find((el) => el.localName === 'hyperlinks');
  if (existente) return existente;
  const nuevo = doc.createElementNS(SML_NS, 'hyperlinks');
  const posterior = Array.from(worksheet.children).find((el) => TRAS_HYPERLINKS.has(el.localName));
  worksheet.insertBefore(nuevo, posterior ?? null);
  return nuevo;
}

// Un hipervínculo en OOXML son dos piezas: el <hyperlink ref="B28" r:id="…"/> dentro de la hoja, y
// una relación EXTERNA (TargetMode="External") en el .rels de esa hoja, que es la que guarda la URL.
// Se devuelve el XML de relaciones ya actualizado para que el llamador lo escriba en el ZIP.
function agregarHipervinculo(doc: Document, worksheet: Element, relsDoc: Document, ref: string, url: string): void {
  // Reutilizar la relación si esa misma URL ya estaba enlazada en la hoja
  let rid: string | undefined;
  let max = 0;
  for (const rel of Array.from(relsDoc.getElementsByTagName('Relationship'))) {
    const id = rel.getAttribute('Id') ?? '';
    const m = id.match(/^rId(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
    if (rel.getAttribute('Target') === url && rel.getAttribute('TargetMode') === 'External') rid = id;
  }
  if (!rid) {
    rid = `rId${max + 1}`;
    const rel = relsDoc.createElementNS('http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship');
    rel.setAttribute('Id', rid);
    rel.setAttribute('Type', `${R_NS}/hyperlink`);
    rel.setAttribute('Target', url);
    rel.setAttribute('TargetMode', 'External');
    relsDoc.documentElement.appendChild(rel);
  }

  const contenedor = ensureHyperlinks(doc, worksheet);
  // Si la celda ya tenía un enlace, se repunta en vez de duplicar (dos <hyperlink> con el mismo
  // `ref` hacen que Excel repare el archivo).
  const previo = Array.from(contenedor.children).find((el) => el.getAttribute('ref') === ref);
  if (previo) {
    previo.setAttributeNS(R_NS, 'r:id', rid);
    return;
  }
  const el = doc.createElementNS(SML_NS, 'hyperlink');
  el.setAttribute('ref', ref);
  el.setAttributeNS(R_NS, 'r:id', rid);
  contenedor.appendChild(el);
}

interface RangoCeldas { c1: number; r1: number; c2: number; r2: number }

function parseRango(rango: string): RangoCeldas {
  const [ini, fin] = rango.split(':');
  const i = parseDireccion(ini);
  const f = fin ? parseDireccion(fin) : i;
  return { c1: colLetterToIndex(i.columna), r1: i.fila, c2: colLetterToIndex(f.columna), r2: f.fila };
}

function seSuperponen(a: RangoCeldas, b: RangoCeldas): boolean {
  return a.c1 <= b.c2 && b.c1 <= a.c2 && a.r1 <= b.r2 && b.r1 <= a.r2;
}

// Agrega una fusión nueva — si ya existe idéntica, no hace nada; si se SOLAPA con una fusión
// existente pero de otro tamaño (p. ej. la plantilla oficial asumía 3 hijos por grupo jerárquico y
// este grupo real solo tiene 2), la fusión vieja se elimina primero: dos <mergeCell> superpuestos
// son XML inválido y Excel repara/descarta el archivo al abrirlo.
// Elimina toda fusión que se solape con el rango dado. Si no hay <mergeCells> no hay nada que
// romper: la celda ya está partida en el archivo.
function quitarMerge(worksheet: Element, rango: string) {
  const mergeCells = Array.from(worksheet.children).find((el) => el.localName === 'mergeCells');
  if (!mergeCells) return;
  const objetivo = parseRango(rango);
  for (const existente of Array.from(mergeCells.children)) {
    const ref = existente.getAttribute('ref');
    if (ref && seSuperponen(objetivo, parseRango(ref))) mergeCells.removeChild(existente);
  }
  mergeCells.setAttribute('count', String(mergeCells.children.length));
}

// ¿La celda ya trae una fórmula del libro original? Cubre los dos casos de OOXML: la fórmula
// normal (`<f>texto</f>`) y las compartidas, donde solo la celda maestra lleva el texto y las demás
// del grupo traen `<f t="shared" si="N"/>` vacío — ambas se detectan por la presencia del hijo <f>.
function tieneFormula(celda: Element): boolean {
  return Array.from(celda.children).some((el) => el.localName === 'f');
}

function agregarMerge(doc: Document, worksheet: Element, sheetData: Element, rango: string) {
  const mergeCells = ensureMergeCells(doc, worksheet, sheetData);
  const nuevoRango = parseRango(rango);
  for (const existente of Array.from(mergeCells.children)) {
    const ref = existente.getAttribute('ref');
    if (!ref) continue;
    if (ref === rango) return; // idéntica — nada que hacer
    if (seSuperponen(nuevoRango, parseRango(ref))) mergeCells.removeChild(existente);
  }
  const nuevo = doc.createElementNS(SML_NS, 'mergeCell');
  nuevo.setAttribute('ref', rango);
  mergeCells.appendChild(nuevo);
  mergeCells.setAttribute('count', String(mergeCells.children.length));
}

async function extraerMimeYBuffer(dataUrl: string): Promise<{ mime: string; buffer: ArrayBuffer }> {
  const { fetchBinario } = await import('./fetchBinario');
  const res = await fetchBinario(dataUrl);
  const mime = res.headers.get('content-type') || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const buffer = await res.arrayBuffer();
  return { mime, buffer };
}

export interface ResultadoEdicion {
  /** El libro modificado, como data URL, en el mismo formato del original */
  dataUrl: string;
  /** Celdas que NO se escribieron por traer ya una fórmula del libro (referencias "Hoja!A1") */
  omitidasPorFormula: string[];
}

// Aplica todas las ediciones acumuladas (celdas + fusiones nuevas) directamente sobre el XML de
// cada hoja del ZIP, preservando estilos.xml, tema, macros y cualquier otra celda intacta.
/**
 * @param onProgress fracción 0–1 solo de esta fase (abrir ZIP → parchear hojas → comprimir).
 */
export async function aplicarEdicionesXlsx(
  dataUrl: string,
  ediciones: LibroEdits,
  onProgress?: (fraction: number) => void,
): Promise<ResultadoEdicion> {
  const omitidasPorFormula: string[] = [];
  onProgress?.(0);
  const { mime, buffer } = await extraerMimeYBuffer(dataUrl);
  const zip = await JSZip.loadAsync(buffer);
  const mapaHojas = await leerMapaHojas(zip);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  // styles.xml es común a todo el libro: se lee una sola vez para todas las hojas.
  const numericos = await estilosNumericos(zip);
  onProgress?.(0.08);

  const hojas = [...ediciones.entries()];
  const totalHojas = Math.max(1, hojas.length);
  let hojaIdx = 0;

  for (const [nombreHoja, edits] of hojas) {
    const path = mapaHojas.get(nombreHoja);
    if (!path) {
      hojaIdx++;
      continue; // hoja no encontrada en el libro asignado — se omite silenciosamente
    }
    const file = zip.file(path);
    if (!file) {
      hojaIdx++;
      continue;
    }
    const xmlStr = await file.async('string');
    const doc = parser.parseFromString(xmlStr, 'application/xml');
    const worksheet = doc.documentElement;
    const sheetData = worksheet.getElementsByTagName('sheetData')[0];
    if (!sheetData) {
      hojaIdx++;
      continue;
    }

    // Insertar filas de mayor a menor `despuesDeFila`: así cada inserción solo desplaza contenido
    // que está debajo de ella, sin invalidar los puntos de inserción de las tablas de más arriba.
    const crecimientosOrdenados = [...edits.crecimientos].sort((a, b) => b.despuesDeFila - a.despuesDeFila);
    for (const crecimiento of crecimientosOrdenados) {
      insertarFilasEnHoja(worksheet, sheetData, crecimiento);
    }

    // Romper fusiones ANTES de escribir: una celda partida escribe en columnas que la plantilla
    // traía fusionadas, y el orden inverso volvería a taparlas.
    for (const rango of edits.desfusiones) {
      quitarMerge(worksheet, rango);
    }

    for (const { columna, fila, valor, formula } of edits.celdas) {
      const filaEl = ensureRow(doc, sheetData, fila);
      const celda = ensureCell(doc, filaEl, columna, fila);
      // Una celda que YA trae fórmula en el libro oficial es intocable: su valor lo calcula el
      // propio Excel a partir de otras hojas, y sobrescribirla no solo pierde ese cálculo — rompe
      // la cadena que alimenta a todo lo que dependa de ella. La plantilla del CIAI tiene ~2300.
      if (tieneFormula(celda)) {
        omitidasPorFormula.push(`${nombreHoja}!${columna}${fila}`);
        continue;
      }
      const estilo = celda.getAttribute('s');
      aplicarValorCelda(doc, celda, valor, formula, estilo !== null && numericos.has(Number(estilo)));
    }
    for (const rango of edits.merges) {
      agregarMerge(doc, worksheet, sheetData, rango);
    }

    // Hipervínculos: además del <hyperlink> en la hoja hay que tocar SU archivo de relaciones,
    // que es donde vive la URL. Es la única edición que escribe una parte del ZIP distinta de la
    // propia hoja, por eso se resuelve aquí y no en aplicarValorCelda.
    if (edits.enlaces.size > 0) {
      const rutaRels = path.replace(/(worksheets\/)/, '$1_rels/') + '.rels';
      const relsFile = zip.file(rutaRels);
      const relsDoc = parser.parseFromString(
        relsFile
          ? await relsFile.async('string')
          : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
        'application/xml',
      );
      for (const [ref, url] of edits.enlaces) {
        agregarHipervinculo(doc, worksheet, relsDoc, ref, url);
      }
      zip.file(rutaRels, serializer.serializeToString(relsDoc));
    }

    zip.file(path, serializer.serializeToString(doc));

    // Las imágenes se aplican DESPUÉS de volcar el XML de la hoja: insertarImagenEnHoja puede
    // tener que añadirle el elemento <drawing>, y lo relee del zip ya actualizado.
    for (const imagen of edits.imagenes) {
      await insertarImagenEnHoja(zip, nombreHoja, imagen);
    }

    hojaIdx++;
    // 8% → 75% mientras se parchean hojas; el resto es la compresión DEFLATE.
    onProgress?.(0.08 + (hojaIdx / totalHojas) * 0.67);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const outBuffer = await zip.generateAsync(
    { type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => {
      // meta.percent es 0–100 de la generación del ZIP.
      onProgress?.(0.75 + (meta.percent / 100) * 0.25);
    },
  );
  onProgress?.(1);
  return { dataUrl: `data:${mime};base64,${outBuffer}`, omitidasPorFormula };
}

export { parseDireccion };
