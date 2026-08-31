import { getAuthToken } from '@/lib/authToken';

/** URLs del proxy `/api/archivos/{id}/contenido` (u otra ruta /api/) necesitan Bearer. */
export function esUrlApiBinaria(url: string): boolean {
  if (url.startsWith('/api/')) return true;
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return u.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

/** fetch de binarios: añade Authorization cuando la URL es del API (proxy S3). */
export async function fetchBinario(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (esUrlApiBinaria(url)) {
    const token = getAuthToken();
    if (!token) throw new Error('No autenticado: falta token de sesión');
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...init, headers, credentials: init.credentials ?? 'same-origin' });
}

export interface DescargaProgreso {
  /** 0–100; null si no hay Content-Length */
  percent: number | null;
  loaded: number;
  total: number | null;
  /** bytes/segundo (media móvil reciente) */
  speedBps: number;
  /** segundos restantes estimados; null si no se puede estimar */
  etaSeconds: number | null;
}

export type DescargaProgresoCb = (p: DescargaProgreso) => void;

function formatearBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatearVelocidad(bps: number): string {
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function formatearEta(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m} min ${r} s`;
}

export { formatearBytes };

async function leerConProgreso(res: Response, onProgress?: DescargaProgresoCb): Promise<Blob> {
  const totalHeader = Number(res.headers.get('content-length') ?? 0);
  const total = totalHeader > 0 ? totalHeader : null;

  if (!res.body) {
    const buf = await res.arrayBuffer();
    onProgress?.({
      percent: 100,
      loaded: buf.byteLength,
      total: buf.byteLength,
      speedBps: 0,
      etaSeconds: 0,
    });
    return new Blob([buf]);
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  const t0 = performance.now();
  let lastT = t0;
  let lastLoaded = 0;
  let speedBps = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;

    const now = performance.now();
    const dt = (now - lastT) / 1000;
    if (dt >= 0.25) {
      const instant = (loaded - lastLoaded) / dt;
      speedBps = speedBps > 0 ? speedBps * 0.6 + instant * 0.4 : instant;
      lastT = now;
      lastLoaded = loaded;
    }

    const elapsed = (now - t0) / 1000;
    const avgSpeed = elapsed > 0 ? loaded / elapsed : speedBps;
    const effectiveSpeed = speedBps > 0 ? speedBps : avgSpeed;
    const remaining = total != null ? Math.max(0, total - loaded) : null;
    const etaSeconds = remaining != null && effectiveSpeed > 0 ? remaining / effectiveSpeed : null;

    onProgress?.({
      percent: total != null ? Math.min(100, Math.round((loaded / total) * 100)) : null,
      loaded,
      total,
      speedBps: effectiveSpeed,
      etaSeconds,
    });
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  onProgress?.({
    percent: 100,
    loaded,
    total: total ?? loaded,
    speedBps,
    etaSeconds: 0,
  });
  return new Blob([merged]);
}

/**
 * Abrir en una pestaña nueva (adjuntos de chat: PDF, Word, etc. — no forzar descarga).
 * - URL API/proxy: fetch con Bearer, blob URL, window.open (el visor nativo del navegador lo abre).
 * - URL externa (Cloudinary): window.open directo — no necesita Bearer y evita el viaje redundante.
 */
export async function abrirArchivoUrl(url: string, nombre: string): Promise<void> {
  if (!esUrlApiBinaria(url)) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  // Se abre YA, sincrónico con el click — si se abre recién después del await, la "activación de
  // usuario" del click ya expiró y la mayoría de navegadores lo bloquea como popup en silencio (sin
  // avisar, así que ni un catch lo detecta). Se navega a about:blank y se le cambia el location
  // cuando el blob esté listo.
  const ventana = window.open('', '_blank');

  try {
    const res = await fetchBinario(url);
    if (!res.ok) throw new Error(`No se pudo abrir el archivo (${res.status})`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    if (ventana && ! ventana.closed) {
      ventana.location.href = objectUrl;
    } else {
      // El usuario (o un bloqueador extra) cerró/bloqueó la pestaña igual — última opción: descargar.
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    // El blob URL debe sobrevivir mientras la pestaña nueva lo está cargando — se libera después.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (e) {
    ventana?.close();
    throw e instanceof Error ? e : new Error('No se pudo abrir el archivo');
  }
}

/**
 * Descarga forzada (botón Descargar).
 * - URL API/proxy: stream con progreso + Bearer.
 * - URL externa (Cloudinary): intenta stream con progreso; si CORS falla, cae a `<a download>`.
 */
export async function descargarArchivoUrl(
  url: string,
  nombre: string,
  onProgress?: DescargaProgresoCb,
): Promise<void> {
  const triggerBlob = (blob: Blob) => {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  };

  try {
    const res = await fetchBinario(url);
    if (!res.ok) throw new Error(`No se pudo descargar (${res.status})`);
    const blob = await leerConProgreso(res, onProgress);
    triggerBlob(blob);
  } catch (e) {
    if (esUrlApiBinaria(url)) throw e;
    // Cloudinary u origen CORS: sin progreso fiable
    onProgress?.({ percent: null, loaded: 0, total: null, speedBps: 0, etaSeconds: null });
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
