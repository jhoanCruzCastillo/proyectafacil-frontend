import { apiFetch } from './_shared';
import type { DisponibilidadHorariosApi } from '../contracts/disponibilidadHorarios';
import type { BloqueHorario } from '../contracts/docentes';

export const disponibilidadHorariosHttp: DisponibilidadHorariosApi = {
  agregada() {
    return apiFetch<BloqueHorario[]>('disponibilidad-horarios');
  },
};
