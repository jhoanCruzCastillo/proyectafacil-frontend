import { apiFetch } from './_shared';
import type { PagosApi } from '../contracts/pagos';

export const pagosHttp: PagosApi = {
  checkout(usuarioId, beneficioId) {
    return apiFetch<{ url: string }>('pagos/checkout', {
      method: 'POST',
      body: JSON.stringify({ usuarioId, beneficioId }),
    });
  },

  checkoutPlan(usuarioId, planId) {
    return apiFetch<{ url: string }>('pagos/checkout-plan', {
      method: 'POST',
      body: JSON.stringify({ usuarioId, planId }),
    });
  },

  cambiarPlan(usuarioId, planId) {
    return apiFetch<{ ok: true }>('pagos/cambiar-plan', {
      method: 'POST',
      body: JSON.stringify({ usuarioId, planId }),
    });
  },

  checkoutAddon(usuarioId, addonSlug, cantidad) {
    return apiFetch<{ url?: string; ok?: true }>('pagos/checkout-addon', {
      method: 'POST',
      body: JSON.stringify({ usuarioId, addonSlug, cantidad }),
    });
  },

  quitarAddon(usuarioId, addonSlug) {
    return apiFetch<{ ok: true }>('pagos/quitar-addon', {
      method: 'POST',
      body: JSON.stringify({ usuarioId, addonSlug }),
    });
  },

  portal(usuarioId) {
    return apiFetch<{ url: string }>(`pagos/portal?usuarioId=${usuarioId}`);
  },
};
