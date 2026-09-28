import { type MaybeRefOrGetter, toValue, watch } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { llenadoIAAsyncHttp } from '@/api/http/llenadoIAAsync.http';
import { useUiStore } from '@/stores/ui';
import type { TrabajoLlenadoIA } from '@/api/contracts/llenadoIAAsync';

/** Mismo intervalo que la campanita de notificaciones (ver useNotificaciones.ts) — no hay urgencia
 * de ver el progreso al segundo, el correo + la notificación in-app ya avisan cuando termina. */
const INTERVALO_MS = 20_000;

function enCurso(estado: TrabajoLlenadoIA['estado'] | null | undefined): boolean {
  return estado === 'pendiente' || estado === 'procesando';
}

/**
 * Estado del llenado con IA en segundo plano (ver docs/llenado-automatico-ia.md y
 * backend/app/Commands/IaEjecutarLlenado.php) — hace polling SOLO mientras hay un trabajo
 * pendiente/procesando para esta ficha, y avisa una vez (toast) si la transición a
 * completado/error ocurre mientras el usuario sigue viendo la página. Si el usuario ya se fue,
 * se entera igual por correo y por la campanita de notificaciones.
 */
export function useLlenadoIAAsyncQuery(ejemploId: MaybeRefOrGetter<string>) {
  const ui = useUiStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['llenado-ia-async', ejemploId],
    queryFn: () => llenadoIAAsyncHttp.estado(toValue(ejemploId)),
    enabled: () => !!toValue(ejemploId),
    refetchInterval: (q) => (enCurso(q.state.data?.estado) ? INTERVALO_MS : false),
  });

  watch(
    () => query.data.value?.estado,
    (actual, anterior) => {
      if (!anterior || actual === anterior || !enCurso(anterior)) return;
      if (actual === 'completado') {
        ui.toast(`Llenado con IA completado — ${query.data.value?.camposCompletados ?? 0} campos completados`);
        void queryClient.invalidateQueries({ queryKey: ['ejemplos'] });
      } else if (actual === 'error') {
        ui.toast(query.data.value?.error ?? 'El llenado con IA terminó con un error', 'error');
      }
    },
  );

  return query;
}

export function useIniciarLlenadoIAAsync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ejemploId, seccionIds }: { ejemploId: string; seccionIds?: string[] }) =>
      llenadoIAAsyncHttp.iniciar(ejemploId, seccionIds),
    onSuccess: (_datos, { ejemploId }) => {
      void queryClient.invalidateQueries({ queryKey: ['llenado-ia-async', ejemploId] });
    },
  });
}

export function useCancelarLlenadoIAAsync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ejemploId: string) => llenadoIAAsyncHttp.cancelar(ejemploId),
    onSuccess: (_datos, ejemploId) => {
      void queryClient.invalidateQueries({ queryKey: ['llenado-ia-async', ejemploId] });
    },
  });
}
