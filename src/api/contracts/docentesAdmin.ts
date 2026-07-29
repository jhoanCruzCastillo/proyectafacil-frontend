import type { DocenteAdmin } from '@/types';

export interface DocentesAdminApi {
  list(): Promise<DocenteAdmin[]>;
}
