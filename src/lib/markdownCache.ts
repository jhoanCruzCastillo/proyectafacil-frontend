// Los contextos IA guardan su markdown como archivo .md en Cloudinary (la fila en BD solo trae la
// URL) — este módulo es el que efectivamente descarga ese contenido y lo cachea en sessionStorage,
// para no volver a pedirlo cada vez que se reabre el tab "Contextos IA" en la misma pestaña del
// navegador. Se limpia solo al cerrar la pestaña (sessionStorage), que es lo que corresponde: si el
// admin edita el mismo contexto desde otra pestaña, no hace falta que ambas se enteren en vivo.

const PREFIJO_CACHE = 'pf_contexto_md::';

/** Descarga (o lee de cache) el contenido markdown de la URL de un contexto IA. '' si no hay URL. */
export async function obtenerMarkdown(url: string | null | undefined): Promise<string> {
  if (!url) return '';

  const clave = PREFIJO_CACHE + url;
  const cacheado = sessionStorage.getItem(clave);
  if (cacheado !== null) return cacheado;

  const resp = await fetch(url);
  if (!resp.ok) return '';
  const texto = await resp.text();
  sessionStorage.setItem(clave, texto);
  return texto;
}

/** Dispara la descarga de todas las URLs dadas en paralelo, para dejarlas cacheadas de antemano. */
export function precargarMarkdown(urls: Array<string | null | undefined>): void {
  for (const url of urls) {
    void obtenerMarkdown(url);
  }
}
