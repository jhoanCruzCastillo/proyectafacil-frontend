// Evaluador de fórmulas nativas de Excel, para mostrar EN VIVO lo que el Excel calcularía.
//
// El caso que lo motiva: en `Datos Generales` el desplegable de B44 (Naturaleza de intervención)
// dispara varias celdas de la misma hoja —Objeto de intervención, Localización, Unidad de medida…—
// que son fórmulas que cuelgan de él. Como el .xlsx que tenemos es un archivo estático, sus valores
// están cacheados de la última vez que Excel calculó; para que el usuario vea el efecto de su
// elección hay que calcularlo nosotros.
//
// NO es un motor de Excel completo, y no pretende serlo. Cubre exactamente lo que usa la hoja de
// Datos Generales (IF, VLOOKUP, TODAY, concatenación con &, comparaciones, referencias entre hojas
// y rangos con nombre). Si la fórmula sale de ese subconjunto, se muestra el valor cacheado del
// .xlsx cuando exista; solo se deja el placeholder vacío si tampoco hay caché.
//
// Distinto de lib/formula.ts, que evalúa NUESTRAS fórmulas de campos calculados (aritmética sobre
// identificadores de campo). Aquí el lenguaje es el de Excel y los operandos son celdas.

import type { LibroLeido } from './xlsxXmlReader';
import { aAnio, aFechaISO, aPorcentaje, dateASerialExcel, dePorcentaje, textoVisibleDeNumero } from './conversionesExcel';

export class ErrorExcel {
  codigo: string;
  constructor(codigo: string) {
    this.codigo = codigo;
  }
}
/** Marca de "esto no lo sabemos calcular" — nunca se muestra como si fuera un valor */
export const NO_SOPORTADO = Symbol('no-soportado');

type Escalar = string | number | boolean | null | ErrorExcel;
interface Rango {
  hoja: string;
  c1: number;
  f1: number;
  c2: number;
  f2: number;
}
type Valor = Escalar | Rango | typeof NO_SOPORTADO;

export interface ResultadoCelda {
  /** Texto ya listo para mostrar ('' si la fórmula da vacío) */
  texto: string;
  /** false = la fórmula usa algo fuera del subconjunto soportado; no hay valor que mostrar */
  soportado: boolean;
  /** Código de error de Excel (#N/A, #REF!…) si la fórmula da error */
  error?: string;
}

const FUNCIONES_SOPORTADAS = new Set([
  'IF', 'IFERROR', 'IFNA', 'VLOOKUP', 'TODAY', 'AND', 'OR', 'NOT', 'CONCATENATE', 'TRIM',
  'SUM', 'COUNT', 'MIN', 'MAX', 'NPV',
]);

// Tope de celdas que se recorren al agregar un rango. Los rangos del formato oficial son de decenas
// de filas; esto solo evita que un `SUM(A:A)` mal escrito congele la pantalla.
const MAX_CELDAS_RANGO = 20000;

function esRango(v: Valor): v is Rango {
  return typeof v === 'object' && v !== null && !(v instanceof ErrorExcel) && 'c1' in v;
}

// --- Aritmética de referencias ---

function indiceColumna(letra: string): number {
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

// --- Tokenizador ---

type Token = { t: 'num'; v: number } | { t: 'str'; v: string } | { t: 'ref'; v: string } | { t: 'op'; v: string };

const OPERADORES = ['<>', '<=', '>=', '&', '=', '<', '>', '+', '-', '*', '/', '^', '(', ')', ',', ';', ':', '%'];

function tokenizar(formula: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const s = formula;

  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      i++;
      continue;
    }

    if (ch === '"') {
      // Excel escapa la comilla doblándola: "dijo ""hola"""
      let out = '';
      i++;
      while (i < s.length) {
        if (s[i] === '"') {
          if (s[i + 1] === '"') {
            out += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        out += s[i++];
      }
      tokens.push({ t: 'str', v: out });
      continue;
    }

    if (ch === "'") {
      // Nombre de hoja entre comillas simples: 'Unidad Productora'!L20
      let nombre = '';
      i++;
      while (i < s.length && s[i] !== "'") nombre += s[i++];
      i++; // cierre
      if (s[i] !== '!') return null;
      i++;
      let resto = '';
      while (i < s.length && /[A-Za-z0-9_.$]/.test(s[i])) resto += s[i++];
      tokens.push({ t: 'ref', v: `'${nombre}'!${resto}` });
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(s[i + 1] ?? ''))) {
      let num = '';
      while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
      tokens.push({ t: 'num', v: Number(num) });
      continue;
    }

    if (/[A-Za-z_$À-ɏ]/.test(ch)) {
      let ident = '';
      while (i < s.length && /[A-Za-z0-9_.$À-ɏ]/.test(s[i])) ident += s[i++];
      // Referencia con hoja sin comillas: Listas!C17
      if (s[i] === '!') {
        i++;
        let resto = '';
        while (i < s.length && /[A-Za-z0-9_.$]/.test(s[i])) resto += s[i++];
        ident = `${ident}!${resto}`;
      }
      tokens.push({ t: 'ref', v: ident });
      continue;
    }

    const op = OPERADORES.find((o) => s.startsWith(o, i));
    if (!op) return null;
    tokens.push({ t: 'op', v: op });
    i += op.length;
  }
  return tokens;
}

// --- Analizador sintáctico + evaluación en un paso ---

const RE_CELDA = /^(?:(?:'([^']+)'|([^'!]+))!)?\$?([A-Z]{1,3})\$?([0-9]+)$/i;

interface Contexto {
  libro: LibroLeido;
  /** Valores que nuestra estructura JSON tiene para celdas concretas, indexados `hoja!REF` */
  valores: Map<string, string>;
  /** Memo de celdas ya resueltas en esta pasada, y guarda contra referencias circulares */
  memo: Map<string, Valor>;
  enCurso: Set<string>;
  hojaBase: string;
}

class Parser {
  private pos = 0;
  private tokens: Token[];
  private ctx: Contexto;

  constructor(tokens: Token[], ctx: Contexto) {
    this.tokens = tokens;
    this.ctx = ctx;
  }

  private ver(): Token | undefined {
    return this.tokens[this.pos];
  }
  private esOp(...vs: string[]): boolean {
    const t = this.ver();
    return !!t && t.t === 'op' && vs.includes(t.v);
  }
  private comer(): Token | undefined {
    return this.tokens[this.pos++];
  }
  /** Consume el operador actual y devuelve su símbolo ('' si no lo era) */
  private comerOp(): string {
    const t = this.comer();
    return t && t.t === 'op' ? t.v : '';
  }

  parse(): Valor {
    const v = this.comparacion();
    return this.pos === this.tokens.length ? v : NO_SOPORTADO;
  }

  private comparacion(): Valor {
    let izq = this.concatenacion();
    while (this.esOp('=', '<>', '<', '>', '<=', '>=')) {
      const op = this.comerOp();
      const der = this.concatenacion();
      izq = comparar(op, escalar(izq, this.ctx), escalar(der, this.ctx));
    }
    return izq;
  }

  private concatenacion(): Valor {
    let izq = this.aditiva();
    while (this.esOp('&')) {
      this.comer();
      const der = this.aditiva();
      const a = escalar(izq, this.ctx);
      const b = escalar(der, this.ctx);
      if (a === NO_SOPORTADO || b === NO_SOPORTADO) return NO_SOPORTADO;
      if (a instanceof ErrorExcel) return a;
      if (b instanceof ErrorExcel) return b;
      izq = texto(a) + texto(b);
    }
    return izq;
  }

  private aditiva(): Valor {
    let izq = this.multiplicativa();
    while (this.esOp('+', '-')) {
      const op = this.comerOp();
      const der = this.multiplicativa();
      izq = aritmetica(op, escalar(izq, this.ctx), escalar(der, this.ctx));
    }
    return izq;
  }

  private multiplicativa(): Valor {
    let izq = this.unaria();
    while (this.esOp('*', '/')) {
      const op = this.comerOp();
      const der = this.unaria();
      izq = aritmetica(op, escalar(izq, this.ctx), escalar(der, this.ctx));
    }
    return izq;
  }

  private unaria(): Valor {
    // El formato oficial escribe muchas fórmulas como "=+IF(...)": el + inicial es decorativo.
    if (this.esOp('+')) {
      this.comer();
      return this.unaria();
    }
    if (this.esOp('-')) {
      this.comer();
      return aritmetica('-', 0, escalar(this.unaria(), this.ctx));
    }
    return this.primaria();
  }

  private primaria(): Valor {
    const t = this.comer();
    if (!t) return NO_SOPORTADO;

    if (t.t === 'num') return t.v;
    if (t.t === 'str') return t.v;

    if (t.t === 'op' && t.v === '(') {
      const v = this.comparacion();
      if (!this.esOp(')')) return NO_SOPORTADO;
      this.comer();
      return v;
    }

    if (t.t === 'ref') {
      // Llamada a función
      if (this.esOp('(')) {
        this.comer();
        // OOXML antepone `_xlfn.` al nombre de cualquier función posterior a Excel 2007 (IFNA, IFS,
        // TEXTJOIN…) — la UI de Excel lo oculta, pero el XML crudo lo guarda así. Sin quitarlo, una
        // función SOPORTADA (ej. IFNA) se veía como "_XLFN.IFNA" y no calzaba con FUNCIONES_SOPORTADAS,
        // cayendo a NO_SOPORTADO aunque el subconjunto cubierto SÍ sabe evaluarla. Encontrado en vivo:
        // Infraestructura!AS4 (`+_xlfn.IFNA(VLOOKUP(...),"")`) quedaba sin calcular por esto, no por la
        // fórmula en sí.
        const nombre = t.v.toUpperCase().replace(/^_XLFN\./, '');
        const args: Valor[] = [];
        if (!this.esOp(')')) {
          for (;;) {
            args.push(this.comparacion());
            if (this.esOp(',') || this.esOp(';')) {
              this.comer();
              continue;
            }
            break;
          }
        }
        if (!this.esOp(')')) return NO_SOPORTADO;
        this.comer();
        if (!FUNCIONES_SOPORTADAS.has(nombre)) return NO_SOPORTADO;
        return aplicarFuncion(nombre, args, this.ctx);
      }

      // Rango A1:B9
      if (this.esOp(':')) {
        this.comer();
        const fin = this.comer();
        if (!fin || fin.t !== 'ref') return NO_SOPORTADO;
        return construirRango(t.v, fin.v, this.ctx);
      }

      return resolverReferencia(t.v, this.ctx);
    }

    return NO_SOPORTADO;
  }
}

// --- Referencias ---

function construirRango(desde: string, hasta: string, ctx: Contexto): Valor {
  const a = RE_CELDA.exec(desde);
  const b = RE_CELDA.exec(hasta);
  if (!a || !b) return NO_SOPORTADO;
  const hoja = a[1] ?? a[2] ?? ctx.hojaBase;
  return {
    hoja,
    c1: indiceColumna(a[3]),
    f1: Number(a[4]),
    c2: indiceColumna(b[3]),
    f2: Number(b[4]),
  };
}

function resolverReferencia(ref: string, ctx: Contexto): Valor {
  if (/^TRUE$/i.test(ref)) return true;
  if (/^FALSE$/i.test(ref)) return false;

  const m = RE_CELDA.exec(ref);
  if (m) {
    const hoja = m[1] ?? m[2] ?? ctx.hojaBase;
    return valorDeCelda(ctx, hoja, `${m[3].toUpperCase()}${m[4]}`);
  }

  // Nombre definido (UBIGEO, Listas…): puede apuntar a un rango o a una celda suelta
  const destino = ctx.libro.nombresDefinidos.get(ref.toLowerCase());
  if (destino) {
    const limpio = destino.replace(/^=/, '');
    const partes = limpio.split(':');
    if (partes.length === 2) return construirRango(partes[0], partes[1], ctx);
    return resolverReferencia(limpio, ctx);
  }

  return NO_SOPORTADO;
}

/** Valor de una celda: primero su fórmula (es la lógica del Excel), luego lo que tengamos mapeado
 * en el JSON, y si no, lo que quedó cacheado en el archivo. */
function valorDeCelda(ctx: Contexto, hoja: string, ref: string): Valor {
  const clave = `${hoja}!${ref}`;
  const memo = ctx.memo.get(clave);
  if (memo !== undefined) return memo;
  if (ctx.enCurso.has(clave)) return new ErrorExcel('#REF!'); // referencia circular
  ctx.enCurso.add(clave);

  let resultado: Valor;
  const formula = ctx.libro.formulaDe(hoja, ref);
  if (formula) {
    resultado = evaluarExpresion(formula, { ...ctx, hojaBase: hoja });
  } else {
    const mapeado = ctx.valores.get(clave);
    if (mapeado !== undefined && mapeado !== '') resultado = comoEscalar(mapeado);
    else {
      const cache = ctx.libro.celda(hoja, ref);
      resultado = cache && cache.valor !== '' ? comoEscalar(cache.valor) : '';
    }
  }

  ctx.enCurso.delete(clave);
  ctx.memo.set(clave, resultado);
  return resultado;
}

// Nuestro JSON guarda las fechas como "YYYY-MM-DD"; Excel las guarda como número de serie, y sus
// fórmulas hacen aritmética con ellas — restar dos fechas da los días entre ambas. Sin convertir,
// esa resta recibía texto y devolvía #VALUE! (era el caso de "Fase de Ejecución", que divide entre
// 365 la diferencia de dos fechas).
function comoEscalar(v: string): Escalar {
  const t = v.trim();
  if (t === '') return v;
  // aFechaISO entiende tanto ISO como "DD/MM/YYYY" (el formato en que la IA y el <input type="date">
  // del cliente lo escriben) — antes solo se reconocía ISO y una fecha en DD/MM/YYYY no se convertía
  // a serial, así que una resta de fechas devolvía #VALUE! en vez del número de días esperado.
  //
  // BUG encontrado en vivo (2026-08-22): aquí NO sabemos si esta celda es una fecha o un número — a
  // diferencia de excelWriter.ts/formula.ts, que solo llaman a esto cuando el CAMPO ya declara
  // tipo:'fecha'. aFechaISO() cae en Date.parse(texto) para cubrir fechas sueltas, pero Date.parse
  // interpreta CUALQUIER entero de 1-4 dígitos como un año ("2450" -> 2450-01-01, "135" -> 0135-01-01,
  // "71" -> 1971-01-01): una "Cantidad" de tabla como 2450 se leía como fecha y se convertía en un
  // número de serie de Excel gigante, rompiendo cualquier fórmula que dividiera esa celda (4.01.01
  // "%" daba 200%/-320% en vez del 5.5%/59.2% real). Por eso solo se intenta la fecha si el texto
  // TIENE pinta de fecha (trae separador) — un entero plano nunca se trata como fecha acá.
  const iso = /[/-]/.test(t) ? aFechaISO(t, false) : null;
  if (iso !== null) {
    const ms = Date.parse(`${iso}T00:00:00Z`);
    if (!Number.isNaN(ms)) return dateASerialExcel(new Date(ms));
  }
  // "1.10%" guardado en el JSON vale 0.011 para cualquier fórmula que lea esa celda, igual que en
  // Excel. Sin esto, una tasa escrita como porcentaje entraría al cálculo como texto.
  const pct = dePorcentaje(t);
  if (pct !== null) return pct;
  if (!Number.isNaN(Number(t))) return Number(t);
  return v;
}

// --- Coerciones ---

function escalar(v: Valor, ctx: Contexto): Escalar | typeof NO_SOPORTADO {
  if (!esRango(v)) return v;
  // Un rango donde se espera un escalar colapsa a su esquina superior-izquierda: es lo que hace
  // Excel con la intersección implícita, y es el caso de VLOOKUP('Datos Generales'!B44:D44, …).
  const celda = valorDeCelda(ctx, v.hoja, `${letraColumna(v.c1)}${v.f1}`);
  return esRango(celda) ? NO_SOPORTADO : celda;
}

function texto(v: Escalar): string {
  if (v === null) return '';
  if (v instanceof ErrorExcel) return v.codigo;
  if (typeof v === 'boolean') return v ? 'VERDADERO' : 'FALSO';
  return String(v);
}

function numero(v: Escalar): number | ErrorExcel {
  if (v instanceof ErrorExcel) return v;
  if (v === null || v === '') return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  return Number.isNaN(n) ? new ErrorExcel('#VALUE!') : n;
}

function comparar(op: string, a: Escalar | typeof NO_SOPORTADO, b: Escalar | typeof NO_SOPORTADO): Valor {
  if (a === NO_SOPORTADO || b === NO_SOPORTADO) return NO_SOPORTADO;
  if (a instanceof ErrorExcel) return a;
  if (b instanceof ErrorExcel) return b;

  // Una celda nunca tocada (sin fórmula, sin caché) resuelve a "" (ver valorDeCelda) — Excel trata
  // esa celda en blanco como 0 cuando se compara contra un NÚMERO (`ALGO=0` con ALGO vacío da
  // VERDADERO), y como "" cuando se compara contra texto. Antes esto solo cubría `null`, nunca la
  // cadena vacía real que devuelve una celda en blanco — así que `celdaVacia=0` comparaba '' === 0
  // (siempre falso) en vez de 0 === 0. Encontrado en vivo: una guarda `IF(celda=0,"",...)` no
  // atrapaba la celda vacía, la división de al lado se ejecutaba igual y salía #DIV/0! en vez de "".
  const esVacio = (v: Escalar): v is null | '' => v === null || v === '';
  let va: Exclude<Escalar, null> = esVacio(a) ? (typeof b === 'number' ? 0 : '') : a;
  let vb: Exclude<Escalar, null> = esVacio(b) ? (typeof a === 'number' ? 0 : '') : b;

  // Excel compara texto sin distinguir mayúsculas
  if (typeof va === 'string') va = va.toLowerCase();
  if (typeof vb === 'string') vb = vb.toLowerCase();

  switch (op) {
    case '=': return va === vb;
    case '<>': return va !== vb;
    case '<': return va < vb;
    case '>': return va > vb;
    case '<=': return va <= vb;
    case '>=': return va >= vb;
    default: return NO_SOPORTADO;
  }
}

function aritmetica(op: string, a: Escalar | typeof NO_SOPORTADO, b: Escalar | typeof NO_SOPORTADO): Valor {
  if (a === NO_SOPORTADO || b === NO_SOPORTADO) return NO_SOPORTADO;
  const na = numero(a);
  const nb = numero(b);
  if (na instanceof ErrorExcel) return na;
  if (nb instanceof ErrorExcel) return nb;
  switch (op) {
    case '+': return na + nb;
    case '-': return na - nb;
    case '*': return na * nb;
    case '/': return nb === 0 ? new ErrorExcel('#DIV/0!') : na / nb;
    default: return NO_SOPORTADO;
  }
}

// --- Funciones ---

/** Días entre el 1899-12-30 (época de Excel) y hoy — el serial que devuelve TODAY() */
function serialDeHoy(): number {
  const ahora = new Date();
  const utc = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return Math.round((utc - Date.UTC(1899, 11, 30)) / 86400000);
}

/** Aplana los argumentos de una función agregada: los escalares van tal cual y los rangos se
 * recorren celda a celda. Como en Excel, dentro de un rango el texto y los vacíos se ignoran. */
function numerosDeArgumentos(args: Valor[], ctx: Contexto): number[] | ErrorExcel | typeof NO_SOPORTADO {
  const out: number[] = [];
  for (const arg of args) {
    if (arg === NO_SOPORTADO) return NO_SOPORTADO;

    if (esRango(arg)) {
      let vistas = 0;
      for (let f = arg.f1; f <= arg.f2; f++) {
        for (let c = arg.c1; c <= arg.c2; c++) {
          if (++vistas > MAX_CELDAS_RANGO) return NO_SOPORTADO;
          const v = valorDeCelda(ctx, arg.hoja, `${letraColumna(c)}${f}`);
          if (v === NO_SOPORTADO) return NO_SOPORTADO;
          if (v instanceof ErrorExcel) return v;
          if (esRango(v)) continue;
          if (typeof v === 'number') out.push(v);
          else if (typeof v === 'boolean') continue; // Excel ignora lógicos dentro de un rango
        }
      }
      continue;
    }

    // Fuera de un rango, un argumento suelto sí se convierte a número (SUM(A1,"3") = 3)
    if (arg instanceof ErrorExcel) return arg;
    if (arg === null || arg === '') continue;
    const n = numero(arg);
    if (n instanceof ErrorExcel) return n;
    out.push(n);
  }
  return out;
}

function aplicarFuncion(nombre: string, args: Valor[], ctx: Contexto): Valor {
  const esc = (i: number) => escalar(args[i], ctx);

  switch (nombre) {
    case 'SUM':
    case 'COUNT':
    case 'MIN':
    case 'MAX': {
      const nums = numerosDeArgumentos(args, ctx);
      if (nums === NO_SOPORTADO) return NO_SOPORTADO;
      if (nums instanceof ErrorExcel) return nums;
      if (nombre === 'COUNT') return nums.length;
      if (nombre === 'SUM') return nums.reduce((a, b) => a + b, 0);
      // MIN/MAX sobre un rango sin números devuelven 0 en Excel, no un error
      if (nums.length === 0) return 0;
      return nombre === 'MIN' ? Math.min(...nums) : Math.max(...nums);
    }

    case 'TODAY':
      return serialDeHoy();

    // Valor actual neto: cada flujo se descuenta un período, empezando por el primero.
    case 'NPV': {
      const tasa = esc(0);
      if (tasa === NO_SOPORTADO) return NO_SOPORTADO;
      const r = numero(tasa);
      if (r instanceof ErrorExcel) return r;
      const flujos = numerosDeArgumentos(args.slice(1), ctx);
      if (flujos === NO_SOPORTADO) return NO_SOPORTADO;
      if (flujos instanceof ErrorExcel) return flujos;
      return flujos.reduce((acc, v, i) => acc + v / Math.pow(1 + r, i + 1), 0);
    }

    case 'IF': {
      const cond = esc(0);
      if (cond === NO_SOPORTADO) return NO_SOPORTADO;
      if (cond instanceof ErrorExcel) return cond;
      const verdadero = cond === true || (typeof cond === 'number' && cond !== 0);
      const rama = verdadero ? args[1] : args[2];
      if (rama === undefined) return verdadero;
      return escalar(rama, ctx);
    }

    case 'IFERROR':
    case 'IFNA': {
      const v = esc(0);
      if (v === NO_SOPORTADO) return NO_SOPORTADO;
      // IFNA solo atrapa #N/A; los demás errores pasan de largo
      const atrapa = v instanceof ErrorExcel && (nombre === 'IFERROR' || v.codigo === '#N/A');
      return atrapa ? esc(1) : v;
    }

    case 'VLOOKUP': {
      const buscado = esc(0);
      const tabla = args[1];
      const indice = esc(2);
      if (buscado === NO_SOPORTADO || indice === NO_SOPORTADO) return NO_SOPORTADO;
      if (buscado instanceof ErrorExcel) return buscado;
      if (!esRango(tabla)) return NO_SOPORTADO;
      const col = numero(indice);
      if (col instanceof ErrorExcel) return col;
      // El 4.º argumento decide el modo. Omitido, Excel asume aproximado.
      const cuarto = args[3] === undefined ? true : escalar(args[3], ctx);
      if (cuarto === NO_SOPORTADO) return NO_SOPORTADO;
      const aproximado = !(cuarto === false || cuarto === 0);
      return buscarVertical(buscado, tabla, col, ctx, aproximado);
    }

    case 'AND':
    case 'OR': {
      let resultado = nombre === 'AND';
      for (let i = 0; i < args.length; i++) {
        const v = esc(i);
        if (v === NO_SOPORTADO) return NO_SOPORTADO;
        if (v instanceof ErrorExcel) return v;
        const b = v === true || (typeof v === 'number' && v !== 0);
        resultado = nombre === 'AND' ? resultado && b : resultado || b;
      }
      return resultado;
    }

    case 'NOT': {
      const v = esc(0);
      if (v === NO_SOPORTADO) return NO_SOPORTADO;
      if (v instanceof ErrorExcel) return v;
      return !(v === true || (typeof v === 'number' && v !== 0));
    }

    case 'CONCATENATE': {
      let out = '';
      for (let i = 0; i < args.length; i++) {
        const v = esc(i);
        if (v === NO_SOPORTADO) return NO_SOPORTADO;
        if (v instanceof ErrorExcel) return v;
        out += texto(v);
      }
      return out;
    }

    case 'TRIM': {
      const v = esc(0);
      if (v === NO_SOPORTADO) return NO_SOPORTADO;
      if (v instanceof ErrorExcel) return v;
      return texto(v).replace(/\s+/g, ' ').trim();
    }

    default:
      return NO_SOPORTADO;
  }
}

/**
 * `aproximado` es el modo por defecto de Excel: la primera columna debe venir ordenada de menor a
 * mayor y se devuelve la última fila cuyo valor NO supera al buscado (el "tramo" en el que cae).
 * Es como el formato oficial deduce, por ejemplo, el tipo de CIAI a partir del número de niños.
 */
function buscarVertical(buscado: Escalar, tabla: Rango, indice: number, ctx: Contexto, aproximado = false): Valor {
  if (indice < 1 || tabla.c1 + indice - 1 > tabla.c2) return new ErrorExcel('#REF!');
  const clave = typeof buscado === 'string' ? buscado.toLowerCase() : buscado;
  const devolver = (f: number): Valor => {
    const destino = valorDeCelda(ctx, tabla.hoja, `${letraColumna(tabla.c1 + indice - 1)}${f}`);
    return esRango(destino) ? NO_SOPORTADO : destino;
  };

  let candidata: number | null = null;
  for (let f = tabla.f1; f <= tabla.f2; f++) {
    const celda = valorDeCelda(ctx, tabla.hoja, `${letraColumna(tabla.c1)}${f}`);
    if (esRango(celda) || celda === NO_SOPORTADO || celda instanceof ErrorExcel) continue;
    const v = typeof celda === 'string' ? celda.toLowerCase() : celda;
    if (v === clave) return devolver(f);
    if (aproximado && v !== null && v !== '' && clave !== null && v <= clave) candidata = f;
  }
  if (aproximado && candidata !== null) return devolver(candidata);
  return new ErrorExcel('#N/A');
}

// --- Entrada pública ---

function evaluarExpresion(formula: string, ctx: Contexto): Valor {
  const tokens = tokenizar(formula.replace(/^=/, ''));
  if (!tokens) return NO_SOPORTADO;
  return new Parser(tokens, ctx).parse();
}

/** Serial de Excel -> texto, con el formato de la celda (año suelto o fecha completa) */
function fechaDesdeSerial(serial: number, soloAnio: boolean): string {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const d = new Date(ms);
  if (soloAnio) return String(d.getUTCFullYear());
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/**
 * Memo compartido entre varias llamadas a `calcularCelda`/`evaluarTexto` — sin él, cada llamada
 * vuelve a resolver desde cero hasta la última celda de la que depende, y en una plantilla con
 * fórmulas encadenadas (un SUM de 500 filas que otras fórmulas también suman) eso se repite una vez
 * por cada celda visible que lo usa. Es seguro compartirlo entre TODAS las fórmulas de una misma
 * pasada porque una pasada = un snapshot fijo de `valores`; hay que crear uno nuevo (no reutilizar
 * este) en cuanto ese snapshot cambie, o se arrastraría un valor de un estado anterior.
 */
export function crearMemoCompartido(): Map<string, unknown> {
  return new Map();
}

/**
 * Evalúa una expresión suelta (no la fórmula de una celda) y devuelve su texto, o null si no se pudo
 * resolver o salió vacía.
 *
 * Lo usa la resolución de los desplegables dependientes: una validación `INDIRECT(Listas!$D$44)`
 * obliga a calcular primero qué hay en `Listas!D44` —que a su vez es un VLOOKUP sobre otra hoja—
 * para saber a qué rango con nombre apunta la lista.
 */
export function evaluarTexto(
  libro: LibroLeido,
  valores: Map<string, string>,
  hoja: string,
  expresion: string,
  memoCompartido?: Map<string, unknown>,
): string | null {
  const ctx: Contexto = { libro, valores, memo: (memoCompartido as Map<string, Valor> | undefined) ?? new Map(), enCurso: new Set(), hojaBase: hoja };
  const bruto = evaluarExpresion(expresion, ctx);
  const v = esRango(bruto) ? escalar(bruto, ctx) : bruto;
  if (v === NO_SOPORTADO || esRango(v) || v instanceof ErrorExcel) return null;
  const t = texto(v);
  return t.trim() === '' ? null : t;
}

/**
 * Valor que Excel dejó cacheado en la celda (última vez que se abrió/guardó el archivo).
 * Cuando nuestra mini-calculadora no cubre la fórmula, es lo más fiel que podemos mostrar —
 * p. ej. "Validación - OK" en una celda con IF/TEXT complejos que aún no evaluamos.
 */
function textoCacheado(libro: LibroLeido, hoja: string, ref: string): string | null {
  const celda = libro.celda(hoja, ref);
  if (!celda) return null;
  const crudo = celda.valor.trim();
  if (crudo === '') return null;
  if (celda.soloAnio) return aAnio(celda.valor, true) ?? crudo;
  if (celda.esFecha) return aFechaISO(celda.valor, true) ?? celda.valor;
  if (celda.esPorcentaje) return aPorcentaje(celda.valor, celda.decimales) ?? crudo;
  return textoVisibleDeNumero(celda.valor, celda.codigoFormato) ?? celda.valor;
}

function conCacheSiHaceFalta(
  libro: LibroLeido,
  hoja: string,
  ref: string,
  fallo: ResultadoCelda,
): ResultadoCelda {
  const cache = textoCacheado(libro, hoja, ref);
  if (cache !== null) return { texto: cache, soportado: true };
  return fallo;
}

/**
 * Calcula lo que el Excel mostraría en esa celda, usando como entradas los valores que tenemos
 * mapeados en la estructura. Devuelve undefined si la celda no tiene fórmula (no hay nada que
 * calcular: su valor es simplemente el que el usuario escriba).
 *
 * Si la fórmula sale del subconjunto que sabemos evaluar, se muestra el valor cacheado del
 * .xlsx cuando exista — mejor eso que el placeholder "Lo calcula el Excel".
 */
export function calcularCelda(
  libro: LibroLeido,
  valores: Map<string, string>,
  hoja: string,
  ref: string,
  memoCompartido?: Map<string, unknown>,
): ResultadoCelda | undefined {
  const formula = libro.formulaDe(hoja, ref);
  if (!formula) return undefined;

  const ctx: Contexto = { libro, valores, memo: (memoCompartido as Map<string, Valor> | undefined) ?? new Map(), enCurso: new Set(), hojaBase: hoja };
  const bruto = evaluarExpresion(formula, ctx);
  // El formato oficial escribe referencias a bloques fusionados como rango (`+'Unidad
  // Productora'!E49:F49`). Excel lo resuelve por intersección implícita; aquí se toma la esquina
  // superior-izquierda, que en una celda fusionada es justo donde vive el valor.
  const v = esRango(bruto) ? escalar(bruto, ctx) : bruto;

  if (v === NO_SOPORTADO) {
    return conCacheSiHaceFalta(libro, hoja, ref, { texto: '', soportado: false });
  }
  if (esRango(v)) {
    return conCacheSiHaceFalta(libro, hoja, ref, { texto: '', soportado: false });
  }
  if (v instanceof ErrorExcel) {
    return conCacheSiHaceFalta(libro, hoja, ref, { texto: '', soportado: true, error: v.codigo });
  }

  const formato = libro.formatoFecha(hoja, ref);
  if (formato?.esFecha && typeof v === 'number') {
    return { texto: fechaDesdeSerial(v, formato.soloAnio), soportado: true };
  }
  if (typeof v === 'number') {
    // Se muestra con los decimales que declara la celda, como lo mostraría Excel. Sin formato
    // declarado se recorta la precisión para no arrastrar la basura del coma flotante.
    const decimales = libro.decimalesDe(hoja, ref);
    // Una celda con formato de porcentaje guarda la fracción: I10/I9 = 0.147 y en la hoja se lee
    // 14.7%. Mostrar el 0.1 crudo no es lo que ve quien abre el Excel.
    if (libro.esPorcentaje(hoja, ref)) {
      return { texto: aPorcentaje(v, decimales) ?? '', soportado: true };
    }
    const conMascara = textoVisibleDeNumero(v, libro.codigoFormato(hoja, ref));
    if (conMascara !== null) return { texto: conMascara, soportado: true };
    return { texto: decimales !== undefined ? v.toFixed(decimales) : String(Number(v.toPrecision(12))), soportado: true };
  }
  const t = texto(v);
  // Eval vacía pero el archivo sí trae resultado cacheado (fórmulas parciales / dependencias
  // aún no mapeadas): preferimos lo que Excel dejó escrito.
  if (t.trim() === '') {
    return conCacheSiHaceFalta(libro, hoja, ref, { texto: '', soportado: true });
  }
  return { texto: t, soportado: true };
}
