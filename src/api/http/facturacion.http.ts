import { apiFetch } from './_shared';
import type { FacturacionApi } from '../contracts/facturacion';
import type { FacturacionMock, ResumenNivelesFacturacion } from '@/types';

export const facturacionHttp: FacturacionApi = {
  get(usuarioId) {
    return apiFetch<FacturacionMock>(`facturacion/${usuarioId}`);
  },

  update(usuarioId, data) {
    return apiFetch<FacturacionMock>(`facturacion/${usuarioId}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  resumenNiveles() {
    return apiFetch<ResumenNivelesFacturacion>('facturacion/resumen-niveles');
  },
};
