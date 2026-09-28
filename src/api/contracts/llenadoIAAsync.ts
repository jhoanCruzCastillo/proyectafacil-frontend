export type EstadoTrabajoLlenadoIA = 'pendiente' | 'procesando' | 'completado' | 'error' | 'cancelado';

export interface TrabajoLlenadoIA {
  id: string;
  estado: EstadoTrabajoLlenadoIA;
  progresoTexto: string | null;
  camposCompletados: number;
  camposTotales: number | null;
  costoUsd: number;
  error: string | null;
  creadoEn: string;
  terminadoEn: string | null;
  /** Nombres de las secciones elegidas al iniciar el llenado — null si fue "toda la ficha". */
  secciones: string[] | null;
}

export interface LlenadoIAAsyncApi {
  /** Dispara el llenado con IA en segundo plano — responde al instante con el id del trabajo creado. */
  iniciar(ejemploId: string, seccionIds?: string[]): Promise<{ trabajoId: number; estado: 'pendiente' }>;
  /** Trabajo más reciente de esta ficha, o null si nunca se disparó ninguno. */
  estado(ejemploId: string): Promise<TrabajoLlenadoIA | null>;
  /** Cancela el trabajo pendiente/procesando más reciente de esta ficha (si hay uno). */
  cancelar(ejemploId: string): Promise<{ estado: 'cancelado' }>;
}
