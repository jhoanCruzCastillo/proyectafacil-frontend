import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { temasEspecialidadHttp } from '@/api/http/temasEspecialidad.http';

// Catálogo global de temas de especialidad (Proyectos de Inversión, Ejecución de Obras...) —
// SEPARADO de useSectoresQuery (sectores MEF de las fichas/plantillas).
export function useTemasEspecialidadCatalogoQuery() {
  return useQuery({
    queryKey: ['temas-especialidad'],
    queryFn: () => temasEspecialidadHttp.catalogo(),
  });
}

export function useTemasEspecialidadAsesorQuery(usuarioId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['temas-especialidad-asesor', usuarioId],
    queryFn: () => temasEspecialidadHttp.delAsesor(toValue(usuarioId)),
    enabled: () => !!toValue(usuarioId),
  });
}

export function useGuardarTemasEspecialidadAsesor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ usuarioId, temaIds }: { usuarioId: string; temaIds: string[] }) =>
      temasEspecialidadHttp.guardarDelAsesor(usuarioId, temaIds),
    onSuccess: (_data, { usuarioId }) =>
      queryClient.invalidateQueries({ queryKey: ['temas-especialidad-asesor', usuarioId] }),
  });
}
