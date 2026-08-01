import { useQuery } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { miLiquidacionHttp } from '@/api/http/miLiquidacion.http';
import type { GranularidadLiquidacion } from '@/types';

// Cada tab pide solo lo suyo, y `enabled` evita traer datos de tabs que el asesor no abrió.
export function useLiquidacionHistoricoQuery(
  usuarioId: MaybeRefOrGetter<string>,
  granularidad: MaybeRefOrGetter<GranularidadLiquidacion>,
  periodo: MaybeRefOrGetter<string | undefined>,
  activo: MaybeRefOrGetter<boolean>,
) {
  return useQuery({
    queryKey: ['mi-liquidacion', 'historico', usuarioId, granularidad, periodo],
    queryFn: () => miLiquidacionHttp.historico(toValue(usuarioId), toValue(granularidad), toValue(periodo)),
    enabled: () => !!toValue(usuarioId) && toValue(activo),
  });
}

export function useLiquidacionPendienteQuery(usuarioId: MaybeRefOrGetter<string>, activo: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: ['mi-liquidacion', 'pendiente', usuarioId],
    queryFn: () => miLiquidacionHttp.pendiente(toValue(usuarioId)),
    enabled: () => !!toValue(usuarioId) && toValue(activo),
  });
}

export function useLiquidacionMesQuery(
  usuarioId: MaybeRefOrGetter<string>,
  periodo: MaybeRefOrGetter<string | undefined>,
  activo: MaybeRefOrGetter<boolean>,
) {
  return useQuery({
    queryKey: ['mi-liquidacion', 'mes', usuarioId, periodo],
    queryFn: () => miLiquidacionHttp.mes(toValue(usuarioId), toValue(periodo)),
    enabled: () => !!toValue(usuarioId) && toValue(activo),
  });
}
