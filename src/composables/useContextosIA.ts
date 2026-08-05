import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { contextosIAHttp } from '@/api/http/contextosIA.http';

export function useContextosIAQuery(plantillaId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['contextos-ia', plantillaId],
    queryFn: () => contextosIAHttp.porPlantilla(toValue(plantillaId)),
    enabled: () => !!toValue(plantillaId),
  });
}

export function useGuardarContextoSeccion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plantillaId, seccionId, markdown, globales }: { plantillaId: string; seccionId: string; markdown: string; globales: string[] }) =>
      contextosIAHttp.guardarSeccion(plantillaId, seccionId, markdown, globales),
    onSuccess: (_d, { plantillaId }) => queryClient.invalidateQueries({ queryKey: ['contextos-ia', plantillaId] }),
  });
}

export function useEliminarContextoSeccion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plantillaId, seccionId }: { plantillaId: string; seccionId: string }) =>
      contextosIAHttp.eliminarSeccion(plantillaId, seccionId),
    onSuccess: (_d, { plantillaId }) => queryClient.invalidateQueries({ queryKey: ['contextos-ia', plantillaId] }),
  });
}
