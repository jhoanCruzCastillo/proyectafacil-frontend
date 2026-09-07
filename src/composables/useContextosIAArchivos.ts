import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { contextosIAArchivosHttp } from '@/api/http/contextosIAArchivos.http';
import type { UploadProgressCb } from '@/api/contracts/archivosExcel';

// Cola propia ('contextos-ia-archivos'), separada de 'contextos-ia' (insumos del prompt) a
// propósito — ver ContextoIAArchivoGeneral en types/index.ts.
export function useContextosIAArchivosQuery(plantillaId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['contextos-ia-archivos', plantillaId],
    queryFn: () => contextosIAArchivosHttp.porPlantilla(toValue(plantillaId)),
    enabled: () => !!toValue(plantillaId),
  });
}

export function useSubirContextoIAArchivo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plantillaId, file, onProgress }: { plantillaId: string; file: File; onProgress?: UploadProgressCb }) =>
      contextosIAArchivosHttp.subir(plantillaId, file, onProgress),
    onSuccess: (_d, { plantillaId }) => queryClient.invalidateQueries({ queryKey: ['contextos-ia-archivos', plantillaId] }),
  });
}

export function useEliminarContextoIAArchivo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plantillaId, archivoId }: { plantillaId: string; archivoId: string }) =>
      contextosIAArchivosHttp.eliminar(plantillaId, archivoId),
    onSuccess: (_d, { plantillaId }) => queryClient.invalidateQueries({ queryKey: ['contextos-ia-archivos', plantillaId] }),
  });
}
