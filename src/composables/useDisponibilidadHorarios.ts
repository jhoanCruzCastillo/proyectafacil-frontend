import { useQuery } from '@tanstack/vue-query';
import { disponibilidadHorariosHttp } from '@/api/http/disponibilidadHorarios.http';

export function useDisponibilidadHorariosQuery(enabled: () => boolean) {
  return useQuery({
    queryKey: ['disponibilidad-horarios'],
    queryFn: () => disponibilidadHorariosHttp.agregada(),
    enabled,
  });
}
