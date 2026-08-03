import type JSZip from 'jszip';

// Incrusta imágenes en un .xlsx — el inverso de xlsxImageReader.
//
// Una imagen no se "escribe en una celda": hay que tocar hasta seis partes del paquete OOXML.
//   1. xl/media/imagenN.ext              el binario
//   2. [Content_Types].xml               un <Default> por extensión, o Excel rechaza el archivo
//   3. xl/drawings/drawingN.xml          el anclaje (entre qué celdas se dibuja)
//   4. xl/drawings/_rels/…rels           blip r:embed -> media
//   5. xl/worksheets/_rels/…rels         hoja -> drawing
//   6. sheetN.xml <drawing r:id>         y en su posición correcta del esquema
//
// Cuando la hoja YA tiene un dibujo con un anclaje que cubre la fila destino (el caso normal: la
// plantilla oficial trae un mapa de muestra), se reutiliza ese anclaje y solo se repunta su imagen.
// Así la imagen nueva hereda exactamente la posición y el tamaño que el autor de la plantilla
// definió, en vez de superponerse a la vieja.

const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const XDR_NS = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';

/** Una columna de Excel mide 9525 EMU por píxel; 64 px es el ancho por defecto. Sirve solo para
 * dar tamaño a un anclaje nuevo — cuando se reutiliza uno existente, no se usa. */
const EMU_POR_COLUMNA = 64 * 9525;
const EMU_POR_FILA = 20 * 9525;

export interface ImagenAInsertar {
  /** Fila (1-based) donde debe quedar la imagen */
  fila: number;
  /** Columna (1-based) donde arranca */
  columna: number;
  /** Columnas que abarca, si hay que crear el anclaje desde cero */
  abarcaColumnas: number;
  bytes: Uint8Array;
  /** Extensión sin punto: "png", "jpeg"… */
  formato: string;
}

function letraAIndice(letra: string): number {
  let n = 0;
  for (const ch of letra.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function columnaAIndice(columna: string): number {
  return letraAIndice(columna);
}

function parseXml(texto: string): Document {
  return new DOMParser().parseFromString(texto, 'application/xml');
}

function serializar(doc: Document): string {
  return new XMLSerializer().serializeToString(doc);
}

function resolverRuta(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const partes = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') partes.pop();
    else if (seg !== '.') partes.push(seg);
  }
  return partes.join('/');
}

async function rutaDeHoja(zip: JSZip, hoja: string): Promise<string | undefined> {
  const wb = zip.file('xl/workbook.xml');
  const rels = zip.file('xl/_rels/workbook.xml.rels');
  if (!wb || !rels) return undefined;
  const relsDoc = parseXml(await rels.async('string'));
  const mapa = new Map<string, string>();
  for (const rel of Array.from(relsDoc.getElementsByTagName('Relationship'))) {
    const id = rel.getAttribute('Id');
    const tg = rel.getAttribute('Target');
    if (id && tg) mapa.set(id, tg);
  }
  const wbDoc = parseXml(await wb.async('string'));
  for (const sheet of Array.from(wbDoc.getElementsByTagName('sheet'))) {
    if (sheet.getAttribute('name') !== hoja) continue;
    const rid = sheet.getAttributeNS(R_NS, 'id') || sheet.getAttribute('r:id');
    const tg = rid ? mapa.get(rid) : undefined;
    if (tg) return resolverRuta('xl/workbook.xml', tg);
  }
  return undefined;
}

/** Siguiente Id libre de la forma rIdN dentro de un documento de relaciones. */
function siguienteRId(doc: Document): string {
  let max = 0;
  for (const rel of Array.from(doc.getElementsByTagName('Relationship'))) {
    const m = (rel.getAttribute('Id') ?? '').match(/^rId(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `rId${max + 1}`;
}

function agregarRelacion(doc: Document, tipo: string, target: string): string {
  const id = siguienteRId(doc);
  const rel = doc.createElementNS('http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship');
  rel.setAttribute('Id', id);
  rel.setAttribute('Type', tipo);
  rel.setAttribute('Target', target);
  doc.documentElement.appendChild(rel);
  return id;
}

/** Excel exige un <Default> por extensión de binario, o declara el archivo dañado al abrirlo. */
async function asegurarContentType(zip: JSZip, extension: string): Promise<void> {
  const file = zip.file('[Content_Types].xml');
  if (!file) return;
  const doc = parseXml(await file.async('string'));
  const ext = extension.toLowerCase();
  for (const d of Array.from(doc.getElementsByTagName('Default'))) {
    if ((d.getAttribute('Extension') ?? '').toLowerCase() === ext) return;
  }
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
  const el = doc.createElementNS(CT_NS, 'Default');
  el.setAttribute('Extension', ext);
  el.setAttribute('ContentType', mime);
  doc.documentElement.insertBefore(el, doc.documentElement.firstChild);
  zip.file('[Content_Types].xml', serializar(doc));
}

/** Nombre libre dentro de xl/media para no pisar una imagen existente. */
function siguienteNombreMedia(zip: JSZip, extension: string): string {
  let n = 1;
  while (zip.file(`xl/media/pf_imagen${n}.${extension}`)) n++;
  return `pf_imagen${n}.${extension}`;
}

// Elementos que, según la secuencia de CT_Worksheet (ECMA-376 §18.3.1.99), van DESPUÉS de
// <drawing>. El esquema es una `xsd:sequence`: el orden no es cosmético — colgar <drawing> al final
// cuando la hoja termina en <extLst> hace que Excel no pueda leer la parte y la reemplace entera,
// dejando la hoja en blanco. Ese fue exactamente el fallo.
const TRAS_DRAWING = new Set([
  'legacyDrawing', 'legacyDrawingHF', 'drawingHF', 'picture', 'oleObjects',
  'controls', 'webPublishItems', 'tableParts', 'extLst',
]);

/** Inserta `nuevo` en la posición que le toca dentro del worksheet, no simplemente al final. */
function insertarEnOrden(worksheet: Element, nuevo: Element): void {
  const posterior = Array.from(worksheet.children).find((el) => TRAS_DRAWING.has(el.localName));
  worksheet.insertBefore(nuevo, posterior ?? null);
}

/** Crea el drawing de una hoja que aún no tiene ninguno, y lo enlaza desde el XML de la hoja. */
async function crearDrawing(zip: JSZip, rutaHoja: string, docHoja: Document): Promise<string> {
  let n = 1;
  while (zip.file(`xl/drawings/drawing${n}.xml`)) n++;
  const rutaDrawing = `xl/drawings/drawing${n}.xml`;

  zip.file(rutaDrawing, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="${XDR_NS}" xmlns:a="${A_NS}"/>`);
  zip.file(`xl/drawings/_rels/drawing${n}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);

  const rutaRelsHoja = rutaHoja.replace(/(worksheets\/)/, '$1_rels/') + '.rels';
  const relsFile = zip.file(rutaRelsHoja);
  const relsDoc = relsFile
    ? parseXml(await relsFile.async('string'))
    : parseXml('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
  const rid = agregarRelacion(relsDoc, `${R_NS}/drawing`, `../drawings/drawing${n}.xml`);
  zip.file(rutaRelsHoja, serializar(relsDoc));

  const el = docHoja.createElementNS('http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'drawing');
  el.setAttributeNS(R_NS, 'r:id', rid);
  insertarEnOrden(docHoja.documentElement, el);

  return rutaDrawing;
}

function crearAnchor(doc: Document, img: ImagenAInsertar, rid: string, idForma: number): Element {
  const el = (nombre: string) => doc.createElementNS(XDR_NS, `xdr:${nombre}`);
  const elA = (nombre: string) => doc.createElementNS(A_NS, `a:${nombre}`);
  const conTexto = (nombre: string, valor: string | number) => {
    const n = el(nombre);
    n.textContent = String(valor);
    return n;
  };

  const anchor = el('twoCellAnchor');
  anchor.setAttribute('editAs', 'oneCell');

  // OOXML cuenta filas y columnas desde 0
  const from = el('from');
  from.append(conTexto('col', img.columna - 1), conTexto('colOff', 0), conTexto('row', img.fila - 1), conTexto('rowOff', 0));
  const to = el('to');
  to.append(
    conTexto('col', img.columna - 1 + Math.max(img.abarcaColumnas, 1)),
    conTexto('colOff', 0),
    conTexto('row', img.fila),
    conTexto('rowOff', 0),
  );

  const pic = el('pic');
  const nvPicPr = el('nvPicPr');
  const cNvPr = el('cNvPr');
  cNvPr.setAttribute('id', String(idForma));
  cNvPr.setAttribute('name', `Imagen ${idForma}`);
  const cNvPicPr = el('cNvPicPr');
  nvPicPr.append(cNvPr, cNvPicPr);

  const blipFill = el('blipFill');
  const blip = elA('blip');
  blip.setAttributeNS(R_NS, 'r:embed', rid);
  const stretch = elA('stretch');
  stretch.appendChild(elA('fillRect'));
  blipFill.append(blip, stretch);

  const spPr = el('spPr');
  const xfrm = elA('xfrm');
  const off = elA('off');
  off.setAttribute('x', '0');
  off.setAttribute('y', '0');
  const ext = elA('ext');
  ext.setAttribute('cx', String(EMU_POR_COLUMNA * Math.max(img.abarcaColumnas, 1)));
  ext.setAttribute('cy', String(EMU_POR_FILA));
  xfrm.append(off, ext);
  const prstGeom = elA('prstGeom');
  prstGeom.setAttribute('prst', 'rect');
  prstGeom.appendChild(elA('avLst'));
  spPr.append(xfrm, prstGeom);

  pic.append(nvPicPr, blipFill, spPr);
  // El orden del esquema es estricto: from, to, pic, clientData. Sin `from`/`to` el anclaje es
  // inválido y Excel abre el archivo en modo "[Reparado]" descartando la imagen.
  anchor.append(from, to, pic, el('clientData'));
  return anchor;
}

/** ¿Este anclaje cubre la fila destino? Las filas del XML van en base 0. */
function anchorCubreFila(anchor: Element, fila: number): boolean {
  const leer = (tag: 'from' | 'to') => {
    const n = anchor.getElementsByTagName(`xdr:${tag}`)[0] ?? anchor.getElementsByTagName(tag)[0];
    if (!n) return undefined;
    const r = n.getElementsByTagName('xdr:row')[0] ?? n.getElementsByTagName('row')[0];
    return r?.textContent == null ? undefined : Number(r.textContent) + 1;
  };
  const desde = leer('from');
  const hasta = leer('to') ?? desde;
  return desde !== undefined && fila >= desde && fila <= (hasta ?? desde);
}

/**
 * Inserta (o reemplaza) una imagen en la hoja indicada. Devuelve true si se aplicó.
 */
export async function insertarImagenEnHoja(zip: JSZip, hoja: string, img: ImagenAInsertar): Promise<boolean> {
  const rutaHoja = await rutaDeHoja(zip, hoja);
  if (!rutaHoja) return false;

  const hojaFile = zip.file(rutaHoja);
  if (!hojaFile) return false;
  const docHoja = parseXml(await hojaFile.async('string'));

  // ¿La hoja ya dibuja algo?
  let rutaDrawing: string | undefined;
  const drawingEl = docHoja.getElementsByTagName('drawing')[0];
  const ridDrawing = drawingEl?.getAttributeNS(R_NS, 'id') || drawingEl?.getAttribute('r:id');
  if (ridDrawing) {
    const relsFile = zip.file(rutaHoja.replace(/(worksheets\/)/, '$1_rels/') + '.rels');
    if (relsFile) {
      const relsDoc = parseXml(await relsFile.async('string'));
      for (const rel of Array.from(relsDoc.getElementsByTagName('Relationship'))) {
        if (rel.getAttribute('Id') === ridDrawing) rutaDrawing = resolverRuta(rutaHoja, rel.getAttribute('Target') ?? '');
      }
    }
  } else {
    rutaDrawing = await crearDrawing(zip, rutaHoja, docHoja);
    zip.file(rutaHoja, serializar(docHoja));
  }
  if (!rutaDrawing) return false;

  const drawingFile = zip.file(rutaDrawing);
  if (!drawingFile) return false;
  const rutaRelsDrawing = rutaDrawing.replace(/(drawings\/)/, '$1_rels/') + '.rels';
  const relsDrawingFile = zip.file(rutaRelsDrawing);
  const docDrawing = parseXml(await drawingFile.async('string'));
  const docRels = relsDrawingFile
    ? parseXml(await relsDrawingFile.async('string'))
    : parseXml('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');

  // El binario y su declaración de tipo
  const ext = img.formato.toLowerCase() === 'jpg' ? 'jpeg' : img.formato.toLowerCase();
  const nombreMedia = siguienteNombreMedia(zip, ext);
  zip.file(`xl/media/${nombreMedia}`, img.bytes);
  await asegurarContentType(zip, ext);

  const rid = agregarRelacion(docRels, `${R_NS}/image`, `../media/${nombreMedia}`);

  // Reutilizar el anclaje que ya cubre esa fila, si existe: hereda posición y tamaño originales.
  const anchors = [
    ...Array.from(docDrawing.getElementsByTagName('xdr:twoCellAnchor')),
    ...Array.from(docDrawing.getElementsByTagName('twoCellAnchor')),
    ...Array.from(docDrawing.getElementsByTagName('xdr:oneCellAnchor')),
    ...Array.from(docDrawing.getElementsByTagName('oneCellAnchor')),
  ];
  const existente = anchors.find((a) => anchorCubreFila(a, img.fila));

  if (existente) {
    const blip = existente.getElementsByTagName('a:blip')[0] ?? existente.getElementsByTagName('blip')[0];
    if (blip) blip.setAttributeNS(R_NS, 'r:embed', rid);
    else existente.appendChild(crearAnchor(docDrawing, img, rid, anchors.length + 1));
  } else {
    docDrawing.documentElement.appendChild(crearAnchor(docDrawing, img, rid, anchors.length + 1));
  }

  zip.file(rutaDrawing, serializar(docDrawing));
  zip.file(rutaRelsDrawing, serializar(docRels));
  return true;
}
