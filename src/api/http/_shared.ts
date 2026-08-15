// Helper compartido por todos los `api/http/*.http.ts`: fetch contra /api/* con Bearer token
// (mismo origen gracias al proxy de Vite, ver vite.config.ts) y manejo uniforme de errores JSON.
// Sin token no se llama al backend (salvo login/logout): medida de seguridad del lado cliente.

import { clearAuthToken, getAuthToken } from '@/lib/authToken';

/** Rutas que no exigen Bearer (entrada/salida de sesión). Todo lo demás requiere token. */
function esRutaPublicaAuth(path: string): boolean {
  return path === 'auth/login' || path.startsWith('auth/login?') || path === 'auth/logout' || path.startsWith('auth/logout?');
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
