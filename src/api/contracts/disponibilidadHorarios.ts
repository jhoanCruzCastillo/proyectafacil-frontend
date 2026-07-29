import type { BloqueHorario } from './docentes';

export interface DisponibilidadHorariosApi {
  agregada(): Promise<BloqueHorario[]>;
}
