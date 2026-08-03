import { apiFetch } from './http/_shared';

// Subida de imágenes de campos tipo `imagen`. Siempre pasa por el backend: las credenciales de
// Cloudinary (apiSecret incluido) viven en backend/.env y no deben llegar nunca al navegador.
// A diferencia del resto de recursos, no tiene variante mock — sin backend no hay dónde subir.

export interface ImagenSubida {
  url: string;
}

/** Sube una imagen y devuelve su URL de Cloudinary. Si el formato no es web (EMF/WMF de las
 * plantillas oficiales) el backend intenta convertirlo a PNG antes de subirlo. */
export async function subirImagen(dataUrl: string, nombre: string, formato: string): Promise<ImagenSubida> {
  return apiFetch<ImagenSubida>('imagenes', {
    method: 'POST',
    body: JSON.stringify({ dataUrl, nombre, formato }),
  });
}

/** ¿El servidor puede convertir formatos no web? Sirve para avisar antes de intentar el volcado,
 * en vez de descubrirlo imagen por imagen. */
export async function capacidadesImagen(): Promise<{ conversorDisponible: boolean }> {
  return apiFetch<{ conversorDisponible: boolean }>('imagenes/capacidades');
}
