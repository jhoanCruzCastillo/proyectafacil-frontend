import { apiFetch } from './_shared';
import type { AsesoriaApi, BloqueAgendado } from '../contracts/asesoria';
import type { SolicitudAsesoria, MensajeAsesoria, NoAtendidasAsesor } from '@/types';

export const asesoriaHttp: AsesoriaApi = {
  misSolicitudes(usuarioId, rol) {
    return apiFetch<SolicitudAsesoria[]>(`asesoria/solicitudes?usuarioId=${usuarioId}&rol=${rol}`);
  },

  noAtendidas(usuarioId) {
    return apiFetch<NoAtendidasAsesor>(`asesoria/no-atendidas?usuarioId=${usuarioId}`);
  },

  agendadosPorRango(desde, hasta) {
    return apiFetch<BloqueAgendado[]>(`asesoria/agendados-por-rango?desde=${desde}&hasta=${hasta}`);
  },

  crear(data) {
    return apiFetch<SolicitudAsesoria>('asesoria/solicitudes', { method: 'POST', body: JSON.stringify(data) });
  },

  aceptar(solicitudId, asesorId, linkReunion) {
    return apiFetch<SolicitudAsesoria>(`asesoria/solicitudes/${solicitudId}/aceptar`, {
      method: 'POST',
      body: JSON.stringify({ asesorId, linkReunion }),
    });
  },

  finalizar(solicitudId) {
    return apiFetch<SolicitudAsesoria>(`asesoria/solicitudes/${solicitudId}/finalizar`, { method: 'POST' });
  },

  completarVideo(solicitudId) {
    return apiFetch<SolicitudAsesoria>(`asesoria/solicitudes/${solicitudId}/completar-video`, { method: 'POST' });
  },

  cancelar(solicitudId) {
    return apiFetch<SolicitudAsesoria>(`asesoria/solicitudes/${solicitudId}/cancelar`, { method: 'POST' });
  },

  calificar(solicitudId, estrellas, comentario) {
    return apiFetch<SolicitudAsesoria>(`asesoria/solicitudes/${solicitudId}/calificar`, {
      method: 'POST',
      body: JSON.stringify({ estrellas, comentario }),
    });
  },

  mensajes(solicitudId, visorId) {
    const query = visorId ? `?visorId=${visorId}` : '';
    return apiFetch<MensajeAsesoria[]>(`asesoria/solicitudes/${solicitudId}/mensajes${query}`);
  },

  enviarMensaje(solicitudId, autorId, texto, adjunto) {
    return apiFetch<MensajeAsesoria[]>(`asesoria/solicitudes/${solicitudId}/mensajes`, {
      method: 'POST',
      body: JSON.stringify({
        autorId,
        texto,
        ...(adjunto ? { adjuntoUrl: adjunto.url, adjuntoNombre: adjunto.nombre, adjuntoTipo: adjunto.tipo } : {}),
      }),
    });
  },

  subirAdjunto(dataUrl, nombre, tipo) {
    return apiFetch<{ url: string }>('asesoria/adjuntos', {
      method: 'POST',
      body: JSON.stringify({ dataUrl, nombre, tipo }),
    });
  },
};
