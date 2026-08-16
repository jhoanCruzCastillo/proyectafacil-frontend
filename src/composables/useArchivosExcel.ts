import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { archivosExcelApi } from '@/api/archivosExcel';
import type { UploadProgressCb } from '@/api/contracts/archivosExcel';

export function useCatalogoExcelQuery(plantillaId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['archivosExcel', plantillaId],
    queryFn: () => archivosExcelApi.getCatalogo(toValue(plantillaId)),
    // Sin id la URL cae en `plantillas/archivos` (404). Esperar a tener plantilla real.
    enabled: () => !!toValue(plantillaId),
  });
}

export function useAgregarArchivoExcel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      plantillaId,
      file,
      onProgress,
    }: {
      plantillaId: string;
      file: File;
      onProgress?: UploadProgressCb;
    }) => archivosExcelApi.addArchivo(plantillaId, file, onProgress),
    onSuccess: (_data, { plantillaId }) => queryClient.invalidateQueries({ queryKey: ['archivosExcel', plantillaId] }),
  });
}

export function useEliminarArchivoExcel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plantillaId, archivoId }: { plantillaId: string; archivoId: string }) => archivosExcelApi.deleteArchivo(plantillaId, archivoId),
    onSuccess: (_data, { plantillaId }) => queryClient.invalidateQueries({ queryKey: ['archivosExcel', plantillaId] }),
  });
}

export function useAsignarArchivoExcel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ plantillaId, archivoId }: { plantillaId: string; archivoId: string }) => archivosExcelApi.asignarArchivo(plantillaId, archivoId),
    onSuccess: (_data, { plantillaId }) => queryClient.invalidateQueries({ queryKey: ['archivosExcel', plantillaId] }),
  });
}
