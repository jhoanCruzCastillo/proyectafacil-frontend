import { apiFetch } from './_shared';
import type { RolesPermisosApi } from '../contracts/rolesPermisos';
import type { PermisoId, RolUsuario } from '@/types';

export const rolesPermisosHttp: RolesPermisosApi = {
  list() {
    return apiFetch<Partial<Record<RolUsuario, PermisoId[]>>>('roles-permisos');
  },

  guardar(rol, permisos) {
    return apiFetch<PermisoId[]>(`roles-permisos/${rol}`, { method: 'PUT', body: JSON.stringify({ permisos }) });
  },
};
