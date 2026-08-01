import { apiFetch } from './_shared';
import type { AsesoriaApi } from '../contracts/asesoria';
import type { SolicitudAsesoria, MensajeAsesoria, NoAtendidasAsesor } from '@/types';

export const asesoriaHttp: AsesoriaApi = {
  misSolicitudes(usuarioId, rol) {
    return apiFetch<SolicitudAsesoria[]>(`asesoria/solicitudes?usuarioId=${usuarioId}&rol=${rol}`);
  },

  noAtendidas(usuarioId) {
    return apiFetch<NoAtendidasAsesor>(`asesoria/no-atendidas?usuarioId=${usuarioId}`);
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

  cancelar(solicitudId) {
    return apiFetch<SolicitudAsesoria>(`asesoria/solicitudes/${solicitudId}/cancelar`, { method: 'POST' });
  },

  calificar(solicitudId, estrellas, comentario) {
    return apiFetch<SolicitudAsesoria>(`asesoria/solicitudes/${solicitudId}/calificar`, {
      method: 'POST',
      body: JSON.stringify({ estrellas, comentario }),
    });
  },

  mensajes(solicitudId) {
    return apiFetch<MensajeAsesoria[]>(`asesoria/solicitudes/${solicitudId}/mensajes`);
  },

  enviarMensaje(solicitudId, autorId, texto) {
    return apiFetch<MensajeAsesoria[]>(`asesoria/solicitudes/${solicitudId}/mensajes`, {
      method: 'POST',
      body: JSON.stringify({ autorId, texto }),
    });
  },
};
