import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { rolesPermisosHttp } from '@/api/http/rolesPermisos.http';
import type { PermisoId, RolUsuario } from '@/types';

const queryKey = ['rolesPermisos'] as const;

export function useRolesPermisosQuery() {
  return useQuery({ queryKey, queryFn: () => rolesPermisosHttp.list() });
}

export function useGuardarRolPermisos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rol, permisos }: { rol: RolUsuario; permisos: PermisoId[] }) => rolesPermisosHttp.guardar(rol, permisos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
}
