import { apiFetch } from './_shared';
import type { LiquidacionesApi } from '../contracts/liquidaciones';
import type { Liquidaciones } from '@/types';

export const liquidacionesHttp: LiquidacionesApi = {
  get(periodo) {
    return apiFetch<Liquidaciones>(`asesoria/liquidaciones?periodo=${periodo}`);
  },

  async autorizarPago(asesorIds, periodo) {
    await apiFetch<unknown>('asesoria/liquidaciones/autorizar', {
      method: 'POST',
      body: JSON.stringify({ asesorIds, periodo }),
    });
  },
};
