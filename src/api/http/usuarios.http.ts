import { apiDownloadBlob, apiFetch, apiUploadFormData } from './_shared';
import type { UsuariosApi } from '../contracts/usuarios';
import type { AsignarBeneficiosPayload, BeneficiosAsignados, ResultadoImportacion, Usuario } from '@/types';

export const usuariosHttp: UsuariosApi = {
  list() {
    return apiFetch<Usuario[]>('usuarios');
  },

  create(usuario) {
    return apiFetch<Usuario>('usuarios', { method: 'POST', body: JSON.stringify(usuario) });
  },

  update(id, data) {
    return apiFetch<Usuario>(`usuarios/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async remove(id) {
    await apiFetch<unknown>(`usuarios/${id}`, { method: 'DELETE' });
  },

  async enviarAccesos(id) {
    await apiFetch<{ enviado: boolean }>(`usuarios/${id}/enviar-accesos`, { method: 'POST' });
  },

  async enviarAccesosDirecto(id, password) {
    await apiFetch<{ enviado: boolean }>(`usuarios/${id}/enviar-accesos-directo`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  beneficiosAsignados(id) {
    return apiFetch<BeneficiosAsignados>(`usuarios/${id}/asignar-beneficios`);
  },

  asignarBeneficios(id, data: AsignarBeneficiosPayload) {
    return apiFetch<BeneficiosAsignados>(`usuarios/${id}/asignar-beneficios`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

/**
 * Carga masiva de clientes-alumnos desde Excel (ver UsuariosController::importarAlumnosExcel).
 *
 * Curso y beneficio van POR FILA dentro del archivo, no como parámetros: la plantilla descargable
 * trae esas dos columnas con lista desplegable.
 */
export function importarAlumnosExcel(archivo: File): Promise<ResultadoImportacion> {
  const form = new FormData();
  form.append('archivo', archivo, archivo.name);

  return apiUploadFormData<ResultadoImportacion>('usuarios/importar-alumnos', form);
}

/**
 * Descarga el .xlsx de ejemplo. Se genera en el servidor porque sus desplegables de Curso y
 * Beneficio se arman con los datos vivos de la BD.
 */
export function descargarPlantillaAlumnos(): Promise<void> {
  return apiDownloadBlob('usuarios/plantilla-alumnos', 'formato-alumnos.xlsx');
}
