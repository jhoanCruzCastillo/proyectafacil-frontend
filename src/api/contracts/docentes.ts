import type { Docente, HorarioDocente, ExcepcionHorarioDocente } from '@/types';

export type BloqueHorario = Pick<HorarioDocente, 'fechaInicio' | 'horaInicio' | 'horaFin' | 'todoElDia' | 'tipoRepeticion'>;
export type BloqueExcepcion = Pick<ExcepcionHorarioDocente, 'fecha' | 'horaInicio' | 'horaFin'>;

export interface DocentesApi {
  list(): Promise<Docente[]>;
  actualizarHorario(docenteId: string, horario: BloqueHorario[]): Promise<HorarioDocente[]>;
  excepciones(docenteId: string): Promise<ExcepcionHorarioDocente[]>;
  actualizarExcepciones(docenteId: string, excepciones: BloqueExcepcion[]): Promise<ExcepcionHorarioDocente[]>;
}
