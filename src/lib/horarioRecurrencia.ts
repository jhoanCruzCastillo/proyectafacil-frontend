// Expansión de reglas de disponibilidad recurrente (fecha ancla + tipo de repetición) a
// ocurrencias concretas en un rango de fechas — único lugar con esta lógica, usado por
// HorarioDocenteEditor.vue, CronogramaPage.vue y SolicitarAsesoriaModal.vue para que los tres
// interpreten el mismo modelo de datos exactamente igual.
import type { TipoRepeticionHorario } from '@/types';

export type TipoRepeticion = TipoRepeticionHorario;

// Sin `id` a propósito — BloqueHorarioAgregado (disponibilidadHorarios.ts) no trae uno propio.
// Quien lo necesite (ej. HorarioDocenteEditor.vue) lo agrega en su propio tipo local; el genérico
// de ocurrenciasEnRango lo preserva igual vía `T & { fecha: string }`.
export interface ReglaHorario {
  /** "YYYY-MM-DD" — primera ocurrencia de la regla. */
  fechaInicio: string;
  /** "HH:MM" */
  horaInicio: string;
  /** "HH:MM" */
  horaFin: string;
  todoElDia: boolean;
  tipoRepeticion: TipoRepeticion;
}

function fechaLocalDesdeIso(fechaIso: string): Date {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

function diffDias(desde: Date, hasta: Date): number {
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  return Math.round((hasta.getTime() - desde.getTime()) / MS_POR_DIA);
}

export function ocurreEnFecha(regla: ReglaHorario, fechaIso: string): boolean {
  if (fechaIso < regla.fechaInicio) return false;

  const inicio = fechaLocalDesdeIso(regla.fechaInicio);
  const objetivo = fechaLocalDesdeIso(fechaIso);

  switch (regla.tipoRepeticion) {
    case 'diaria':
      return true;
    case 'lunes_a_viernes': {
      const dia = objetivo.getDay();
      return dia >= 1 && dia <= 5;
    }
    case 'semanal':
      return diffDias(inicio, objetivo) % 7 === 0;
    case 'mensual':
      return inicio.getDate() === objetivo.getDate();
    case 'anual':
      return inicio.getMonth() === objetivo.getMonth() && inicio.getDate() === objetivo.getDate();
    default:
      return false;
  }
}

function fechaISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

/** Todas las ocurrencias de `reglas` entre `desdeIso` y `hastaIso`, ambos inclusive. */
export function ocurrenciasEnRango<T extends ReglaHorario>(reglas: T[], desdeIso: string, hastaIso: string): Array<T & { fecha: string }> {
  const resultado: Array<T & { fecha: string }> = [];
  let cursor = fechaLocalDesdeIso(desdeIso);
  const fin = fechaLocalDesdeIso(hastaIso);
  while (cursor <= fin) {
    const fecha = fechaISO(cursor);
    for (const regla of reglas) {
      if (ocurreEnFecha(regla, fecha)) resultado.push({ ...regla, fecha });
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  return resultado;
}

export const REPETICION_LABELS: Record<TipoRepeticion, string> = {
  diaria: 'Diariamente',
  lunes_a_viernes: 'Lunes a viernes',
  semanal: 'Semanalmente',
  mensual: 'Mensualmente',
  anual: 'Anualmente',
};
