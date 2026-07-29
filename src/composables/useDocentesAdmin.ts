import { useQuery } from '@tanstack/vue-query';
import { docentesAdminHttp } from '@/api/http/docentesAdmin.http';

export function useDocentesAdminQuery() {
  return useQuery({
    queryKey: ['docentes-admin'],
    queryFn: () => docentesAdminHttp.list(),
  });
}
