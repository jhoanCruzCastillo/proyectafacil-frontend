import { apiFetch } from './_shared';
import type { DocentesApi } from '../contracts/docentes';
import type { Docente, HorarioDocente, ExcepcionHorarioDocente } from '@/types';

export const docentesHttp: DocentesApi = {
  list() {
    return apiFetch<Docente[]>('docentes');
  },

  actualizarHorario(docenteId, horario) {
    return apiFetch<HorarioDocente[]>(`docentes/${docenteId}/horario`, {
      method: 'PUT',
      body: JSON.stringify({ horario }),
    });
  },

  excepciones(docenteId) {
    return apiFetch<ExcepcionHorarioDocente[]>(`docentes/${docenteId}/excepciones`);
  },

  actualizarExcepciones(docenteId, excepciones) {
    return apiFetch<ExcepcionHorarioDocente[]>(`docentes/${docenteId}/excepciones`, {
      method: 'PUT',
      body: JSON.stringify({ excepciones }),
    });
  },
};
