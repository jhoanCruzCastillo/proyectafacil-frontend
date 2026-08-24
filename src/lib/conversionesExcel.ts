// Conversiones entre el valor crudo de una celda de Excel y el formato en que el sistema guarda
// cada tipo de campo. Punto ÚNICO de conversión: todo dato que entre desde un Excel (excelReader)
// o salga hacia uno (excelWriter) debe pasar por aquí, para que la regla viva en un solo lugar y
// no se duplique con criterios distintos en cada extremo.
//
// El caso que hace necesario este módulo: Excel no guarda fechas ni años como texto, sino como un
// número serial (días desde su época). La celda "23/03/2024" contiene 45374, y la celda "2024"
// (formato yyyy) contiene 45531 — el mismo tipo de número, interpretado distinto según el formato
// de la celda. Sin un conversor explícito, esos números terminarían guardados tal cual.

// Excel cuenta los días desde el 1899-12-30. El desfase de 2 días respecto al 1900-01-01 esperado
// absorbe el bug histórico del año bisiesto 1900 que Excel conserva por compatibilidad con
// Lotus 1-2-3 (considera 1900 bisiesto cuando no lo es).
const EPOCA_EXCEL_MS = Date.UTC(1899, 11, 30);
const MS_POR_DIA = 86400000;

export function serialExcelADate(serial: number): Date {
  return new Date(EPOCA_EXCEL_MS + serial * MS_POR_DIA);
}

export function dateASerialExcel(fecha: Date): number {
  return Math.round((fecha.getTime() - EPOCA_EXCEL_MS) / MS_POR_DIA);
}

/** Serial de Excel -> "YYYY-MM-DD" */
export function fechaISODesdeSerial(serial: number): string {
  return serialExcelADate(serial).toISOString().slice(0, 10);
}

/** Serial de Excel -> "YYYY" (celdas con formato de solo año) */
export function anioDesdeSerial(serial: number): string {
  return String(serialExcelADate(serial).getUTCFullYear());
}

// --- Entradas desde Excel (texto crudo de la celda) ---

// "DD/MM/YYYY" o "DD-MM-YYYY" — el formato en que la IA y los usuarios peruanos escriben una fecha.
const FECHA_DD_MM_YYYY = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;

/**
 * Normaliza cualquier representación de FECHA a "YYYY-MM-DD".
 * `esSerialDeExcel` viene de haber detectado formato de fecha en la celda; si es false, se intenta
 * interpretar el texto como fecha escrita. Devuelve null si no se puede interpretar.
 */
export function aFechaISO(valor: string, esSerialDeExcel: boolean): string | null {
  const texto = valor.trim();
  if (texto === '') return null;

  if (esSerialDeExcel) {
    const serial = Number(texto);
    if (Number.isFinite(serial)) return fechaISODesdeSerial(serial);
  }

  // DD/MM/YYYY explícito ANTES del fallback genérico: Date.parse interpreta "15/09/2026" como
  // MM/DD/YYYY (convención estadounidense) y da NaN apenas el día supera 12 — encontrado en vivo con
  // fechas propuestas por la IA ("Debe ser una fecha válida" en campos con una fecha perfectamente
  // válida). Se valida también que la fecha exista de verdad (rechaza "31/02/2026").
  const conBarras = texto.match(FECHA_DD_MM_YYYY);
  if (conBarras) {
    const dia = Number(conBarras[1]);
    const mes = Number(conBarras[2]);
    const anio = Number(conBarras[3]);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    if (fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia) {
      return fecha.toISOString().slice(0, 10);
    }
    return null;
  }

  const ms = Date.parse(texto);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" -> "DD/MM/YYYY", para mostrar/guardar en el formato que usa el resto de la app
 * (ej. el valor que emite un <input type="date"> nativo, que solo habla ISO). */
export function fechaISOaDDMMYYYY(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

/**
 * Normaliza cualquier representación de AÑO a "YYYY". Cubre los tres casos que aparecen en las
 * plantillas oficiales: celda con formato de año (serial), año escrito como número (2024) y año
 * escrito como texto dentro de una frase.
 */
export function aAnio(valor: string, esSerialDeExcel: boolean): string | null {
  const texto = valor.trim();
  if (texto === '') return null;

  const n = Number(texto);
  if (Number.isFinite(n)) {
    // Un serial de Excel siempre es un número grande (>= 1900-01-01 ≈ 2, y cualquier fecha
    // moderna pasa de 20000); un año escrito directamente cae en un rango de 4 dígitos.
    if (esSerialDeExcel) return anioDesdeSerial(n);
    if (n >= 1000 && n <= 9999) return String(Math.trunc(n));
  }

  const m = texto.match(/\b(1\d{3}|2\d{3})\b/); // año dentro de un texto ("Año 2024", "al 2024")
  return m ? m[1] : null;
}

// --- Porcentajes ---

// Excel guarda un porcentaje como la FRACCIÓN (1.10% se almacena como 0.011) y deja el "%" al
// formato de la celda. Sin traducirlo, el volcado trae 1.0999999999999999E-2 y la pantalla muestra
// ese número en vez del 1.10% que se ve en la hoja.
const RE_PORCENTAJE = /^([+-]?[\d.,\s]+)\s*%$/;

/** Fracción de Excel -> el texto que muestra la celda. 0.011 con 2 decimales -> "1.10%". */
export function aPorcentaje(valor: string | number, decimales?: number): string | null {
  const n = typeof valor === 'number' ? valor : Number(String(valor).trim());
  if (!Number.isFinite(n)) return null;
  // Multiplicar por 100 en coma flotante reintroduce ruido (0.011*100 = 1.0999999999999999), así que
  // se redondea a los decimales del formato; sin formato declarado, `0%` de Excel = sin decimales.
  return `${(n * 100).toFixed(decimales ?? 0)}%`;
}

/**
 * "1.10%" -> 0.011, o null si el texto no es un porcentaje escrito.
 *
 * Es la misma regla que aplica Excel cuando alguien teclea "50%" en una celda: guarda 0.5. Por eso
 * se puede aplicar a cualquier celda destino, tenga o no formato de porcentaje.
 */
export function dePorcentaje(texto: string): number | null {
  const m = RE_PORCENTAJE.exec(texto.trim());
  if (!m) return null;
  const n = Number(m[1].replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  // Se recorta la precisión al dividir para no devolver 0.010999999999999999 por "1.10%".
  return Number((n / 100).toPrecision(12));
}

// --- Formatos numéricos personalizados (`"E-"00`, `#,##0.00`, …) ---
//
// Excel guarda el número crudo (1) y el formato de la celda decide lo que se ve (E-01). Igual que
// con porcentajes y fechas: en la app guardamos lo que se VE, y al insertar recuperamos el número.
// No usamos SheetJS/SSF aquí: en Vite el paquete `xlsx` no exporta SSF de forma usable y un
// `import default` rompía el editor entero al cargar este módulo.

function primeraSeccionFormato(codigo: string): string {
  return codigo.split(';')[0].trim();
}

/** General / texto: el número se muestra tal cual; no hay que aplicar máscara. */
export function esFormatoNumeroSinMascara(codigo: string | undefined): boolean {
  if (!codigo) return true;
  const c = primeraSeccionFormato(codigo);
  return c === '' || /^general$/i.test(c) || c === '@';
}

/**
 * Subconjunto de formatos OOXML suficientes para las plantillas oficiales: literales entre
 * comillas (`"E-"`), `0`/`#`, decimales, miles y `%`.
 */
function aplicarMascaraNumero(codigo: string, valor: number): string {
  let plantilla = primeraSeccionFormato(codigo);
  // Quitar colores/condiciones `[Red]`, `[$S/-180A]` — no afectan el texto base.
  plantilla = plantilla.replace(/\[[^\]]*]/g, '');

  const literales: string[] = [];
  // Marcadores sin dígitos ni #/0 (si no, el patrón numérico se come el índice).
  const marcar = () => `\u0001${String.fromCharCode(0xe000 + literales.length)}\u0001`;
  const desmarcar = (s: string) =>
    s.replace(/\u0001([\ue000-\ue0ff])\u0001/g, (_, ch: string) => literales[ch.charCodeAt(0) - 0xe000] ?? '');

  plantilla = plantilla.replace(/"([^"]*)"/g, (_, lit: string) => {
    const m = marcar();
    literales.push(lit);
    return m;
  });
  plantilla = plantilla.replace(/\\(.)/g, (_, c: string) => {
    const m = marcar();
    literales.push(c);
    return m;
  });

  // Relleno de alineación contable (`_-`, `_)`, …): en Excel deja un hueco del ancho de ese
  // carácter para alinear con los paréntesis de los negativos en columnas vecinas — no aporta nada
  // en una celda de tabla suelta, así que se descarta entero. Encontrado en vivo: formatos tipo
  // `_-S/* #,##0_-` (moneda contable) se mostraban con el `_-`/`*` literales pegados al número
  // ("_-S/* 1,530_-") en vez de solo "S/ 1,530".
  plantilla = plantilla.replace(/_./g, '');
  // Relleno "hasta llenar la columna" (`* `, `*.`, …): en Excel repite el carácter siguiente para
  // ocupar el ancho de columna; acá basta con UNA sola instancia para conservar el espacio visual
  // (ej. entre el símbolo de moneda y el número) sin repetirlo de verdad.
  plantilla = plantilla.replace(/\*(.)/g, '$1');

  let n = valor;
  const esPct = plantilla.includes('%');
  if (esPct) {
    n *= 100;
    plantilla = plantilla.replace(/%/g, '');
  }

  const m = plantilla.match(/[#0][#0,.]*/);
  if (!m || m.index === undefined) {
    return desmarcar(plantilla) + String(n);
  }

  const patron = m[0];
  const antes = plantilla.slice(0, m.index);
  const despues = plantilla.slice(m.index + patron.length);

  const parteEnteraPatron = patron.split('.')[0] ?? '';
  const parteDecPatron = patron.includes('.') ? (patron.split('.')[1] ?? '') : '';
  const decimales = (parteDecPatron.match(/[0#]/g) ?? []).length;
  const minEnteros = (parteEnteraPatron.replace(/,/g, '').match(/0/g) ?? []).length;
  const conMiles = parteEnteraPatron.includes(',');

  const neg = n < 0;
  const abs = Math.abs(n);
  const fijo = decimales > 0 ? abs.toFixed(decimales) : String(Math.round(abs));
  const [entStr, decStr = ''] = fijo.split('.');
  let enteros = entStr.replace(/^0+(?=\d)/, '') || '0';
  if (enteros.length < minEnteros) enteros = enteros.padStart(minEnteros, '0');
  if (conMiles) {
    enteros = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  let numero = decimales > 0 ? `${enteros}.${decStr}` : enteros;
  if (neg) numero = `-${numero}`;

  const texto = desmarcar(`${antes}${numero}${despues}`);
  return esPct ? `${texto}%` : texto;
}

/**
 * Número crudo + código de formato de la celda -> texto como lo muestra Excel.
 * `1` + `"E-"00` -> `"E-01"`. Devuelve null si no aplica (sin formato útil o valor no numérico).
 */
export function textoVisibleDeNumero(valor: string | number, codigoFormato?: string): string | null {
  if (!codigoFormato || esFormatoNumeroSinMascara(codigoFormato)) return null;
  // Fechas/años se resuelven aparte (serial → ISO/año); aquí no tocar tokens d/m/y.
  const tokens = primeraSeccionFormato(codigoFormato).replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
  if (/[dmy]/i.test(tokens)) return null;
  const n = typeof valor === 'number' ? valor : Number(String(valor).trim().replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  try {
    return aplicarMascaraNumero(codigoFormato, n);
  } catch {
    return null;
  }
}

/**
 * Texto que ve el usuario ("E-01", "1,234.50") -> número a escribir en la celda.
 * Si el texto ya es un número plano ("1"), se acepta tal cual.
 */
export function numeroDesdeTextoVisible(texto: string): number | null {
  const t = texto.trim();
  if (!t) return null;
  const pct = dePorcentaje(t);
  if (pct !== null) return pct;

  const plano = Number(t.replace(/\s/g, '').replace(',', '.'));
  if (Number.isFinite(plano) && /^-?\d+([.,]\d+)?$/.test(t.replace(/\s/g, ''))) return plano;

  // Literales del formato (`E-01`): el guion del prefijo no es signo negativo.
  const m = t.replace(/\s/g, '').match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return /^-/.test(t.trim()) ? -n : n;
}

// --- Booleanos ---

// Reserva de último recurso, para plantillas que no declaran `etiquetas` en el campo. Las palabras
// que SÍ declara la plantilla siempre tienen prioridad sobre esta lista.
const BOOL_VERDADERO = ['sí', 'si', 'true', 'verdadero', '1', 'x'];
const BOOL_FALSO = ['no', 'false', 'falso', '0'];

export interface EtiquetasBooleano {
  true: string;
  false: string;
}

/**
 * Texto de la celda -> 'true' | 'false'. `etiquetas` son las palabras que usa ESTA plantilla
 * (ej. `{ true: "Sí", false: "No" }`); si no vienen, se cae a un reconocimiento genérico.
 * Devuelve null si el texto no representa ninguno de los dos valores — mejor omitir el campo que
 * adivinar.
 */
export function textoABooleano(texto: string, etiquetas?: EtiquetasBooleano): string | null {
  const v = texto.trim().toLowerCase();
  if (v === '') return null;

  if (etiquetas) {
    if (v === etiquetas.true.trim().toLowerCase()) return 'true';
    if (v === etiquetas.false.trim().toLowerCase()) return 'false';
  }
  if (BOOL_VERDADERO.includes(v)) return 'true';
  if (BOOL_FALSO.includes(v)) return 'false';
  return null;
}

/**
 * 'true' | 'false' -> el texto que debe verse en el Excel según la plantilla ("Sí" / "No").
 * Sin `etiquetas` declaradas, se escribe un booleano nativo de Excel (el writer lo resuelve).
 */
export function booleanoATexto(valor: string, etiquetas?: EtiquetasBooleano): string | boolean {
  const v = valor.trim();
  // Desde que el volcado conserva el texto del Excel, lo normal es que el valor YA venga con las
  // palabras de la plantilla ("Sí"). Solo se traduce la forma canónica, que es lo que guardaron los
  // ejemplos anteriores. Sin esta guarda, un "Sí" acabaría escrito como "No" en el Excel.
  if (v !== 'true' && v !== 'false') return v;
  const esVerdadero = v === 'true';
  return etiquetas ? (esVerdadero ? etiquetas.true : etiquetas.false) : esVerdadero;
}

/**
 * Texto que debe VERSE para un valor guardado, dadas las opciones que ofrece el Excel para esa
 * celda. Existe solo por los ejemplos que ya se guardaron con la forma canónica 'true'/'false':
 * se muestran con la palabra equivalente del Excel en vez de con el literal. Un valor que ya venga
 * con las palabras del Excel se devuelve intacto.
 */
export function etiquetaDeValor(valor: string, opciones?: string[] | null, etiquetas?: EtiquetasBooleano): string {
  if (valor !== 'true' && valor !== 'false') return valor;
  const equivalente = opciones?.find((o) => textoABooleano(o, etiquetas) === valor);
  if (equivalente) return equivalente;
  if (etiquetas) return valor === 'true' ? etiquetas.true : etiquetas.false;
  return valor;
}
