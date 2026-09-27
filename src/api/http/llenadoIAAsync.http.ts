import { apiFetch } from './_shared';
import type { LlenadoIAAsyncApi } from '../contracts/llenadoIAAsync';

export const llenadoIAAsyncHttp: LlenadoIAAsyncApi = {
  iniciar(ejemploId, seccionIds) {
    return apiFetch(`ejemplos/${ejemploId}/llenado-ia-async`, {
      method: 'POST',
      body: JSON.stringify(seccionIds && seccionIds.length > 0 ? { seccionIds } : {}),
    });
  },

  estado(ejemploId) {
    return apiFetch(`ejemplos/${ejemploId}/llenado-ia-async`);
  },

  cancelar(ejemploId) {
    return apiFetch(`ejemplos/${ejemploId}/llenado-ia-async/cancelar`, { method: 'POST' });
  },
};
