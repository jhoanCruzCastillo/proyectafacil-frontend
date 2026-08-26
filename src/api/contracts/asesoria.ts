import type { SolicitudAsesoria, MensajeAsesoria, TipoAsesoria, TipoDocumento, NoAtendidasAsesor } from '@/types';

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

/** Un bloque de video ya agendado (con docente asignado) en una fecha puntual — usado para saber
 * si un horario recurrente sigue teniendo algún docente libre esa fecha específica. */
export interface BloqueAgendado {
  docenteId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export interface AsesoriaApi {
  misSolicitudes(usuarioId: string, rol: 'cliente' | 'asesor'): Promise<SolicitudAsesoria[]>;
  /** Las dos listas de "No atendidas / reasignadas" del asesor. */
  noAtendidas(usuarioId: string): Promise<NoAtendidasAsesor>;
  /** Bloques de video ya agendados dentro de [desde, hasta] (YYYY-MM-DD, inclusive). */
  agendadosPorRango(desde: string, hasta: string): Promise<BloqueAgendado[]>;
  crear(data: CrearSolicitudAsesoriaData): Promise<SolicitudAsesoria>;
  /** Puede rechazar con 409 si otro asesor ya la tomó — apiFetch propaga el mensaje del backend. */
  aceptar(solicitudId: string, asesorId: string, linkReunion?: string): Promise<SolicitudAsesoria>;
  finalizar(solicitudId: string): Promise<SolicitudAsesoria>;
  /** Cierre manual de una videollamada 'agendada' ya terminada — puede rechazar con 422 si todavía no pasó el horario + margen de salida. */
  completarVideo(solicitudId: string): Promise<SolicitudAsesoria>;
  cancelar(solicitudId: string): Promise<SolicitudAsesoria>;
  calificar(solicitudId: string, estrellas: number, comentario?: string): Promise<SolicitudAsesoria>;
  mensajes(solicitudId: string): Promise<MensajeAsesoria[]>;
  enviarMensaje(solicitudId: string, autorId: string, texto: string, adjunto?: { url: string; nombre: string; tipo: string }): Promise<MensajeAsesoria[]>;
  /** Sube un adjunto de chat (cualquier tipo de archivo) a Cloudinary y devuelve su URL — se usa
   * después como `adjunto` en enviarMensaje(). */
  subirAdjunto(dataUrl: string, nombre: string, tipo: string): Promise<{ url: string }>;
}
