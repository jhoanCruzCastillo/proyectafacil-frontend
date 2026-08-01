import { apiFetch } from './_shared';
import type { MiLiquidacionApi } from '../contracts/miLiquidacion';
import type { LiquidacionHistorico, LiquidacionPendiente, LiquidacionMes } from '@/types';

export const miLiquidacionHttp: MiLiquidacionApi = {
  historico(usuarioId, granularidad, periodo) {
    const p = periodo ? `&periodo=${periodo}` : '';
    return apiFetch<LiquidacionHistorico>(`mi-liquidacion/historico?usuarioId=${usuarioId}&granularidad=${granularidad}${p}`);
  },

  pendiente(usuarioId) {
    return apiFetch<LiquidacionPendiente>(`mi-liquidacion/pendiente?usuarioId=${usuarioId}`);
  },

  mes(usuarioId, periodo) {
    const p = periodo ? `&periodo=${periodo}` : '';
    return apiFetch<LiquidacionMes>(`mi-liquidacion/mes?usuarioId=${usuarioId}${p}`);
  },
};
