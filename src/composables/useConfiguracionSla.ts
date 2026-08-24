import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { configuracionSlaHttp } from '@/api/http/configuracionSla.http';
import type { ConfiguracionSla } from '@/types';

export function useConfiguracionSlaQuery() {
  return useQuery({
    queryKey: ['asesoria', 'configuracion-sla'],
    queryFn: () => configuracionSlaHttp.get(),
  });
}

export function useActualizarConfiguracionSla() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ConfiguracionSla>) => configuracionSlaHttp.update(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asesoria', 'configuracion-sla'] }),
  });
}
