import { apiFetch } from './_shared';
import type { EspecialidadesAsesorApi } from '../contracts/especialidadesAsesor';

export const especialidadesAsesorHttp: EspecialidadesAsesorApi = {
  list(usuarioId) {
    return apiFetch<string[]>(`especialidades-asesor/${usuarioId}`);
  },

  guardar(usuarioId, sectorIds) {
    return apiFetch<string[]>(`especialidades-asesor/${usuarioId}`, {
      method: 'PUT',
      body: JSON.stringify({ sectorIds }),
    });
  },
};
