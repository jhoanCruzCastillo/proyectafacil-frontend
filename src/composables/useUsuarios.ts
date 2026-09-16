import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { usuariosApi } from '@/api/usuarios';
import type { AsignarBeneficiosPayload, Usuario } from '@/types';

export function useUsuariosQuery() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: () => usuariosApi.list(),
  });
}

export function useCrearUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (usuario: Usuario) => usuariosApi.create(usuario),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useActualizarUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Usuario> }) => usuariosApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useEliminarUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usuariosApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useEnviarAccesos() {
  return useMutation({
    mutationFn: (id: string) => usuariosApi.enviarAccesos(id),
  });
}

export function useEnviarAccesosDirecto() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      usuariosApi.enviarAccesosDirecto(id, password),
  });
}

export function useBeneficiosAsignadosQuery(usuarioId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['usuarios', 'beneficios-asignados', usuarioId],
    queryFn: () => usuariosApi.beneficiosAsignados(toValue(usuarioId)),
    enabled: () => !!toValue(usuarioId),
    refetchOnWindowFocus: false,
  });
}

export function useAsignarBeneficios() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AsignarBeneficiosPayload }) =>
      usuariosApi.asignarBeneficios(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios', 'beneficios-asignados'] });
      queryClient.invalidateQueries({ queryKey: ['facturacion'] });
      queryClient.invalidateQueries({ queryKey: ['tickets-consulta'] });
    },
  });
}
