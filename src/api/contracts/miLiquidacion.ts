import type { GranularidadLiquidacion, LiquidacionHistorico, LiquidacionPendiente, LiquidacionMes } from '@/types';

export interface MiLiquidacionApi {
  /** `periodo` es una fecha ancla 'YYYY-MM-DD'; el backend deduce el bucket según la granularidad. */
  historico(usuarioId: string, granularidad: GranularidadLiquidacion, periodo?: string): Promise<LiquidacionHistorico>;
  pendiente(usuarioId: string): Promise<LiquidacionPendiente>;
  mes(usuarioId: string, periodo?: string): Promise<LiquidacionMes>;
}
