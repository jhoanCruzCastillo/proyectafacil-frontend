import type { DashboardAsesoria, DocenteDisponibleAhora, HistorialConexion, SolicitudAsesoria, TicketAsesoriaDetalle } from '@/types';

export interface TicketsAsesoriaApi {
  dashboard(): Promise<DashboardAsesoria>;
  index(): Promise<SolicitudAsesoria[]>;
  detalle(id: string): Promise<TicketAsesoriaDetalle>;
  historialConexion(id: string): Promise<HistorialConexion>;
  docentesDisponibles(id: string): Promise<DocenteDisponibleAhora[]>;
  asignar(id: string, asesorId: string): Promise<SolicitudAsesoria>;
  marcarEnEspera(id: string): Promise<SolicitudAsesoria>;
  reabrirHorario(id: string): Promise<SolicitudAsesoria>;
  cancelar(id: string): Promise<SolicitudAsesoria>;
  mismoHorario(fecha: string, horaInicio: string, horaFin: string): Promise<SolicitudAsesoria[]>;
}
