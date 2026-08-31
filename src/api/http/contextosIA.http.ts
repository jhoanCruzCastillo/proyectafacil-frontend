import { apiFetch } from './_shared';
import type { ContextosIAApi } from '../contracts/contextosIA';
import type { ContextosIAPlantilla, ContextoGeneralIA, ContextoGlobalIA } from '@/types';

export const contextosIAHttp: ContextosIAApi = {
  porPlantilla(plantillaId) {
    return apiFetch<ContextosIAPlantilla>(`plantillas/${plantillaId}/contextos-ia`);
  },

  promptSistemaPredeterminado(plantillaId) {
    return apiFetch<{ markdown: string }>(`plantillas/${plantillaId}/contextos-ia/prompt-sistema-predeterminado`);
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

  guardarGeneral(plantillaId, id, nombre, markdown) {
    return apiFetch<ContextoGeneralIA[]>(
      id ? `plantillas/${plantillaId}/contextos-ia/generales/${id}` : `plantillas/${plantillaId}/contextos-ia/generales`,
      { method: id ? 'PUT' : 'POST', body: JSON.stringify({ nombre, markdown }) },
    );
  },

  eliminarGeneral(plantillaId, id) {
    return apiFetch<ContextoGeneralIA[]>(`plantillas/${plantillaId}/contextos-ia/generales/${id}`, { method: 'DELETE' });
  },

  globales() {
    return apiFetch<ContextoGlobalIA[]>('contextos-ia/globales');
  },

  guardarGlobal(id, nombre, markdown, icono) {
    return apiFetch<ContextoGlobalIA[]>(id ? `contextos-ia/globales/${id}` : 'contextos-ia/globales', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ nombre, markdown, icono }),
    });
  },

  eliminarGlobal(id) {
    return apiFetch<ContextoGlobalIA[]>(`contextos-ia/globales/${id}`, { method: 'DELETE' });
  },

  guardarPaso(plantillaId, paso, tipo, insumoId) {
    return apiFetch<ContextosIAPlantilla>(`plantillas/${plantillaId}/contextos-ia/pasos/${paso}`, {
      method: 'POST',
      body: JSON.stringify({ tipo, insumoId }),
    });
  },

  eliminarPaso(plantillaId, asignacionId) {
    return apiFetch<ContextosIAPlantilla>(`plantillas/${plantillaId}/contextos-ia/pasos-asignaciones/${asignacionId}`, { method: 'DELETE' });
  },
};
