/** Prompt exacto (sistema + usuario) que llenarFicha()/llenarTabla() armarían para una sección —
 * sin llamar al modelo. Ver LlenadoIAController::previsualizarPrompt. */
export interface PromptSeccionPreview {
  /** Bloque grande que Anthropic cachea entre llamadas (reglas + contexto general + fuente de la
   * verdad) — idéntico para toda la ficha, no cambia por sección. */
  sistemaCacheable: string;
  /** Contexto propio de esta sección — chico, NO va en el bloque cacheado. */
  sistemaVariable: string;
  usuario: string;
  /** Cuántos campos de texto (no tabla, no calculado) entraron en este prompt. */
  camposIncluidos: number;
}

export interface PromptTablaPreview {
  identificador: string;
  etiqueta: string;
  sistemaCacheable: string;
  sistemaVariable: string;
  usuario: string;
}

export interface PreviewPromptResponse {
  /** false = no hay ejemplo de referencia con fuente de la verdad cargada; ese bloque muestra un
   * placeholder explícito en vez del texto real (que varía por cada ficha de cliente). */
  fuenteVerdadEsReal: boolean;
  seccion: PromptSeccionPreview;
  tablas: PromptTablaPreview[];
}

export interface PrevisualizarPromptApi {
  porSeccion(plantillaId: string, seccionId: string): Promise<PreviewPromptResponse>;
}
