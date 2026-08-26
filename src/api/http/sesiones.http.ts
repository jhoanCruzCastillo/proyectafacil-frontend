import { apiFetch } from './_shared';
import type { SesionesApi } from '../contracts/sesiones';
import type { SesionUsuario } from '@/types';

export const sesionesHttp: SesionesApi = {
  misSesiones() {
    return apiFetch<SesionUsuario[]>('sesiones');
  },

  async cerrar(sesionId) {
    await apiFetch<{ cerrada: boolean }>(`sesiones/${sesionId}/cerrar`, { method: 'POST' });
  },
};
