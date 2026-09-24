import { apiFetch, apiUploadFormData, apiUploadJson } from './_shared';
import { getAuthToken } from '@/lib/authToken';
import type { CandidatosApi } from '../contracts/candidatos';
import type { Candidato, CandidatoDetalle, NotaCandidato, ResultadoImportacion, ResumenCandidatos } from '@/types';

export const candidatosHttp: CandidatosApi = {
  list() {
    return apiFetch<Candidato[]>('candidatos');
  },
  resumen() {
    return apiFetch<ResumenCandidatos>('candidatos/resumen');
  },
  detalle(id) {
    return apiFetch<CandidatoDetalle>(`candidatos/${id}`);
  },
  notas(id) {
    return apiFetch<NotaCandidato[]>(`candidatos/${id}/notas`);
  },
  agregarNota(id, texto) {
    return apiUploadJson<NotaCandidato[]>(`candidatos/${id}/notas`, { texto });
  },
  cambiarEstado(id, estado) {
    return apiFetch<CandidatoDetalle>(`candidatos/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    });
  },
  eliminar(id) {
    return apiFetch<void>(`candidatos/${id}`, { method: 'DELETE' });
  },
};

/** Descarga el CV del candidato (proxy admin, nunca URL pública directa) y dispara el guardado. */
export async function descargarCvCandidato(id: string, nombreArchivo: string): Promise<void> {
  const token = getAuthToken();
  const res = await fetch(`/api/candidatos/${id}/cv`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('No se pudo descargar el CV.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  link.click();
  URL.revokeObjectURL(url);
}

/** Carga masiva de especialistas desde Excel — entran directo como asesores (ver CandidatosController::importarExcel). */
export function importarEspecialistasExcel(archivo: File): Promise<ResultadoImportacion> {
  const form = new FormData();
  form.append('archivo', archivo, archivo.name);

  return apiUploadFormData<ResultadoImportacion>('candidatos/importar', form);
}

/** Descarga el .xlsx de candidatos (con los filtros activos) y dispara el guardado en el
 * navegador. Requiere Bearer, así que no puede ser un <a href> directo — se pide como blob. */
export async function exportarCandidatosExcel(filtros: { estado?: string; q?: string }): Promise<void> {
  const params = new URLSearchParams();
  if (filtros.estado && filtros.estado !== 'todos') params.set('estado', filtros.estado);
  if (filtros.q) params.set('q', filtros.q);
  const qs = params.toString();

  const token = getAuthToken();
  const res = await fetch(`/api/candidatos/exportar${qs ? `?${qs}` : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('No se pudo generar el Excel de candidatos.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'candidatos.xlsx';
  link.click();
  URL.revokeObjectURL(url);
}
