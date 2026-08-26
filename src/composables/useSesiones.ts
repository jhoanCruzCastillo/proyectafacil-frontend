import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { sesionesApi } from '@/api/sesiones';

const queryKey = ['sesiones'] as const;

// Tab "Sesiones" del panel de detalles — siempre las del actor autenticado (ver SesionesController
// en el backend: nunca las de otro usuario, ni para un superusuario viendo la fila de otra persona).
export function useMisSesionesQuery() {
  return useQuery({ queryKey, queryFn: sesionesApi.misSesiones });
}

export function useCerrarSesion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sesionId: string) => sesionesApi.cerrar(sesionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
}
