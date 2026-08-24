import type { ResultadoLlenadoIA } from '@/types';

/** Respuesta de enviarLoteFicha() — arranca un lote (Batch API de OpenAI) para "Llenar toda la ficha". */
export interface LoteEnviadoIA {
  loteId: number;
  estado: 'enviado';
  totalSolicitudes: number;
}

export type EstadoLoteIA = 'enviado' | 'procesando' | 'completado' | 'error';

/** Una tabla propuesta por el lote — mismo shape que ResultadoLlenadoTablaIA pero sin `estado`
 * (ese solo tenía sentido cuando venía de una llamada de una sola tabla) y con `error` cuando esa
 * línea del lote falló (la tabla simplemente no se propuso, no tumba el lote entero). */
export interface TablaLoteIA {
  identificador: string;
  valor?: unknown;
  advertencias?: string[];
  fuente?: string;
  costoUsd?: number;
  error?: string;
}

/** GET del estado de un lote. Mientras no esté 'completado'/'error', los campos de resultado no
 * vienen — solo `estado` (y `progreso`, si OpenAI ya lo reporta). */
export interface EstadoLoteIAResponse extends Partial<ResultadoLlenadoIA> {
  estado: EstadoLoteIA;
  progreso?: { total: number; completed: number; failed: number } | null;
  tablas?: TablaLoteIA[];
  error?: string;
  /** Motivo técnico crudo (ej. el error real de OpenAI) — `error` es el mensaje genérico para el
   * usuario; esto es lo que se manda a console.error para poder diagnosticar sin tener que ir a
   * buscar el log del backend cada vez. */
  detalle?: string | null;
}

export interface LlenadoIALoteApi {
  enviarLote(ejemploId: string, seccionIds?: string[] | null): Promise<LoteEnviadoIA>;
  estadoLote(ejemploId: string, loteId: number): Promise<EstadoLoteIAResponse>;
}
