import { type MaybeRefOrGetter, toValue } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { liquidacionesHttp } from '@/api/http/liquidaciones.http';

export function useLiquidacionesQuery(periodo: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['asesoria', 'liquidaciones', periodo],
    queryFn: () => liquidacionesHttp.get(toValue(periodo)),
  });
}

export function useAutorizarPago() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ asesorIds, periodo }: { asesorIds: string[]; periodo: string }) => liquidacionesHttp.autorizarPago(asesorIds, periodo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asesoria', 'liquidaciones'] }),
  });
}
