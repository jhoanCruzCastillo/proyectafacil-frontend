import { apiFetch } from './_shared';
import type { CursosApi } from '../contracts/cursos';
import type { Curso } from '@/types';

export const cursosHttp: CursosApi = {
  list() {
    return apiFetch<Curso[]>('cursos');
  },

  create(datos) {
    return apiFetch<Curso>('cursos', { method: 'POST', body: JSON.stringify(datos) });
  },
};
