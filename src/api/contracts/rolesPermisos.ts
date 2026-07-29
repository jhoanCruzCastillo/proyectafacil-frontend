import type { PermisoId, RolUsuario } from '@/types';

export interface RolesPermisosApi {
  list(): Promise<Partial<Record<RolUsuario, PermisoId[]>>>;
  guardar(rol: RolUsuario, permisos: PermisoId[]): Promise<PermisoId[]>;
}
