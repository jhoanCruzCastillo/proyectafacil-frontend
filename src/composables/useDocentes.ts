import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { docentesHttp } from '@/api/http/docentes.http';
import type { BloqueHorario, BloqueExcepcion } from '@/api/contracts/docentes';

const queryKey = ['docentes'] as const;

export function useDocentesQuery() {
  return useQuery({ queryKey, queryFn: docentesHttp.list });
}

export function useActualizarHorarioDocente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ docenteId, horario }: { docenteId: string; horario: BloqueHorario[] }) =>
      docentesHttp.actualizarHorario(docenteId, horario),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export function useExcepcionesHorarioQuery(docenteId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['docentes', docenteId, 'excepciones'],
    queryFn: () => docentesHttp.excepciones(toValue(docenteId)),
    enabled: () => !!toValue(docenteId),
  });
}

export function useActualizarExcepcionesHorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ docenteId, excepciones }: { docenteId: string; excepciones: BloqueExcepcion[] }) =>
      docentesHttp.actualizarExcepciones(docenteId, excepciones),
    onSuccess: (_data, { docenteId }) => queryClient.invalidateQueries({ queryKey: ['docentes', docenteId, 'excepciones'] }),
  });
}
