import { useQuery } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { ticketsConsultaHttp } from '@/api/http/ticketsConsulta.http';

export function useTicketsConsultaQuery(usuarioId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['tickets-consulta', usuarioId],
    queryFn: () => ticketsConsultaHttp.list(toValue(usuarioId)),
    enabled: () => !!toValue(usuarioId),
  });
}
