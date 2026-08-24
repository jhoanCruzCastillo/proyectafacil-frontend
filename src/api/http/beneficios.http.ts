import { apiFetch } from './_shared';
import type { BeneficiosApi } from '../contracts/beneficios';
import type { Beneficio } from '@/types';

export const beneficiosHttp: BeneficiosApi = {
  catalogo() {
    return apiFetch<Beneficio[]>('beneficios');
  },

  mios(usuarioId) {
    return apiFetch<Beneficio[]>(`beneficios/mios?usuarioId=${usuarioId}`);
  },
};
