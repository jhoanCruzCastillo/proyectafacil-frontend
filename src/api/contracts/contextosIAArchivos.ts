import type { ContextoIAArchivoGeneral } from '@/types';
import type { UploadProgressCb } from './archivosExcel';

export interface ContextosIAArchivosApi {
  porPlantilla(plantillaId: string): Promise<ContextoIAArchivoGeneral[]>;
  /** Sube el PDF en binario (multipart). Evita inflar el tamaño con base64. */
  subir(plantillaId: string, file: File, onProgress?: UploadProgressCb): Promise<ContextoIAArchivoGeneral[]>;
  eliminar(plantillaId: string, archivoId: string): Promise<ContextoIAArchivoGeneral[]>;
}
