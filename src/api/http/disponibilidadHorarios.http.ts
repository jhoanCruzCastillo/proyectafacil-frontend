import { apiFetch } from './_shared';
import type { DisponibilidadHorariosApi, BloqueHorarioAgregado } from '../contracts/disponibilidadHorarios';

export const disponibilidadHorariosHttp: DisponibilidadHorariosApi = {
  agregada() {
    return apiFetch<BloqueHorarioAgregado[]>('disponibilidad-horarios');
  },
};
