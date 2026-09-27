import { apiFetch } from './_shared';
import type { PruebaIAApi } from '../contracts/pruebaIA';

export const pruebaIAHttp: PruebaIAApi = {
  chat(payload) {
    return apiFetch('pruebas/ia/chat', { method: 'POST', body: JSON.stringify(payload) });
  },

  modelos() {
    return apiFetch('pruebas/ia/modelos');
  },
};
