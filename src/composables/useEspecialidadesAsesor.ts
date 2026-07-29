import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { especialidadesAsesorHttp } from '@/api/http/especialidadesAsesor.http';

export function useEspecialidadesAsesorQuery(usuarioId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['especialidades-asesor', usuarioId],
    queryFn: () => especialidadesAsesorHttp.list(toValue(usuarioId)),
    enabled: () => !!toValue(usuarioId),
  });
}

export function useGuardarEspecialidadesAsesor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ usuarioId, sectorIds }: { usuarioId: string; sectorIds: string[] }) =>
      especialidadesAsesorHttp.guardar(usuarioId, sectorIds),
    onSuccess: (_data, { usuarioId }) =>
      queryClient.invalidateQueries({ queryKey: ['especialidades-asesor', usuarioId] }),
  });
}
