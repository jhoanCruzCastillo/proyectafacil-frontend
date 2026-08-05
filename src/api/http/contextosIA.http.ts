import { apiFetch } from './_shared';
import type { ContextosIAApi } from '../contracts/contextosIA';
import type { ContextosIAPlantilla, ContextoGlobalIA } from '@/types';

export const contextosIAHttp: ContextosIAApi = {
  porPlantilla(plantillaId) {
    return apiFetch<ContextosIAPlantilla>(`plantillas/${plantillaId}/contextos-ia`);
  },

  guardarSeccion(plantillaId, seccionId, markdown, globales) {
    return apiFetch<ContextosIAPlantilla>(`plantillas/${plantillaId}/contextos-ia/${seccionId}`, {
      method: 'PUT',
      body: JSON.stringify({ markdown, globales }),
    });
  },

  eliminarSeccion(plantillaId, seccionId) {
    return apiFetch<ContextosIAPlantilla>(`plantillas/${plantillaId}/contextos-ia/${seccionId}`, { method: 'DELETE' });
  },

  globales() {
    return apiFetch<ContextoGlobalIA[]>('contextos-ia/globales');
  },
};
