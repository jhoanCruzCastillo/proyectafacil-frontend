import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { configuracionVideoconferenciaHttp } from '@/api/http/configuracionVideoconferencia.http';
import type { ConfiguracionVideoconferencia } from '@/types';

export function useConfiguracionVideoconferenciaQuery() {
  return useQuery({
    queryKey: ['asesoria', 'configuracion-videollamadas'],
    queryFn: () => configuracionVideoconferenciaHttp.get(),
  });
}

export function useActualizarConfiguracionVideoconferencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ConfiguracionVideoconferencia) => configuracionVideoconferenciaHttp.update(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asesoria', 'configuracion-videollamadas'] }),
  });
}
