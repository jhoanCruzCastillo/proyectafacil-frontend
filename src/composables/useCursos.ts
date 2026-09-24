import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { cursosHttp } from '@/api/http/cursos.http';

const queryKey = ['cursos'] as const;

export function useCursosQuery() {
  return useQuery({ queryKey, queryFn: cursosHttp.list });
}

export function useCrearCurso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: { nombre: string; colorAccent: string }) => cursosHttp.create(datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
}
