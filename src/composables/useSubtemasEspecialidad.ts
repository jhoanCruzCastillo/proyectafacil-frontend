import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { subtemasEspecialidadHttp } from '@/api/http/subtemasEspecialidad.http';

// El catálogo es global y casi estático — no depende del usuario, así que va con su propia clave.
export function useSubtemasCatalogoQuery() {
  return useQuery({
    queryKey: ['subtemas-especialidad'],
    queryFn: () => subtemasEspecialidadHttp.catalogo(),
  });
}

export function useSubtemasAsesorQuery(usuarioId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['subtemas-asesor', usuarioId],
    queryFn: () => subtemasEspecialidadHttp.delAsesor(toValue(usuarioId)),
    enabled: () => !!toValue(usuarioId),
  });
}

export function useGuardarSubtemasAsesor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ usuarioId, subtemaIds }: { usuarioId: string; subtemaIds: string[] }) =>
      subtemasEspecialidadHttp.guardarDelAsesor(usuarioId, subtemaIds),
    onSuccess: (_data, { usuarioId }) =>
      queryClient.invalidateQueries({ queryKey: ['subtemas-asesor', usuarioId] }),
  });
}
