import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { actividadApi } from '@/api/actividad';
import type { ActividadReciente } from '@/types';

const queryKey = ['actividad'] as const;

export function useActividadQuery() {
  return useQuery({ queryKey, queryFn: actividadApi.list });
}

// Tab "Actividad" del panel de detalles — lo que ESTE usuario hizo, paginado y con ventana de días.
export function useActividadPorActorQuery(
  actorId: MaybeRefOrGetter<string>,
  dias: MaybeRefOrGetter<number>,
  pagina: MaybeRefOrGetter<number>,
) {
  return useQuery({
    queryKey: ['actividad', 'por-actor', actorId, dias, pagina],
    queryFn: () => actividadApi.porActor(toValue(actorId), { dias: toValue(dias), pagina: toValue(pagina), porPagina: 5 }),
    enabled: () => !!toValue(actorId),
  });
}

// "Últimas modificaciones del perfil" (tab Información) — lo último que le pasó a este usuario.
export function useUltimaModificacionPerfilQuery(usuarioId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['actividad', 'ultima-modificacion-perfil', usuarioId],
    queryFn: () => actividadApi.ultimaModificacionPerfil(toValue(usuarioId)),
    enabled: () => !!toValue(usuarioId),
  });
}

export function usePushActividad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mensaje, color, categoria }: { mensaje: string; color: ActividadReciente['color']; categoria?: string }) =>
      actividadApi.push(mensaje, color, categoria),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
}
