import { apiFetch } from './_shared';
import type { ConfiguracionSlaApi } from '../contracts/configuracionSla';
import type { ConfiguracionSla } from '@/types';

export const configuracionSlaHttp: ConfiguracionSlaApi = {
  get() {
    return apiFetch<ConfiguracionSla>('asesoria/configuracion-sla');
  },

  update(data) {
    return apiFetch<ConfiguracionSla>('asesoria/configuracion-sla', { method: 'PUT', body: JSON.stringify(data) });
  },
};
