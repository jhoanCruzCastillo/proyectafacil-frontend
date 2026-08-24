import { type MaybeRefOrGetter, toValue } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { beneficiosHttp } from '@/api/http/beneficios.http';

export function useBeneficiosCatalogoQuery() {
  return useQuery({
    queryKey: ['beneficios', 'catalogo'],
    queryFn: () => beneficiosHttp.catalogo(),
  });
}

export function useMisBeneficiosQuery(usuarioId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['beneficios', 'mios', usuarioId],
    queryFn: () => beneficiosHttp.mios(toValue(usuarioId)),
    enabled: () => !!toValue(usuarioId),
  });
}

/** Para invalidar "mis beneficios" tras volver de un pago exitoso (ver FacturacionTab.vue). */
export function useInvalidarMisBeneficios() {
  const queryClient = useQueryClient();
  return (usuarioId: string) => queryClient.invalidateQueries({ queryKey: ['beneficios', 'mios', usuarioId] });
}
