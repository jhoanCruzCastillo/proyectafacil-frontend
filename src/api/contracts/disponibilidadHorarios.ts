import type { BloqueHorario } from './docentes';

/** Igual que BloqueHorario pero con el docente que lo ofrece — necesario para saber si, cuando
 * varios asesores comparten el mismo bloque recurrente, todavía queda alguno libre en una fecha
 * puntual (ver AsesoriaController::agendadosPorRango). */
export type BloqueHorarioAgregado = BloqueHorario & { docenteId: string };

export interface DisponibilidadHorariosApi {
  agregada(): Promise<BloqueHorarioAgregado[]>;
}
