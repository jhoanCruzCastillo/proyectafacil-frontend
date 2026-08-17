import JSZip from 'jszip';

/**
 * Controles de formulario / ActiveX (OptionButton, CheckBox) en un .xlsx/.xlsm.
 *
 * Los "puntitos" del Excel oficial NO viven en la celda de captura: el estado está en
 * `xl/ctrlProps` (form controls) o en una celda enlazada vía VML `FmlaLink` (ActiveX),
 * mientras el control se dibuja encima de la celda visible (G82, I59, …).
 *
 * Volcar solo mirando `<c r="G82">` deja el booleano vacío. Este módulo indexa por la
 * celda donde se VE el control, resolviendo el valor real (enlace o `checked`).
 */

const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Clave `G82` (columna letra + fila 1-based) → marcado */
export type IndiceControlesBooleanos = Map<string, boolean>;

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

function resolverRuta(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const partes = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') partes.pop();
    else if (seg !== '.') partes.push(seg);
  }
  return partes.join('/');
}

function colALetra(n1: number): string {
  let n = n1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
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

/** Interpreta el valor de una celda enlazada (`t="b"` → "true"/"false", o 1/0, o Sí/No). */
export function celdaComoMarcado(valor: string | undefined): boolean | undefined {
  if (valor == null) return undefined;
  const v = valor.trim().toLowerCase();
  if (v === '') return undefined;
  if (v === 'true' || v === '1' || v === 'sí' || v === 'si' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return undefined;
}

function primerTexto(el: Element, local: string): string | undefined {
  const nodes = [
    ...Array.from(el.getElementsByTagName(local)),
    ...Array.from(el.getElementsByTagName(`xdr:${local}`)),
    ...Array.from(el.getElementsByTagName(`x:${local}`)),
  ];
  const t = nodes[0]?.textContent?.trim();
  return t || undefined;
}

/**
 * Índice de controles booleanos de una hoja, por celda visible (`G82` → true/false).
 *
 * @param valorCelda lee el valor ya parseado del libro (para resolver `FmlaLink`)
 */
export async function indiceControlesBooleanos(
  zip: JSZip,
  hoja: string,
  valorCelda: (ref: string) => string | undefined,
): Promise<IndiceControlesBooleanos> {
  const out: IndiceControlesBooleanos = new Map();
  const rutaHoja = await rutaDeHoja(zip, hoja);
  if (!rutaHoja) return out;

  const hojaFile = zip.file(rutaHoja);
  if (!hojaFile) return out;
  const xmlHoja = await hojaFile.async('string');
  const relsPath = rutaHoja.replace(/(worksheets\/)/, '$1_rels/') + '.rels';
  const relsFile = zip.file(relsPath);
  const relsHoja = relsFile ? parseRels(await relsFile.async('string')) : new Map<string, string>();

  // 1) Form controls: ancla en <controls> + estado en ctrlProp
  const docHoja = new DOMParser().parseFromString(xmlHoja, 'application/xml');
  for (const ctrl of Array.from(docHoja.getElementsByTagName('control'))) {
    const rid = ctrl.getAttributeNS(R_NS, 'id') || ctrl.getAttribute('r:id');
    if (!rid) continue;
    const target = relsHoja.get(rid);
    if (!target) continue;

    const from = (ctrl.getElementsByTagName('xdr:from')[0]
      ?? ctrl.getElementsByTagName('from')[0]) as Element | undefined;
    if (!from) continue;
    const col0 = Number(primerTexto(from, 'col') ?? NaN);
    const row0 = Number(primerTexto(from, 'row') ?? NaN);
    if (!Number.isFinite(col0) || !Number.isFinite(row0)) continue;
    const clave = `${colALetra(col0 + 1)}${row0 + 1}`;

    if (target.includes('ctrlProp')) {
      const rutaProp = resolverRuta(rutaHoja, target);
      const propXml = await zip.file(rutaProp)?.async('string');
      if (!propXml) continue;
      // Solo CheckBox / OptionButton (Drop y otros no son booleanos de celda).
      if (!/objectType="(CheckBox|OptionButton|Radio)"/i.test(propXml)) continue;
      const marcado = /checked="Checked"/i.test(propXml);
      // Si ya había un ActiveX en la misma celda, no pisar un true con un false vacío.
      if (!out.has(clave) || marcado) out.set(clave, marcado);
      continue;
    }
  }

  // 2) ActiveX vía VML (legacyDrawing): Pict + FmlaLink a celda oculta (XFA82, …)
  const legacy = docHoja.getElementsByTagName('legacyDrawing')[0];
  const ridVml = legacy?.getAttributeNS(R_NS, 'id') || legacy?.getAttribute('r:id');
  if (ridVml) {
    const targetVml = relsHoja.get(ridVml);
    if (targetVml) {
      const rutaVml = resolverRuta(rutaHoja, targetVml);
      const vmlXml = await zip.file(rutaVml)?.async('string');
      if (vmlXml) {
        // VML a menudo no es XML estricto; regex es más tolerante que DOMParser.
        const bloques = vmlXml.matchAll(/<x:ClientData\b[^>]*>([\s\S]*?)<\/x:ClientData>/gi);
        for (const m of bloques) {
          const body = m[1];
          const attrs = m[0].slice(0, m[0].indexOf('>'));
          const objType = /ObjectType="([^"]+)"/i.exec(attrs)?.[1] ?? '';
          // Pict = ActiveX dibujado; Checkbox/Radio = form control legacy en VML.
          if (!/^(Pict|Checkbox|Radio|OptionButton)$/i.test(objType)) continue;

          const fmla = /<x:FmlaLink>\s*([^<]+)<\/x:FmlaLink>/i.exec(body)?.[1]?.trim();
          const anchor = /<x:Anchor>\s*([^<]+)<\/x:Anchor>/i.exec(body)?.[1]?.trim();
          if (!anchor) continue;
          const parts = anchor.split(',').map((x) => Number(x.trim()));
          if (parts.length < 3 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[2])) continue;
          const clave = `${colALetra(parts[0] + 1)}${parts[2] + 1}`;

          let marcado: boolean | undefined;
          if (fmla) {
            const ref = fmla.replace(/\$/g, '').replace(/^.*!/, '');
            marcado = celdaComoMarcado(valorCelda(ref));
          }
          if (marcado === undefined) {
            const checked = /<x:Checked>\s*([^<]+)<\/x:Checked>/i.exec(body)?.[1]?.trim();
            if (checked != null && checked !== '' && checked !== '0') marcado = true;
            else if (checked === '0') marcado = false;
          }
          if (marcado === undefined) continue;
          if (!out.has(clave) || marcado) out.set(clave, marcado);
        }
      }
    }
  }

  return out;
}

/**
 * Resuelve el valor de un booleano en volcado: celda con texto, booleano nativo, o control
 * dibujado sobre la celda (y, si `parSiNo`, el OptionButton de la columna siguiente = No).
 */
export function valorBooleanoVolcado(opts: {
  textoCelda: string;
  columna: string;
  fila: number;
  abarcaColumnas?: number;
  etiquetas?: { true: string; false: string } | null;
  controles: IndiceControlesBooleanos;
  /**
   * Par Sí/No (campo suelto o captura que abarca 2 cols): la columna de captura es Sí;
   * la siguiente marcada cuenta como No. No usar en casillas Bajo/Medio/Alto de una misma fila.
   */
  parSiNo?: boolean;
}): string {
  const { textoCelda, columna, fila, etiquetas, controles } = opts;
  const abarca = Math.max(1, opts.abarcaColumnas ?? 1);
  const parSiNo = opts.parSiNo ?? (abarca >= 2 && !!etiquetas);
  const trueL = etiquetas?.true ?? 'Sí';
  const falseL = etiquetas?.false ?? 'No';

  const t = textoCelda.trim();
  if (t !== '') {
    const nativo = celdaComoMarcado(t);
    if (nativo === true) return trueL;
    if (nativo === false) return etiquetas ? falseL : t;
    return t;
  }

  const letras: string[] = [];
  let col = columna.toUpperCase();
  for (let i = 0; i < abarca; i++) {
    letras.push(col);
    col = siguienteColumna(col);
  }

  const estados = letras.map((L) => controles.get(`${L}${fila}`));

  if (parSiNo) {
    if (estados[0] === true) return trueL;
    if (abarca >= 2 && estados[1] === true) return falseL;
    const next = controles.get(`${siguienteColumna(letras[0])}${fila}`);
    if (next === true) return falseL;
    return '';
  }

  // Casilla: solo la celda de captura.
  if (estados[0] === true) return trueL;
  return '';
}

function siguienteColumna(letra: string): string {
  const chars = letra.toUpperCase().split('');
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] !== 'Z') {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join('');
    }
    chars[i] = 'A';
    i--;
  }
  return `A${chars.join('')}`;
}
