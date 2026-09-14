import { apiFetch } from './_shared';
import type { TemasEspecialidadApi } from '../contracts/temasEspecialidad';
import type { TemaEspecialidad } from '@/types';

export const temasEspecialidadHttp: TemasEspecialidadApi = {
  catalogo() {
    return apiFetch<TemaEspecialidad[]>('temas-especialidad');
  },

  delAsesor(usuarioId) {
    return apiFetch<string[]>(`temas-especialidad-asesor/${usuarioId}`);
  },

  guardarDelAsesor(usuarioId, temaIds) {
    return apiFetch<string[]>(`temas-especialidad-asesor/${usuarioId}`, {
      method: 'PUT',
      body: JSON.stringify({ temaIds }),
    });
  },
};
