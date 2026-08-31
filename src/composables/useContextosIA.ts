import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { contextosIAHttp } from '@/api/http/contextosIA.http';

export function useContextosIAQuery(plantillaId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['contextos-ia', plantillaId],
    queryFn: () => contextosIAHttp.porPlantilla(toValue(plantillaId)),
    enabled: () => !!toValue(plantillaId),
  });
}

export function useGuardarContextoSeccion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plantillaId, seccionId, markdown, globales }: { plantillaId: string; seccionId: string; markdown: string; globales: string[] }) =>
      contextosIAHttp.guardarSeccion(plantillaId, seccionId, markdown, globales),
    onSuccess: (_d, { plantillaId }) => queryClient.invalidateQueries({ queryKey: ['contextos-ia', plantillaId] }),
  });
}

export function useEliminarContextoSeccion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plantillaId, seccionId }: { plantillaId: string; seccionId: string }) =>
      contextosIAHttp.eliminarSeccion(plantillaId, seccionId),
    onSuccess: (_d, { plantillaId }) => queryClient.invalidateQueries({ queryKey: ['contextos-ia', plantillaId] }),
  });
}

// Los generales son propios de una ficha — misma query que secciones/globales (porPlantilla trae los tres).
export function useGuardarContextoGeneral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plantillaId, id, nombre, markdown }: { plantillaId: string; id: string | null; nombre: string; markdown: string }) =>
      contextosIAHttp.guardarGeneral(plantillaId, id, nombre, markdown),
    onSuccess: (_d, { plantillaId }) => queryClient.invalidateQueries({ queryKey: ['contextos-ia', plantillaId] }),
  });
}

export function useEliminarContextoGeneral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plantillaId, id }: { plantillaId: string; id: string }) => contextosIAHttp.eliminarGeneral(plantillaId, id),
    onSuccess: (_d, { plantillaId }) => queryClient.invalidateQueries({ queryKey: ['contextos-ia', plantillaId] }),
  });
}

// Los globales son compartidos por cualquier plantilla — se invalidan todas las queries
// 'contextos-ia' (coincidencia parcial de TanStack Query), no solo la de la plantilla activa.
export function useGuardarContextoGlobal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nombre, markdown, icono }: { id: string | null; nombre: string; markdown: string; icono: string | null }) =>
      contextosIAHttp.guardarGlobal(id, nombre, markdown, icono),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contextos-ia'] }),
  });
}

export function useEliminarContextoGlobal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contextosIAHttp.eliminarGlobal(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contextos-ia'] }),
  });
}

// Tab "Estructura": qué insumo va en cada paso (1/2/4/5) del armado del prompt de sistema.
export function useGuardarContextoPaso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plantillaId, paso, tipo, insumoId }: { plantillaId: string; paso: number; tipo: 'general' | 'global'; insumoId: string }) =>
      contextosIAHttp.guardarPaso(plantillaId, paso, tipo, insumoId),
    onSuccess: (_d, { plantillaId }) => queryClient.invalidateQueries({ queryKey: ['contextos-ia', plantillaId] }),
  });
}

export function useEliminarContextoPaso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plantillaId, asignacionId }: { plantillaId: string; asignacionId: string }) =>
      contextosIAHttp.eliminarPaso(plantillaId, asignacionId),
    onSuccess: (_d, { plantillaId }) => queryClient.invalidateQueries({ queryKey: ['contextos-ia', plantillaId] }),
  });
}
