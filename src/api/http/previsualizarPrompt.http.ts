import { apiFetch } from './_shared';
import type { PrevisualizarPromptApi, PreviewPromptResponse } from '../contracts/previsualizarPrompt';

export const previsualizarPromptHttp: PrevisualizarPromptApi = {
  porSeccion(plantillaId, seccionId) {
    return apiFetch<PreviewPromptResponse>(`plantillas/${plantillaId}/preview-prompt?seccionId=${encodeURIComponent(seccionId)}`);
  },
};
