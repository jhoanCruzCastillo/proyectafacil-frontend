// `notificaciones.tipo` es un slug interno (ver AsesoriaController/SolicitudAsesoriaHelpersTrait
// backend, `notificar()`/`notificarAdministrativos()`, y IaEjecutarLlenado::avisar) — `mensaje` ya
// trae la oración completa con el detalle puntual (a quién, cuál ficha, cuántos campos…), así que
// acá solo hace falta un título corto por categoría para la campanita (ver NotificacionesBell.vue).
const TITULO_POR_TIPO: Record<string, string> = {
  llenado_ia_completado: 'Ficha completada',
  nueva_solicitud_asesoria: 'Nueva solicitud de asesoría',
  solicitud_aceptada: 'Solicitud aceptada',
  solicitud_completada: 'Asesoría completada',
  solicitud_cancelada: 'Solicitud cancelada',
  nuevo_mensaje: 'Nuevo mensaje',
  reabrir_horario: 'Elige un nuevo horario',
};

/** `SolicitudAsesoriaHelpersTrait::avanzarEstado` arma tipos dinámicos `solicitud_<estado>` (ej.
 * `solicitud_asignado`, `solicitud_agendado`) que no están en el mapa fijo de arriba — se cubren con
 * un título genérico en vez de mostrar el slug crudo. */
export function tituloNotificacion(tipo: string): string {
  if (TITULO_POR_TIPO[tipo]) return TITULO_POR_TIPO[tipo];
  if (tipo.startsWith('solicitud_')) return 'Actualización de tu solicitud';
  return 'Notificación';
}
