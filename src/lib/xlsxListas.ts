// Resuelve las listas desplegables de un Excel a opciones concretas.
//
// La decisión de diseño es que las opciones NO viven en la estructura JSON: se leen del propio
// archivo Excel cada vez. Así el Excel oficial sigue siendo la única fuente de verdad y no hay que
// migrar nada cuando el MEF publica una versión nueva del formato.
//
// xlsxXmlReader extrae el `<formula1>` crudo de cada validación; aquí se convierte en una lista de
// textos. En el formato oficial (`enlace-v4.xlsx`) aparecen tres formas:
//
//   NivelGobierno              nombre definido -> Listas!$J$3:$J$5   (34 de 43)
//   UBIGEO!$A$3:$A$1876        rango directo a una hoja oculta       (2 de 43)
//   INDIRECT(Listas!$D$48)     depende del valor de otra celda       (7 de 43, solo Problema-Objetivo)
//
// Las dos primeras se resuelven aquí. Las dependientes se marcan como tales y se dejan pasar: sus
// campos siguen siendo de texto libre y NUNCA se avisa de que su valor sea inválido, porque no
// sabemos cuáles son sus opciones.

import type { LibroLeido } from './xlsxXmlReader';
import { evaluarTexto } from './excelFormulaEval';

export type Lista =
  | { estado: 'resuelta'; opciones: string[] }
  /** La lista depende del valor de otra celda (`INDIRECT`); no se resuelve por ahora */
  | { estado: 'dependiente' };

export interface CatalogoListas {
  /** Lista que aplica a esa celda, o undefined si la celda no tiene desplegable */
  listaDe(hoja: string, ref: string): Lista | undefined;
  /** Opciones de esa celda, o undefined si no tiene desplegable o no se pudo resolver */
  opcionesDe(hoja: string, ref: string): string[] | undefined;
}

// Tope de seguridad: UBIGEO ya trae 1874 entradas y es el rango más grande del formato oficial.
const MAX_OPCIONES = 5000;

function indiceColumna(letra: string): number {
  let n = 0;
  for (const ch of letra.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function letraColumna(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

interface RangoRef {
  hoja?: string;
  c1: number;
  f1: number;
  c2: number;
  f2: number;
}

// 'Análisis Técnico'!$A$3:$D$10 | Listas!$J$3:$J$5 | $A$3:$A$10
const RE_RANGO = /^(?:(?:'([^']+)'|([^'!]+))!)?\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/i;

function parseRango(texto: string): RangoRef | undefined {
  const m = texto.match(RE_RANGO);
  if (!m) return undefined;
  // La última columna de Excel es XFD: más de tres letras no es una referencia, es un nombre que
  // por casualidad tiene forma de referencia.
  if (m[3].length > 3 || (m[5] && m[5].length > 3)) return undefined;
  const c1 = indiceColumna(m[3]);
  const f1 = Number(m[4]);
  return {
    hoja: m[1] ?? m[2],
    c1,
    f1,
    c2: m[5] ? indiceColumna(m[5]) : c1,
    f2: m[6] ? Number(m[6]) : f1,
  };
}

function leerRango(libro: LibroLeido, rango: RangoRef, hojaBase: string): string[] {
  const hoja = rango.hoja ?? hojaBase;
  const out: string[] = [];
  for (let f = rango.f1; f <= rango.f2 && out.length < MAX_OPCIONES; f++) {
    for (let c = rango.c1; c <= rango.c2 && out.length < MAX_OPCIONES; c++) {
      const valor = libro.celda(hoja, `${letraColumna(c)}${f}`)?.valor?.trim();
      // Los rangos de opciones traen huecos al final (se dimensionan de más). Un `#N/A` es una
      // fórmula sin resolver de la propia plantilla, no una opción válida.
      if (valor && !valor.startsWith('#')) out.push(valor);
    }
  }
  return out;
}

/** Texto del argumento de una llamada, respetando paréntesis anidados. */
function argumentoDe(texto: string, posAbre: number): string | undefined {
  let nivel = 0;
  for (let i = posAbre; i < texto.length; i++) {
    if (texto[i] === '(') nivel++;
    else if (texto[i] === ')') {
      nivel--;
      if (nivel === 0) return texto.slice(posAbre + 1, i);
    }
  }
  return undefined;
}

function resolverFormula(
  libro: LibroLeido,
  formula: string,
  hojaBase: string,
  visitados: Set<string>,
  valores: Map<string, string>,
  memoCompartido: Map<string, unknown> | undefined,
): Lista | undefined {
  const texto = formula.replace(/^=/, '').trim();
  if (!texto) return undefined;

  // Literal en línea: "Gobierno Nacional,Gobierno Regional,Gobierno Local"
  if (texto.startsWith('"')) {
    const opciones = texto
      .replace(/^"|"$/g, '')
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o !== '');
    return opciones.length > 0 ? { estado: 'resuelta', opciones } : undefined;
  }

  // Lista dependiente: `INDIRECT(x)` donde x se calcula a partir de otras celdas. Se evalúa x con el
  // motor de fórmulas —usando como entradas los valores que ya tenemos en la estructura— y el texto
  // que devuelve es el nombre del rango con las opciones. Así la lista cambia sola cuando cambia el
  // campo del que depende, igual que en Excel.
  const abre = /\b(?:INDIRECT|INDIRECTO)\s*\(/i.exec(texto);
  if (abre) {
    const arg = argumentoDe(texto, abre.index + abre[0].length - 1);
    const destino = arg ? evaluarTexto(libro, valores, hojaBase, arg, memoCompartido) : null;
    // Sin destino todavía (el campo del que depende está vacío, o da #N/A) no hay opciones que
    // ofrecer: se marca como dependiente y el campo queda como texto libre.
    if (!destino) return { estado: 'dependiente' };
    return resolverFormula(libro, destino, hojaBase, visitados, valores, memoCompartido);
  }

  // Otras formas que no se resuelven (ver cabecera del archivo)
  if (/\b(OFFSET|DESREF)\s*\(/i.test(texto)) return { estado: 'dependiente' };

  // Nombre definido: se resuelve al rango al que apunta. Se comprueba ANTES de intentar leerlo como
  // rango porque un nombre que acaba en dígito (`AccionSobreActivo2`) también encaja con la forma
  // "columna+fila" de una referencia. El `visitados` corta un nombre que se apunte a sí mismo, que
  // rompería con un desbordamiento de pila en vez de con un undefined.
  const clave = texto.toLowerCase();
  if (!visitados.has(clave)) {
    const destino = libro.nombresDefinidos.get(clave);
    if (destino) {
      visitados.add(clave);
      return resolverFormula(libro, destino, hojaBase, visitados, valores, memoCompartido);
    }
  }

  const rango = parseRango(texto);
  if (rango) {
    const opciones = leerRango(libro, rango, hojaBase);
    return opciones.length > 0 ? { estado: 'resuelta', opciones } : undefined;
  }

  return undefined;
}

/** Un valor que se escribió en una celda con lista desplegable sin coincidir con ninguna opción. */
export interface AvisoLista {
  campo: string;
  celda: string;
  valor: string;
  opciones: string[];
}

/** Compara ignorando mayúsculas y tildes, para no avisar de un "Si" que es en realidad "Sí". */
export function normalizarOpcion(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Texto del aviso para el usuario, o null si no hay nada que avisar. */
export function mensajeAvisoListas(avisos: AvisoLista[]): string | null {
  if (avisos.length === 0) return null;
  const nombres = avisos.slice(0, 3).map((a) => a.campo).join(', ');
  const resto = avisos.length > 3 ? ` y ${avisos.length - 3} más` : '';
  return avisos.length === 1
    ? `El valor de ${nombres} no está entre las opciones de su desplegable en el Excel`
    : `${avisos.length} valores no están entre las opciones de su desplegable en el Excel: ${nombres}${resto}`;
}

// Cache PERMANENTE de listas ya resueltas, por libro — sobrevive entre llamadas a `catalogoDeListas`.
// Ver el comentario dentro de esa función para el porqué.
const cachePermanentePorLibro = new WeakMap<LibroLeido, Map<string, Lista>>();

/**
 * `valores` son los datos que la estructura tiene mapeados, indexados `hoja!REF`. Solo hacen falta
 * para las listas dependientes (`INDIRECT`), que se calculan a partir de otros campos; las demás se
 * resuelven igual aunque se pase un mapa vacío.
 */
export function catalogoDeListas(
  libro: LibroLeido,
  valores: Map<string, string> = new Map(),
  memoCompartido?: Map<string, unknown>,
  usarCachePermanente = true,
): CatalogoListas {
  // Una misma fórmula cubre muchas celdas (`I128:I143` -> Si_No), así que se memoriza por fórmula
  // y no por celda: resolver UBIGEO son 1874 lecturas.
  //
  // Las 'resuelta' se guardan en una cache PERMANENTE por libro (sobrevive entre llamadas): no
  // dependen de `valores`, así que un Excel con validaciones pesadas como UBIGEO se lee una sola vez
  // en toda la sesión, no en cada tecla que se escribe en cualquier campo de la pantalla. Las
  // 'dependiente' (`INDIRECT`) sí pueden cambiar entre llamadas porque leen `valores`, así que esas
  // solo se memorizan dentro de esta llamada.
  //
  // `usarCachePermanente=false` (modo "tiempo real" del selector del editor) apaga esta cache y
  // vuelve a resolver todo desde cero en cada llamada, igual que antes de que existiera.
  let permanente = usarCachePermanente ? cachePermanentePorLibro.get(libro) : undefined;
  if (usarCachePermanente && !permanente) {
    permanente = new Map();
    cachePermanentePorLibro.set(libro, permanente);
  }
  const cacheDependientes = new Map<string, Lista | undefined>();

  function listaDe(hoja: string, ref: string): Lista | undefined {
    const formula = libro.validacionLista(hoja, ref);
    if (!formula) return undefined;
    const clave = `${hoja} ${formula}`;
    const resuelta = permanente?.get(clave);
    if (resuelta) return resuelta;
    if (cacheDependientes.has(clave)) return cacheDependientes.get(clave);

    const resultado = resolverFormula(libro, formula, hoja, new Set(), valores, memoCompartido);
    if (resultado?.estado === 'resuelta' && permanente) permanente.set(clave, resultado);
    else cacheDependientes.set(clave, resultado);
    return resultado;
  }

  return {
    listaDe,
    opcionesDe(hoja: string, ref: string): string[] | undefined {
      const lista = listaDe(hoja, ref);
      return lista?.estado === 'resuelta' ? lista.opciones : undefined;
    },
  };
}
