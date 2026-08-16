import { apiFetch, apiUploadFormData } from './_shared';
import type { ArchivosExcelApi } from '../contracts/archivosExcel';
import type { CatalogoExcelPlantilla } from '@/types';

export const archivosExcelHttp: ArchivosExcelApi = {
  getCatalogo(plantillaId) {
    return apiFetch<CatalogoExcelPlantilla>(`plantillas/${plantillaId}/archivos`);
  },

  addArchivo(plantillaId, file, onProgress) {
    const form = new FormData();
    form.append('archivo', file, file.name);
    return apiUploadFormData<CatalogoExcelPlantilla>(`plantillas/${plantillaId}/archivos`, form, (fraction) => {
      if (fraction >= 1) onProgress?.(1, 'Guardando en Railway…');
      else onProgress?.(fraction, 'Subiendo al servidor…');
    });
  },

  deleteArchivo(plantillaId, archivoId) {
    return apiFetch<CatalogoExcelPlantilla>(`plantillas/${plantillaId}/archivos/${archivoId}`, { method: 'DELETE' });
  },

  asignarArchivo(plantillaId, archivoId) {
    return apiFetch<CatalogoExcelPlantilla>(`plantillas/${plantillaId}/archivos/${archivoId}/asignar`, { method: 'POST' });
  },
};
