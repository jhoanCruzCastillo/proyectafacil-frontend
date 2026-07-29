import { apiFetch } from './_shared';
import type { DocentesAdminApi } from '../contracts/docentesAdmin';
import type { DocenteAdmin } from '@/types';

export const docentesAdminHttp: DocentesAdminApi = {
  list() {
    return apiFetch<DocenteAdmin[]>('docentes/admin');
  },
};
