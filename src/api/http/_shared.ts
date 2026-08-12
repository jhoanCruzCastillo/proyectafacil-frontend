// Helper compartido por todos los `api/http/*.http.ts`: fetch contra /api/* con la cookie de sesión
// (mismo origen gracias al proxy de Vite, ver vite.config.ts) y manejo uniforme de errores JSON.

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch (e) {
    const aborted =
      (e instanceof DOMException && e.name === 'AbortError') ||
      (e instanceof Error && e.name === 'AbortError');
    if (aborted) throw e;
    throw new Error(e instanceof Error ? e.message : `No se pudo conectar con /api/${path}`);
  }

  // DEBUG TEMPORAL — quitar cuando se resuelva el issue de producción devolviendo datos mock.
  // Si este log NUNCA aparece para un recurso (ej. usuarios), es la prueba de que ese recurso está
  // en modo mock (VITE_MOCK_* sin definir) y ni siquiera está intentando llamar al backend real.
  console.log(`[DEBUG apiFetch] ${options.method ?? 'GET'} /api/${path} ->`, res.status);

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    console.log(`[DEBUG apiFetch] error body /api/${path}:`, body);
    throw new Error(body?.error ?? `Error ${res.status} en /api/${path}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
