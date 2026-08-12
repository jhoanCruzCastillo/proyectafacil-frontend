import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { fuenteVerdadHttp } from '@/api/http/fuenteVerdad.http';

const key = (ejemploId: MaybeRefOrGetter<string>) => ['fuente-verdad', toValue(ejemploId)];

export function useFuenteVerdadQuery(ejemploId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: key(ejemploId),
    queryFn: () => fuenteVerdadHttp.porEjemplo(toValue(ejemploId)),
    enabled: () => !!toValue(ejemploId),
  });
}

export function useGuardarArchivoFuente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ejemploId, nombre, dataUrl }: { ejemploId: string; nombre: string; dataUrl: string }) =>
      fuenteVerdadHttp.guardarArchivo(ejemploId, nombre, dataUrl),
    onSuccess: (_d, { ejemploId }) => queryClient.invalidateQueries({ queryKey: ['fuente-verdad', ejemploId] }),
  });
}

export function useEliminarArchivoFuente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ejemploId, archivoId }: { ejemploId: string; archivoId: string }) =>
      fuenteVerdadHttp.eliminarArchivo(ejemploId, archivoId),
    onSuccess: (_d, { ejemploId }) => queryClient.invalidateQueries({ queryKey: ['fuente-verdad', ejemploId] }),
  });
}

export function useGuardarTextoFuente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ejemploId, texto }: { ejemploId: string; texto: string }) => fuenteVerdadHttp.guardarTexto(ejemploId, texto),
    onSuccess: (_d, { ejemploId }) => queryClient.invalidateQueries({ queryKey: ['fuente-verdad', ejemploId] }),
  });
}

// Llenar toda la ficha cambia los `valores` del ejemplo del lado del servidor — invalida el mismo
// prefijo que usa useActualizarEjemplo (coincidencia parcial: cubre ['ejemplos', id] también).
export function useLlenarFichaIA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ejemploId: string) => fuenteVerdadHttp.llenarConIA(ejemploId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ejemplos'] }),
  });
}
