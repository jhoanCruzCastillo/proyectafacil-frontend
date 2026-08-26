// Helper compartido por todos los `api/http/*.http.ts`: fetch contra /api/* con Bearer token
// (mismo origen gracias al proxy de Vite, ver vite.config.ts) y manejo uniforme de errores JSON.
// Sin token no se llama al backend (salvo login/logout): medida de seguridad del lado cliente.

import { clearAuthToken, getAuthToken } from '@/lib/authToken';

/** Rutas que no exigen Bearer (entrada/salida de sesión, y registro público — nadie que llega ahí
 * tiene token todavía). Todo lo demás requiere token. */
function esRutaPublicaAuth(path: string): boolean {
  return (
    path === 'auth/login' || path.startsWith('auth/login?') ||
    path === 'auth/logout' || path.startsWith('auth/logout?') ||
    path === 'auth/registro' ||
    path.startsWith('auth/verificar/') ||
    path === 'sectores/publico'
  );
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const token = getAuthToken();
  if (!esRutaPublicaAuth(path) && !token) {
    throw new Error('No autenticado: falta token de sesión');
  }
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      credentials: 'same-origin',
      ...options,
      headers,
    });
  } catch (e) {
    const aborted =
      (e instanceof DOMException && e.name === 'AbortError') ||
      (e instanceof Error && e.name === 'AbortError');
    if (aborted) throw e;
    throw new Error(e instanceof Error ? e.message : `No se pudo conectar con /api/${path}`);
  }

  if (!res.ok) {
    // Token inválido/expirado: limpiar para que el próximo restaurar/me no recree una sesión fantasma.
    if (res.status === 401 && !path.startsWith('auth/login')) {
      clearAuthToken();
    }
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Error ${res.status} en /api/${path}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * POST JSON con progreso real de bytes enviados (XHR). `fetch` no expone upload progress.
 * `onUploadProgress(fraction)`: 0→1 mientras se envía el body; al terminar el envío (antes de la
 * respuesta del servidor) se llama con 1 — útil para mostrar "guardando en Cloudinary…" después.
 */
export function apiUploadJson<T>(
  path: string,
  body: unknown,
  onUploadProgress?: (fraction: number) => void,
): Promise<T> {
  const token = getAuthToken();
  if (!token) {
    return Promise.reject(new Error('No autenticado: falta token de sesión'));
  }

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/${path}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (ev) => {
      if (!onUploadProgress || !ev.lengthComputable || ev.total <= 0) return;
      onUploadProgress(Math.min(1, ev.loaded / ev.total));
    };

    xhr.upload.onload = () => {
      // Body ya enviado; el servidor aún puede estar subiendo a Cloudinary.
      onUploadProgress?.(1);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (xhr.status === 204) {
          resolve(undefined as T);
          return;
        }
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new Error(`Respuesta inválida de /api/${path}`));
        }
        return;
      }
      if (xhr.status === 401) clearAuthToken();
      let msg = `Error ${xhr.status} en /api/${path}`;
      try {
        const parsed = JSON.parse(xhr.responseText) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        /* ignore */
      }
      reject(new Error(msg));
    };

    xhr.onerror = () => reject(new Error(`No se pudo conectar con /api/${path}`));
    xhr.send(JSON.stringify(body));
  });
}

/**
 * POST multipart/form-data con progreso real de bytes (XHR). No fijar Content-Type manualmente —
 * el navegador pone el boundary. Requiere Bearer (igual que el resto de la API).
 */
export function apiUploadFormData<T>(
  path: string,
  formData: FormData,
  onUploadProgress?: (fraction: number) => void,
): Promise<T> {
  const token = getAuthToken();
  if (!token) {
    return Promise.reject(new Error('No autenticado: falta token de sesión'));
  }

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (ev) => {
      if (!onUploadProgress || !ev.lengthComputable || ev.total <= 0) return;
      onUploadProgress(Math.min(1, ev.loaded / ev.total));
    };

    xhr.upload.onload = () => {
      onUploadProgress?.(1);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (xhr.status === 204) {
          resolve(undefined as T);
          return;
        }
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new Error(`Respuesta inválida de /api/${path}`));
        }
        return;
      }
      if (xhr.status === 401) clearAuthToken();
      let msg = `Error ${xhr.status} en /api/${path}`;
      try {
        const parsed = JSON.parse(xhr.responseText) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        /* ignore */
      }
      reject(new Error(msg));
    };

    xhr.onerror = () => reject(new Error(`No se pudo conectar con /api/${path}`));
    xhr.send(formData);
  });
}
