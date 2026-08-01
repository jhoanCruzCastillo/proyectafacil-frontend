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

  const ms = Date.parse(texto);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10);
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
  const esVerdadero = valor === 'true';
  return etiquetas ? (esVerdadero ? etiquetas.true : etiquetas.false) : esVerdadero;
}
