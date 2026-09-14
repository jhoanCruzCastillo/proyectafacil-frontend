import { apiFetch } from './http/_shared';

// Subida de archivos de campos tipo `archivo` (PDF/Excel/Word/TXT). A diferencia de `imagenes.ts`
// (Cloudinary), esto sube al bucket S3 de Railway — pedido explícito del usuario. Sin variante
// mock, igual que imágenes: sin backend no hay dónde subir.

export interface ArchivoCampoSubido {
  id: string;
  nombre: string;
  /** URL relativa de descarga pública (token firmado incluido) — ver CampoArchivosController. */
  url: string;
}

export async function subirArchivoCampo(dataUrl: string, nombre: string): Promise<ArchivoCampoSubido> {
  return apiFetch<ArchivoCampoSubido>('archivos-campo', {
    method: 'POST',
    body: JSON.stringify({ dataUrl, nombre }),
  });
}
