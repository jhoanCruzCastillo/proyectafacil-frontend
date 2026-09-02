import { apiFetch } from './_shared';
import type { TicketsAsesoriaApi } from '../contracts/ticketsAsesoria';
import type { DashboardAsesoria, DocenteDisponibleAhora, GrabacionSesion, HistorialConexion, SolicitudAsesoria, TicketAsesoriaDetalle } from '@/types';

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

  grabaciones(id) {
    return apiFetch<GrabacionSesion[]>(`asesoria/tickets/${id}/grabaciones`);
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

  completarVideo(id) {
    return apiFetch<SolicitudAsesoria>(`asesoria/tickets/${id}/completar-video`, { method: 'POST' });
  },

  mismoHorario(fecha, horaInicio, horaFin) {
    return apiFetch<SolicitudAsesoria[]>(`asesoria/tickets-mismo-horario?fecha=${fecha}&horaInicio=${horaInicio}&horaFin=${horaFin}`);
  },
};
