import { apiFetch, apiUploadFormData } from './_shared';
import type { ContextosIAArchivosApi } from '../contracts/contextosIAArchivos';
import type { ContextoIAArchivoGeneral } from '@/types';

export const contextosIAArchivosHttp: ContextosIAArchivosApi = {
  porPlantilla(plantillaId) {
    return apiFetch<ContextoIAArchivoGeneral[]>(`plantillas/${plantillaId}/contextos-ia/archivos-generales`);
  },

  subir(plantillaId, file, onProgress) {
    const form = new FormData();
    form.append('archivo', file, file.name);
    return apiUploadFormData<ContextoIAArchivoGeneral[]>(`plantillas/${plantillaId}/contextos-ia/archivos-generales`, form, (fraction) => {
      if (fraction >= 1) onProgress?.(1, 'Guardando en Cloudinary…');
      else onProgress?.(fraction, 'Subiendo al servidor…');
    });
  },

  eliminar(plantillaId, archivoId) {
    return apiFetch<ContextoIAArchivoGeneral[]>(`plantillas/${plantillaId}/contextos-ia/archivos-generales/${archivoId}`, { method: 'DELETE' });
  },
};
