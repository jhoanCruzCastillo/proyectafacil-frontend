// Extraído de ProcesamientoIAModal.vue (eliminado junto con el flujo síncrono de "llenar toda la
// ficha", ver useLlenadoIAAsync.ts) — se conserva acá porque useLlenadoIALote.ts (el mecanismo de
// batch de OpenAI, dormido desde que la Batch API está caída) todavía lo usa.
export type EstadoSeccionProgreso = 'completada' | 'procesando' | 'pendiente' | 'error';

export interface SeccionProgresoIA {
  id: string;
  nombre: string;
  estado: EstadoSeccionProgreso;
  campos?: number;
  llenados?: number;
  /** Solo nombres/etiquetas de campos con valor propuesto (sin el dato). */
  camposLlenadosNombres?: string[];
}
