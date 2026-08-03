import JSZip from 'jszip';

// Lector de imágenes incrustadas en un .xlsx/.xlsm.
//
// Las imágenes de Excel NO viven dentro de una celda: el binario está en `xl/media/` y su posición
// se declara aparte, en `xl/drawings/drawingN.xml`, mediante un *anchor* que dice entre qué celdas
// se dibuja. La cadena completa es:
//
//   hoja (sheetN.xml)  --<drawing r:id>-->  sheetN.xml.rels  -->  drawings/drawingN.xml
//   drawingN.xml  --<a:blip r:embed>-->  drawings/_rels/drawingN.xml.rels  -->  media/imagenN.ext
//
// Por eso un campo tipo `imagen` no se resuelve mirando su celda de `captura`: hay que buscar el
// anclaje cuya fila inicial coincide con la fila declarada del campo.

const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export interface ImagenIncrustada {
  /** Nombre del binario dentro del ZIP, ej. "xl/media/image2.png" */
  ruta: string;
  /** Extensión en minúsculas, sin punto: "png", "jpeg", "emf"… */
  formato: string;
  bytes: Uint8Array;
  /** Fila (1-based) donde arranca el anclaje */
  filaDesde: number;
  /** Fila (1-based) donde termina; igual a `filaDesde` en anclajes de una sola fila */
  filaHasta: number;
  /** Columna (1-based) donde arranca */
  columnaDesde: number;
  columnaHasta: number;
}

/** Formatos que un navegador puede mostrar directamente en un <img>. EMF/WMF son metarchivos
 * vectoriales de Windows: ni el navegador los pinta, ni Cloudinary los acepta como imagen. */
const FORMATOS_WEB = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);

export function esFormatoWeb(formato: string): boolean {
  return FORMATOS_WEB.has(formato.toLowerCase());
}

function parseRels(xml: string): Map<string, string> {
  const out = new Map<string, string>();
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  for (const rel of Array.from(doc.getElementsByTagName('Relationship'))) {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) out.set(id, target);
  }
  return out;
}

/** Resuelve un Target relativo ("../media/image2.png") contra la carpeta del archivo que lo declara. */
function resolverRuta(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const partes = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') partes.pop();
    else if (seg !== '.') partes.push(seg);
  }
  return partes.join('/');
}

function textoDe(el: Element | undefined, tag: string): number | undefined {
  if (!el) return undefined;
  const n = el.getElementsByTagName(tag)[0] ?? el.getElementsByTagName(`xdr:${tag}`)[0];
  const v = n?.textContent;
  return v == null ? undefined : Number(v);
}

async function rutaDeHoja(zip: JSZip, hoja: string): Promise<string | undefined> {
  const wbFile = zip.file('xl/workbook.xml');
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (!wbFile || !relsFile) return undefined;
  const rels = parseRels(await relsFile.async('string'));
  const doc = new DOMParser().parseFromString(await wbFile.async('string'), 'application/xml');
  for (const sheet of Array.from(doc.getElementsByTagName('sheet'))) {
    if (sheet.getAttribute('name') !== hoja) continue;
    const rid = sheet.getAttributeNS(R_NS, 'id') || sheet.getAttribute('r:id');
    const target = rid ? rels.get(rid) : undefined;
    if (target) return resolverRuta('xl/workbook.xml', target);
  }
  return undefined;
}

/** Todas las imágenes ancladas en una hoja, con la posición donde Excel las dibuja. */
export async function leerImagenesDeHoja(zip: JSZip, hoja: string): Promise<ImagenIncrustada[]> {
  const rutaHoja = await rutaDeHoja(zip, hoja);
  if (!rutaHoja) return [];

  const relsHojaFile = zip.file(rutaHoja.replace(/(worksheets\/)/, '$1_rels/') + '.rels');
  if (!relsHojaFile) return []; // hoja sin relaciones: no puede tener drawing

  const xmlHoja = await zip.file(rutaHoja)!.async('string');
  const docHoja = new DOMParser().parseFromString(xmlHoja, 'application/xml');
  const drawingEl = docHoja.getElementsByTagName('drawing')[0];
  const ridDrawing = drawingEl?.getAttributeNS(R_NS, 'id') || drawingEl?.getAttribute('r:id');
  if (!ridDrawing) return []; // la hoja no dibuja nada

  const relsHoja = parseRels(await relsHojaFile.async('string'));
  const targetDrawing = relsHoja.get(ridDrawing);
  if (!targetDrawing) return [];
  const rutaDrawing = resolverRuta(rutaHoja, targetDrawing);

  const drawingFile = zip.file(rutaDrawing);
  const relsDrawingFile = zip.file(rutaDrawing.replace(/(drawings\/)/, '$1_rels/') + '.rels');
  if (!drawingFile || !relsDrawingFile) return [];

  const relsDrawing = parseRels(await relsDrawingFile.async('string'));
  const docDrawing = new DOMParser().parseFromString(await drawingFile.async('string'), 'application/xml');

  const out: ImagenIncrustada[] = [];
  // twoCellAnchor (se estira entre dos celdas) y oneCellAnchor (ancla arriba-izquierda + tamaño fijo)
  for (const tag of ['twoCellAnchor', 'oneCellAnchor']) {
    const nodos = [
      ...Array.from(docDrawing.getElementsByTagName(tag)),
      ...Array.from(docDrawing.getElementsByTagName(`xdr:${tag}`)),
    ];
    for (const anchor of nodos) {
      const blip = anchor.getElementsByTagName('a:blip')[0] ?? anchor.getElementsByTagName('blip')[0];
      const embed = blip?.getAttributeNS(R_NS, 'embed') || blip?.getAttribute('r:embed');
      const target = embed ? relsDrawing.get(embed) : undefined;
      if (!target) continue;

      const rutaMedia = resolverRuta(rutaDrawing, target);
      const archivo = zip.file(rutaMedia);
      if (!archivo) continue;

      const from = (anchor.getElementsByTagName('xdr:from')[0] ?? anchor.getElementsByTagName('from')[0]) as Element | undefined;
      const to = (anchor.getElementsByTagName('xdr:to')[0] ?? anchor.getElementsByTagName('to')[0]) as Element | undefined;
      // OOXML cuenta filas y columnas desde 0; el resto del sistema trabaja en base 1.
      const filaDesde = (textoDe(from, 'row') ?? 0) + 1;
      const colDesde = (textoDe(from, 'col') ?? 0) + 1;

      out.push({
        ruta: rutaMedia,
        formato: (rutaMedia.split('.').pop() ?? '').toLowerCase(),
        bytes: await archivo.async('uint8array'),
        filaDesde,
        filaHasta: (textoDe(to, 'row') ?? textoDe(from, 'row') ?? 0) + 1,
        columnaDesde: colDesde,
        columnaHasta: (textoDe(to, 'col') ?? textoDe(from, 'col') ?? 0) + 1,
      });
    }
  }
  return out;
}

/** La imagen que corresponde a un campo tipo `imagen`, ubicada por la FILA de su captura: el
 * anclaje casi nunca empieza en la misma columna que el campo declara (la imagen se centra dentro
 * del recuadro), pero sí comparte la fila. */
export function imagenParaFila(imagenes: ImagenIncrustada[], fila: number): ImagenIncrustada | undefined {
  return imagenes.find((img) => fila >= img.filaDesde && fila <= img.filaHasta);
}
