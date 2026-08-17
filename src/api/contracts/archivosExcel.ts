import type { CatalogoExcelPlantilla } from '@/types';

/** fraction 0–1 de la fase de subida HTTP; label opcional para la UI. */
export type UploadProgressCb = (fraction: number, label?: string) => void;

export interface ArchivosExcelApi {
  getCatalogo(plantillaId: string): Promise<CatalogoExcelPlantilla>;
  /** Sube el Excel en binario (multipart). Evita inflar el tamaño con base64. */
  addArchivo(plantillaId: string, file: File, onProgress?: UploadProgressCb): Promise<CatalogoExcelPlantilla>;
  deleteArchivo(plantillaId: string, archivoId: string): Promise<CatalogoExcelPlantilla>;
  asignarArchivo(plantillaId: string, archivoId: string): Promise<CatalogoExcelPlantilla>;
}
