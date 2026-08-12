import { apiFetch } from './_shared';
import type { FuenteVerdadApi } from '../contracts/fuenteVerdad';
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

  // Llenado automático de toda la ficha — puede tardar varios minutos (una llamada a la IA por
  // sección): sin esto el fetch por defecto no tiene timeout propio del navegador, así que no hace
  // falta nada especial acá, pero el caller debe mostrar un estado de carga acorde.
  llenarConIA(ejemploId) {
    return apiFetch<ResultadoLlenadoIA>(`ejemplos/${ejemploId}/llenar-ia`, { method: 'POST' });
  },
};
