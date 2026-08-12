import type { ArchivoFuenteVerdad, FuenteVerdad, ResultadoLlenadoIA } from '@/types';

export interface FuenteVerdadApi {
  porEjemplo(ejemploId: string): Promise<FuenteVerdad>;
  guardarArchivo(ejemploId: string, nombre: string, dataUrl: string): Promise<FuenteVerdad>;
  eliminarArchivo(ejemploId: string, archivoId: string): Promise<FuenteVerdad>;
  guardarTexto(ejemploId: string, texto: string): Promise<FuenteVerdad>;
  llenarConIA(ejemploId: string): Promise<ResultadoLlenadoIA>;
}

export type { ArchivoFuenteVerdad, FuenteVerdad, ResultadoLlenadoIA };
