import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { pagosHttp } from '@/api/http/pagos.http';

// Redirige de verdad al Checkout de Stripe — no hay nada que mostrar en la app mientras tanto, la
// página siguiente es la de Stripe.
export function useIniciarCheckout() {
  return useMutation({
    mutationFn: ({ usuarioId, beneficioId }: { usuarioId: string; beneficioId: string }) => pagosHttp.checkout(usuarioId, beneficioId),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });
}

export function useCheckoutPlan() {
  return useMutation({
    mutationFn: ({ usuarioId, planId }: { usuarioId: string; planId: string }) => pagosHttp.checkoutPlan(usuarioId, planId),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });
}

// Cambio instantáneo (Nivel 1↔2, ya suscrito) — sin redirección, invalida la facturación para que
// la UI muestre el plan nuevo de inmediato.
export function useCambiarPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ usuarioId, planId }: { usuarioId: string; planId: string }) => pagosHttp.cambiarPlan(usuarioId, planId),
    onSuccess: (_data, { usuarioId }) => queryClient.invalidateQueries({ queryKey: ['facturacion', usuarioId] }),
  });
}

// Puede resolver de dos formas: si el add-on se ajustó directo en una suscripción ya activa
// (`ok: true`, sin `url`) se queda en la página e invalida la facturación; si no, redirige a
// Checkout (`url`) igual que useIniciarCheckout/useCheckoutPlan.
export function useCheckoutAddon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ usuarioId, addonSlug, cantidad }: { usuarioId: string; addonSlug: string; cantidad: number }) =>
      pagosHttp.checkoutAddon(usuarioId, addonSlug, cantidad),
    onSuccess: (resultado, { usuarioId }) => {
      if (resultado.url) {
        window.location.href = resultado.url;
      } else {
        queryClient.invalidateQueries({ queryKey: ['facturacion', usuarioId] });
      }
    },
  });
}

export function useQuitarAddon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ usuarioId, addonSlug }: { usuarioId: string; addonSlug: string }) => pagosHttp.quitarAddon(usuarioId, addonSlug),
    onSuccess: (_data, { usuarioId }) => queryClient.invalidateQueries({ queryKey: ['facturacion', usuarioId] }),
  });
}

export function useAbrirPortal() {
  return useMutation({
    mutationFn: (usuarioId: string) => pagosHttp.portal(usuarioId),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });
}
