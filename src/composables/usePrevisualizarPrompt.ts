import { useQuery } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { previsualizarPromptHttp } from '@/api/http/previsualizarPrompt.http';

/** Prompt exacto que arma el backend para una sección — solo lectura, sin costo (no llama al modelo). */
export function usePrevisualizarPromptQuery(plantillaId: MaybeRefOrGetter<string>, seccionId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: ['preview-prompt', plantillaId, seccionId],
    queryFn: () => previsualizarPromptHttp.porSeccion(toValue(plantillaId), toValue(seccionId) as string),
    enabled: () => !!toValue(plantillaId) && !!toValue(seccionId),
  });
}
