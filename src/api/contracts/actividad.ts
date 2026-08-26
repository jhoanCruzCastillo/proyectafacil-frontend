import type { ActividadReciente, ActividadPaginada } from '@/types';

export interface ActividadApi {
  list(): Promise<ActividadReciente[]>;
  push(mensaje: string, color: ActividadReciente['color'], categoria?: string): Promise<ActividadReciente>;
  /** Actividad de un usuario puntual (tab "Actividad") — paginada, con ventana de días. */
  porActor(actorId: string, opts?: { dias?: number; pagina?: number; porPagina?: number }): Promise<ActividadPaginada>;
  /** Última entrada categoria="Perfil" con objetivoId = usuarioId — "Últimas modificaciones del perfil". */
  ultimaModificacionPerfil(usuarioId: string): Promise<ActividadReciente | null>;
}
