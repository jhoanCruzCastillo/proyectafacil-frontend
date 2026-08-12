import { apiFetch } from './_shared';
import type { FuenteVerdadApi, LlenarConIAOptions } from '../contracts/fuenteVerdad';
import type { FuenteVerdad, ResultadoLlenadoIA } from '@/types';

export const fuenteVerdadHttp: FuenteVerdadApi = {
  porEjemplo(ejemploId) {
    return apiFetch<FuenteVerdad>(`ejemplos/${ejemploId}/fuente-verdad`);
  },

  guardarArchivo(ejemploId, nombre, dataUrl) {
    return apiFetch<FuenteVerdad>(`ejemplos/${ejemploId}/fuente-verdad/archivos`, {
      method: 'POST',
      body: JSON.stringify({ nombre, dataUrl }),
    });
  },

  eliminarArchivo(ejemploId, archivoId) {
    return apiFetch<FuenteVerdad>(`ejemplos/${ejemploId}/fuente-verdad/archivos/${archivoId}`, { method: 'DELETE' });
  },

  guardarTexto(ejemploId, texto) {
    return apiFetch<FuenteVerdad>(`ejemplos/${ejemploId}/fuente-verdad/texto`, {
      method: 'PUT',
      body: JSON.stringify({ texto }),
    });
  },

  // Llenado: 1 llamada IA por sección. `seccionIds` acota el alcance; `signal` cancela / timeout.
  llenarConIA(ejemploId, opts: LlenarConIAOptions = {}) {
    const { seccionIds, ...init } = opts;
    const body =
      seccionIds && seccionIds.length > 0
        ? JSON.stringify({ seccionIds })
        : JSON.stringify({});
    return apiFetch<ResultadoLlenadoIA>(`ejemplos/${ejemploId}/llenar-ia`, {
      method: 'POST',
      body,
      ...init,
    });
  },
};
