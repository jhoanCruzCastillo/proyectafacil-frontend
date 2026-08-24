import { apiFetch } from './_shared';
import type { TicketsAsesoriaApi } from '../contracts/ticketsAsesoria';
import type { DashboardAsesoria, DocenteDisponibleAhora, HistorialConexion, SolicitudAsesoria, TicketAsesoriaDetalle } from '@/types';

export const ticketsAsesoriaHttp: TicketsAsesoriaApi = {
  dashboard() {
    return apiFetch<DashboardAsesoria>('asesoria/dashboard');
  },

  index() {
    return apiFetch<SolicitudAsesoria[]>('asesoria/tickets');
  },

  detalle(id) {
    return apiFetch<TicketAsesoriaDetalle>(`asesoria/tickets/${id}`);
  },

  historialConexion(id) {
    return apiFetch<HistorialConexion>(`asesoria/tickets/${id}/historial-conexion`);
  },

  docentesDisponibles(id) {
    return apiFetch<DocenteDisponibleAhora[]>(`asesoria/tickets/${id}/docentes-disponibles`);
  },

  asignar(id, asesorId) {
    return apiFetch<SolicitudAsesoria>(`asesoria/tickets/${id}/asignar`, {
      method: 'POST',
      body: JSON.stringify({ asesorId }),
    });
  },

  marcarEnEspera(id) {
    return apiFetch<SolicitudAsesoria>(`asesoria/tickets/${id}/en-espera`, { method: 'POST' });
  },

  reabrirHorario(id) {
    return apiFetch<SolicitudAsesoria>(`asesoria/tickets/${id}/reabrir-horario`, { method: 'POST' });
  },

  cancelar(id) {
    return apiFetch<SolicitudAsesoria>(`asesoria/tickets/${id}/cancelar`, { method: 'POST' });
  },

  mismoHorario(fecha, horaInicio, horaFin) {
    return apiFetch<SolicitudAsesoria[]>(`asesoria/tickets-mismo-horario?fecha=${fecha}&horaInicio=${horaInicio}&horaFin=${horaFin}`);
  },
};
