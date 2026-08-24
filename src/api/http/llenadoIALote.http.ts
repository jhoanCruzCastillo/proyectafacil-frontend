import { apiFetch } from './_shared';
import type { EstadoLoteIAResponse, LlenadoIALoteApi, LoteEnviadoIA } from '../contracts/llenadoIALote';

export const llenadoIALoteHttp: LlenadoIALoteApi = {
  enviarLote(ejemploId, seccionIds) {
    const body = seccionIds && seccionIds.length > 0 ? JSON.stringify({ seccionIds }) : JSON.stringify({});
    return apiFetch<LoteEnviadoIA>(`ejemplos/${ejemploId}/llenar-ia-lote`, {
      method: 'POST',
      body,
    });
  },
  estadoLote(ejemploId, loteId) {
    return apiFetch<EstadoLoteIAResponse>(`ejemplos/${ejemploId}/llenar-ia-lote/${loteId}`);
  },
};
