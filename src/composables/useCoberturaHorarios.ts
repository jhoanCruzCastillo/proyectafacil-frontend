import { type MaybeRefOrGetter, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { coberturaHorariosHttp } from '@/api/http/coberturaHorarios.http';

export function useCoberturaHorariosQuery(fecha: MaybeRefOrGetter<string>, sectorId: MaybeRefOrGetter<string | undefined>) {
  return useQuery({
    queryKey: ['asesoria', 'cobertura-horarios', fecha, sectorId],
    queryFn: () => coberturaHorariosHttp.get(toValue(fecha), toValue(sectorId)),
  });
}
