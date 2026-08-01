import { apiFetch } from './_shared';
import type { SubtemasEspecialidadApi } from '../contracts/subtemasEspecialidad';
import type { SubtemaEspecialidad } from '@/types';

export const subtemasEspecialidadHttp: SubtemasEspecialidadApi = {
  catalogo() {
    return apiFetch<SubtemaEspecialidad[]>('subtemas-especialidad');
  },

  delAsesor(usuarioId) {
    return apiFetch<string[]>(`subtemas-asesor/${usuarioId}`);
  },

  guardarDelAsesor(usuarioId, subtemaIds) {
    return apiFetch<string[]>(`subtemas-asesor/${usuarioId}`, {
      method: 'PUT',
      body: JSON.stringify({ subtemaIds }),
    });
  },
};
