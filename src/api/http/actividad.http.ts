import { apiFetch } from './_shared';
import type { ActividadApi } from '../contracts/actividad';
import type { ActividadReciente, ActividadPaginada } from '@/types';

export const actividadHttp: ActividadApi = {
  list() {
    return apiFetch<ActividadReciente[]>('actividad');
  },

  push(mensaje, color, categoria) {
    return apiFetch<ActividadReciente>('actividad', { method: 'POST', body: JSON.stringify({ mensaje, color, categoria }) });
  },

  porActor(actorId, opts) {
    const params = new URLSearchParams();
    if (opts?.dias) params.set('dias', String(opts.dias));
    if (opts?.pagina) params.set('pagina', String(opts.pagina));
    if (opts?.porPagina) params.set('porPagina', String(opts.porPagina));
    const qs = params.toString();
    return apiFetch<ActividadPaginada>(`actividad/por-usuario/${actorId}${qs ? `?${qs}` : ''}`);
  },

  ultimaModificacionPerfil(usuarioId) {
    return apiFetch<ActividadReciente | null>(`actividad/ultima-modificacion-perfil/${usuarioId}`);
  },
};
