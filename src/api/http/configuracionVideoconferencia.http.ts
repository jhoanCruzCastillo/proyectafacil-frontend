import { apiFetch } from './_shared';
import type { ConfiguracionVideoconferenciaApi } from '../contracts/configuracionVideoconferencia';
import type { ConfiguracionVideoconferencia } from '@/types';

export const configuracionVideoconferenciaHttp: ConfiguracionVideoconferenciaApi = {
  get() {
    return apiFetch<ConfiguracionVideoconferencia>('asesoria/configuracion-videollamadas');
  },

  update(data) {
    return apiFetch<ConfiguracionVideoconferencia>('asesoria/configuracion-videollamadas', { method: 'PUT', body: JSON.stringify(data) });
  },
};
