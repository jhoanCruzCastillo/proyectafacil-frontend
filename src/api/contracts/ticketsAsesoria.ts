import type { DashboardAsesoria, DocenteDisponibleAhora, GrabacionSesion, HistorialConexion, SolicitudAsesoria, TicketAsesoriaDetalle } from '@/types';

export interface TicketsAsesoriaApi {
  dashboard(): Promise<DashboardAsesoria>;
  index(): Promise<SolicitudAsesoria[]>;
  detalle(id: string): Promise<TicketAsesoriaDetalle>;
  historialConexion(id: string): Promise<HistorialConexion>;
  grabaciones(id: string): Promise<GrabacionSesion[]>;
  docentesDisponibles(id: string): Promise<DocenteDisponibleAhora[]>;
  asignar(id: string, asesorId: string): Promise<SolicitudAsesoria>;
  marcarEnEspera(id: string): Promise<SolicitudAsesoria>;
  reabrirHorario(id: string): Promise<SolicitudAsesoria>;
  cancelar(id: string): Promise<SolicitudAsesoria>;
  completarVideo(id: string): Promise<SolicitudAsesoria>;
  mismoHorario(fecha: string, horaInicio: string, horaFin: string): Promise<SolicitudAsesoria[]>;
}
