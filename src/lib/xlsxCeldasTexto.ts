// Parser por texto (sin DOMParser) de las partes PESADAS de un .xlsx: las celdas de una hoja
// (`<sheetData>`) y `sharedStrings.xml`. Existe por rendimiento, medido contra el Excel real de
// FTE-EBR-V03 (2026-09-26): su hoja "Padron_web" trae 1,227,717 celdas (46.9 MB de XML) y
// parsearla con DOMParser bloqueaba el hilo principal 7.5 s — este escaneo recorre las mismas
// celdas en ~100 ms. Además, al no depender del DOM, corre igual dentro del Web Worker
// (excelVivoWorker.ts), donde DOMParser no existe.
//
// Contrato: producir EXACTAMENTE lo mismo que producía el parseo con DOMParser (mismos Maps, mismas
// claves, mismos valores). Por eso replica las reglas de un parser XML que importan acá: decodifica
// entidades, normaliza fines de línea (\r\n -> \n) antes de decodificarlas, y solo reconoce elementos
// sin prefijo (igual que getElementsByTagName('c')). Las partes chicas y con namespaces (fusiones,
// validaciones x14) siguen yendo por DOMParser en xlsxXmlReader.ts — ahí no hay costo que ahorrar.
import type { CeldaLeida, HojaParseada } from './xlsxXmlReader';

// Formatos de número integrados de OOXML que representan fecha y/u hora (ECMA-376, §18.8.30).
const BUILTIN_FECHA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

// Códigos de los formatos numéricos integrados que declaran decimales o porcentaje (ECMA-376,
// §18.8.30). El archivo puede redefinirlos en <numFmts>; esta tabla es el respaldo cuando no lo hace.
const BUILTIN_CODIGOS: Record<number, string> = {
  2: '0.00', 4: '#,##0.00', 9: '0%', 10: '0.00%', 39: '#,##0.00', 40: '#,##0.00', 43: '#,##0.00', 44: '#,##0.00',
};

// El código de formato aplicado a la celda: el que declare el archivo tiene prioridad sobre el
// integrado, porque un .xlsx puede redefinir cualquier numFmtId en <numFmts>.
export function codigoDeFormato(numFmtId: number, codigoPorNumFmt: Map<number, string>): string | undefined {
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

export function indiceColumna(letra: string): number {
  let n = 0;
  for (const ch of letra.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

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

// Referencia A1 dentro de una fórmula, con sus `$` opcionales. Se usa para trasladar las fórmulas
// compartidas; por eso importa distinguir la parte absoluta (con `$`, no se mueve) de la relativa.
const RE_REF_EN_FORMULA = /(\$?)([A-Z]{1,3})(\$?)([0-9]{1,7})/g;

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

function partirRef(ref: string): { col: number; fila: number } | undefined {
  const m = ref.match(/^([A-Z]+)([0-9]+)$/i);
  return m ? { col: indiceColumna(m[1]), fila: Number(m[2]) } : undefined;
}

// --- Primitivas de lectura XML por texto ---

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const RE_ENTIDAD = /&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g;

/** Texto de un nodo tal como lo daría `textContent`: fines de línea normalizados (un parser XML
 * convierte \r\n y \r sueltos en \n ANTES de resolver entidades — un `&#13;` explícito sí sobrevive)
 * y entidades resueltas. Rápido en el caso común: casi ningún valor trae `&` ni `\r`. */
function textoXml(crudo: string): string {
  let s = crudo;
  if (s.includes('\r')) s = s.replace(/\r\n?/g, '\n');
  if (!s.includes('&')) return s;
  return s.replace(RE_ENTIDAD, (_, e: string) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(cp);
    }
    return ENTIDADES[e];
  });
}

function esFinDeNombre(code: number): boolean {
  // espacio, tab, \n, \r, '>', '/'
  return code === 32 || code === 9 || code === 10 || code === 13 || code === 62 || code === 47;
}

/** Posición del primer `<nombre` (sin prefijo, nombre completo) desde `desde`, o -1. */
function buscarApertura(xml: string, nombre: string, desde: number, hasta: number): number {
  const patron = '<' + nombre;
  let i = desde;
  for (;;) {
    const p = xml.indexOf(patron, i);
    if (p < 0 || p >= hasta) return -1;
    if (esFinDeNombre(xml.charCodeAt(p + patron.length))) return p;
    i = p + patron.length;
  }
}

interface Elemento {
  /** Atributos crudos (entre el nombre y el cierre de la etiqueta de apertura) */
  atributos: string;
  /** Contenido interno crudo, '' si es auto-cerrado */
  interno: string;
  /** Posición justo después del elemento completo */
  fin: number;
}

/** Lee el elemento `nombre` que abre en `inicio` (debe ser la posición de `<nombre`). Asume que no
 * hay elementos homónimos anidados — cierto para todos los que se leen acá (c, f, v, is, t, si). */
function leerElemento(xml: string, nombre: string, inicio: number): Elemento {
  const cierreApertura = xml.indexOf('>', inicio);
  const autoCerrado = xml.charCodeAt(cierreApertura - 1) === 47;
  const atributos = xml.slice(inicio + nombre.length + 1, autoCerrado ? cierreApertura - 1 : cierreApertura);
  if (autoCerrado) return { atributos, interno: '', fin: cierreApertura + 1 };
  const etiquetaCierre = '</' + nombre + '>';
  const cierre = xml.indexOf(etiquetaCierre, cierreApertura + 1);
  const finInterno = cierre < 0 ? xml.length : cierre;
  return { atributos, interno: xml.slice(cierreApertura + 1, finInterno), fin: finInterno + etiquetaCierre.length };
}

/** Valor del atributo `nombre` (nombre calificado exacto, como getAttribute) o null si no está. */
function atributo(atributos: string, nombre: string): string | null {
  let i = 0;
  for (;;) {
    const p = atributos.indexOf(nombre, i);
    if (p < 0) return null;
    i = p + nombre.length;
    // Debe ser un nombre completo: precedido por espacio y seguido de `=` (con espacios opcionales)
    const antes = atributos.charCodeAt(p - 1);
    if (p > 0 && !(antes === 32 || antes === 9 || antes === 10 || antes === 13)) continue;
    let j = i;
    while (atributos.charCodeAt(j) === 32 || atributos.charCodeAt(j) === 9 || atributos.charCodeAt(j) === 10 || atributos.charCodeAt(j) === 13) j++;
    if (atributos[j] !== '=') continue;
    j++;
    while (atributos.charCodeAt(j) === 32 || atributos.charCodeAt(j) === 9 || atributos.charCodeAt(j) === 10 || atributos.charCodeAt(j) === 13) j++;
    const comilla = atributos[j];
    if (comilla !== '"' && comilla !== "'") continue;
    const cierre = atributos.indexOf(comilla, j + 1);
    if (cierre < 0) return null;
    return textoXml(atributos.slice(j + 1, cierre));
  }
}

/** Concatenación de todos los `<t>` descendientes, igual que `textoDe()` con DOM: un `<si>`/`<is>`
 * puede traer varios (formato mixto, y también las lecturas fonéticas `<rPh>`). */
function textoDeRuns(interno: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const p = buscarApertura(interno, 't', i, interno.length);
    if (p < 0) return out;
    const el = leerElemento(interno, 't', p);
    out += textoXml(el.interno);
    i = el.fin;
  }
}

export function parseSharedStringsTexto(xml: string | null): string[] {
  if (!xml) return [];
  const out: string[] = [];
  let i = 0;
  for (;;) {
    const p = buscarApertura(xml, 'si', i, xml.length);
    if (p < 0) return out;
    const el = leerElemento(xml, 'si', p);
    out.push(textoDeRuns(el.interno));
    i = el.fin;
  }
}

/** Divide el XML de una hoja en la sección de celdas (`<sheetData>…</sheetData>`, lo pesado) y el
 * resto del documento (columnas, fusiones, validaciones… — chico, válido como XML por sí solo). */
export function separarSheetData(xml: string): { celdas: string; resto: string } {
  const inicio = buscarApertura(xml, 'sheetData', 0, xml.length);
  if (inicio < 0) return { celdas: '', resto: xml };
  const el = leerElemento(xml, 'sheetData', inicio);
  return { celdas: el.interno, resto: xml.slice(0, inicio) + xml.slice(el.fin) };
}

type FormatoCelda = HojaParseada['formatos'] extends Map<string, infer F> ? F : never;

export type CeldasParseadas = Pick<HojaParseada, 'celdas' | 'estilos' | 'formulas' | 'formatos' | 'filaMaxima'>;

/** Celdas de una hoja a partir del contenido de su `<sheetData>` (ver separarSheetData). */
export function parseCeldasTexto(
  xmlCeldas: string,
  shared: string[],
  numFmtPorEstilo: number[],
  codigoPorNumFmt: Map<number, string>,
): CeldasParseadas {
  const celdas = new Map<string, CeldaLeida>();
  const estilos = new Map<string, number>();
  const formulas = new Map<string, string>();
  const formatos = new Map<string, FormatoCelda>();
  // Fórmulas compartidas: `si` -> celda que sí trae el texto, y las que solo la referencian.
  const maestras = new Map<string, { formula: string; ref: string }>();
  const pendientes: { ref: string; si: string }[] = [];
  let filaMaxima = 0;

  // El formato depende solo del numFmtId de la celda, y un libro trae unos pocos cientos de
  // estilos — calcularlo una vez por numFmtId en vez de una vez por celda (1.2M en el padrón).
  const formatoPorNumFmt = new Map<number, { formato: FormatoCelda; codigo: string | undefined; guardar: boolean }>();
  function formatoDe(numFmt: number) {
    let f = formatoPorNumFmt.get(numFmt);
    if (!f) {
      const codigo = codigoDeFormato(numFmt, codigoPorNumFmt);
      const decimales = decimalesDeFormato(numFmt, codigoPorNumFmt);
      const esPorcentaje = esPorcentajeFormato(numFmt, codigoPorNumFmt);
      const formato = { ...analizarFormato(numFmt, codigoPorNumFmt), esPorcentaje, decimales, codigo };
      // General (0) y Texto (49) no aportan máscara; el resto sí (fecha, %, `"E-"00`, `0.00`, …).
      const guardar = formato.esFecha || esPorcentaje || decimales !== undefined || !!(codigo && numFmt !== 0 && numFmt !== 49);
      f = { formato, codigo, guardar };
      formatoPorNumFmt.set(numFmt, f);
    }
    return f;
  }

  let i = 0;
  const largo = xmlCeldas.length;
  for (;;) {
    const p = buscarApertura(xmlCeldas, 'c', i, largo);
    if (p < 0) break;
    const c = leerElemento(xmlCeldas, 'c', p);
    i = c.fin;

    const ref = atributo(c.atributos, 'r');
    if (!ref) continue;
    const tipo = atributo(c.atributos, 't');

    const filaDeRef = Number(ref.match(/[0-9]+$/)?.[0]);
    if (Number.isFinite(filaDeRef) && filaDeRef > filaMaxima) filaMaxima = filaDeRef;

    const estiloAttr = atributo(c.atributos, 's');
    if (estiloAttr !== null) estilos.set(ref, Number(estiloAttr));

    // El formato se guarda para TODA celda, tenga valor o no: una celda con fórmula todavía sin
    // calcular aparece vacía, y aun así su resultado debe mostrarse con su formato.
    const numFmtCelda = estiloAttr !== null ? (numFmtPorEstilo[Number(estiloAttr)] ?? 0) : 0;
    const { formato: formatoCelda, codigo, guardar } = formatoDe(numFmtCelda);
    if (guardar) formatos.set(ref, formatoCelda);

    const interno = c.interno;
    if (interno === '') continue; // celda auto-cerrada: solo estilo, sin fórmula ni valor

    const pf = buscarApertura(interno, 'f', 0, interno.length);
    if (pf >= 0) {
      const f = leerElemento(interno, 'f', pf);
      const textoFormula = textoXml(f.interno).trim();
      const si = atributo(f.atributos, 't') === 'shared' ? atributo(f.atributos, 'si') : null;
      if (si !== null && textoFormula === '') {
        // Celda que solo referencia una fórmula compartida: se resuelve al final.
        pendientes.push({ ref, si });
      } else if (textoFormula) {
        formulas.set(ref, textoFormula);
        if (si !== null) maestras.set(si, { formula: textoFormula, ref });
      }
    }

    let valor: string | null = null;
    if (tipo === 'inlineStr') {
      const pis = buscarApertura(interno, 'is', 0, interno.length);
      valor = pis >= 0 ? textoDeRuns(leerElemento(interno, 'is', pis).interno) : '';
    } else {
      const pv = buscarApertura(interno, 'v', 0, interno.length);
      if (pv < 0) continue; // celda solo con estilo/fórmula, sin valor
      const raw = textoXml(leerElemento(interno, 'v', pv).interno);
      if (tipo === 's') valor = shared[Number(raw)] ?? '';
      else if (tipo === 'b') valor = raw === '1' ? 'true' : 'false';
      else valor = raw; // 'n' (número), 'str' (resultado textual de fórmula), o sin tipo
    }

    if (valor === null || valor === '') continue;

    // Solo tiene sentido interpretar el formato de fecha o de porcentaje sobre un número: una celda
    // de texto con ese formato heredado seguiría siendo texto.
    const esNumero = tipo == null || tipo === 'n';
    celdas.set(ref, {
      valor,
      esFecha: esNumero ? formatoCelda.esFecha : false,
      soloAnio: esNumero ? formatoCelda.soloAnio : false,
      esPorcentaje: esNumero ? formatoCelda.esPorcentaje : false,
      decimales: formatoCelda.decimales,
      codigoFormato: codigo && numFmtCelda !== 0 && numFmtCelda !== 49 ? codigo : undefined,
      esTexto: tipo === 's' || tipo === 'inlineStr',
    });
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

  return { celdas, estilos, formulas, formatos, filaMaxima };
}
