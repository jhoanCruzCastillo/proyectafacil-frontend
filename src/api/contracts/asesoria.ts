import type { SolicitudAsesoria, MensajeAsesoria, TipoAsesoria, TipoDocumento } from '@/types';

export interface CrearSolicitudAsesoriaData {
  clienteId: string;
  tipo: TipoAsesoria;
  sectorId: string;
  tipoDocumento: TipoDocumento;
  mensajeInicial: string;
  ejemploId?: string;
  /** Solo para tipo 'video' — horario elegido en la grilla agregada */
  horarioFecha?: string;
  horarioHoraInicio?: string;
  horarioHoraFin?: string;
}

export interface AsesoriaApi {
  misSolicitudes(usuarioId: string, rol: 'cliente' | 'asesor'): Promise<SolicitudAsesoria[]>;
  crear(data: CrearSolicitudAsesoriaData): Promise<SolicitudAsesoria>;
  /** Puede rechazar con 409 si otro asesor ya la tomó — apiFetch propaga el mensaje del backend. */
  aceptar(solicitudId: string, asesorId: string, linkReunion?: string): Promise<SolicitudAsesoria>;
  finalizar(solicitudId: string): Promise<SolicitudAsesoria>;
  cancelar(solicitudId: string): Promise<SolicitudAsesoria>;
  calificar(solicitudId: string, estrellas: number, comentario?: string): Promise<SolicitudAsesoria>;
  mensajes(solicitudId: string): Promise<MensajeAsesoria[]>;
  enviarMensaje(solicitudId: string, autorId: string, texto: string): Promise<MensajeAsesoria[]>;
}
