import { apiFetch } from './_shared';

export interface EstadoSistema {
  mantenimiento: boolean;
  mensaje: string;
}

export function obtenerEstadoSistema(): Promise<EstadoSistema> {
  return apiFetch<EstadoSistema>('estado-sistema');
}
