/** Respuesta del endpoint que propone el llenado de UNA tabla con IA — no persiste nada, el cliente
 * decide aplicar el valor propuesto (entra al flujo de borrador/confirmar ya existente). */
export interface ResultadoLlenadoTablaIA {
  /** Misma forma que el `valorEjemplo`/valor actual del campo — array u objeto, ya saneado. */
  valor: unknown;
  estado: 'requiere_confirmacion';
  advertencias: string[];
  /** Origen breve de los datos de esta tabla ("¿de dónde salió?"), para el botón "?" del editor. */
  fuente: string;
  /** Costo estimado (USD) de esta consulta a la IA. */
  costoUsd: number;
}

/** Solo se usa para catálogos en cascada (ej. Sección 5 Problema-Objetivo) — ver useLlenadoTablaIA. */
export interface OpcionesLlenadoTabla {
  /** id de columna -> opciones resueltas en vivo del Excel (sobrescribe las `opciones` estáticas
   * del JSON para esa columna, si las tuviera). */
  opcionesPorColumna?: Record<string, string[]>;
  /** Guía condicional en texto libre ("si tu Causa Directa es X, las CI válidas son...") para
   * catálogos donde una columna depende de qué se eligió en otra. */
  contextoAdicional?: string;
}

export interface LlenadoTablaIAApi {
  llenarTabla(ejemploId: string, identificador: string, seccionId: string, opciones?: OpcionesLlenadoTabla): Promise<ResultadoLlenadoTablaIA>;
}
