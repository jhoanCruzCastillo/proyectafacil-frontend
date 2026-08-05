import { apiFetch } from './_shared';

export interface TurnoAsistente {
  autor: 'usuario' | 'ia';
  texto: string;
}

/**
 * Pregunta al asesor de IA. La llamada a Anthropic la hace el BACKEND: la API key nunca llega al
 * navegador (Vite hornearía cualquier VITE_* dentro del bundle público).
 */
export function consultarAsistenteIA(datos: {
  plantillaId: string;
  seccionId: string;
  pregunta: string;
  historial: TurnoAsistente[];
}): Promise<{ texto: string }> {
  return apiFetch<{ texto: string }>('asistente-ia/consultar', { method: 'POST', body: JSON.stringify(datos) });
}
