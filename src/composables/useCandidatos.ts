import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { candidatosHttp } from '@/api/http/candidatos.http';
import type { EstadoCandidato } from '@/types';

export function useCandidatosQuery() {
  return useQuery({
    queryKey: ['candidatos'],
    queryFn: () => candidatosHttp.list(),
  });
}

export function useCandidatosResumenQuery() {
  return useQuery({
    queryKey: ['candidatos-resumen'],
    queryFn: () => candidatosHttp.resumen(),
  });
}

export function useCandidatoDetalleQuery(id: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: ['candidatos', 'detalle', id],
    queryFn: () => candidatosHttp.detalle(toValue(id) as string),
    enabled: () => !!toValue(id),
  });
}

export function useNotasCandidatoQuery(id: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: ['candidatos', 'notas', id],
    queryFn: () => candidatosHttp.notas(toValue(id) as string),
    enabled: () => !!toValue(id),
  });
}

export function useAgregarNotaCandidato() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, texto }: { id: string; texto: string }) => candidatosHttp.agregarNota(id, texto),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['candidatos', 'notas', id] });
    },
  });
}

export function useCambiarEstadoCandidato() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoCandidato }) => candidatosHttp.cambiarEstado(id, estado),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['candidatos', 'detalle', id] });
      queryClient.invalidateQueries({ queryKey: ['candidatos'] });
      queryClient.invalidateQueries({ queryKey: ['candidatos-resumen'] });
    },
  });
}

export function useEliminarCandidato() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => candidatosHttp.eliminar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidatos'] });
      queryClient.invalidateQueries({ queryKey: ['candidatos-resumen'] });
    },
  });
}

/** Promueve a un aprobado puntual que se quedó sin cuenta de asesor (ver Candidato.usuarioId) —
 * el caso de los aprobados antes de que la promoción automática existiera. */
export function usePromoverCandidato() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => candidatosHttp.promover(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['candidatos'] });
      queryClient.invalidateQueries({ queryKey: ['candidatos', 'detalle', id] });
      queryClient.invalidateQueries({ queryKey: ['candidatos-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['docentes-admin'] });
      queryClient.invalidateQueries({ queryKey: ['docentes'] });
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}
