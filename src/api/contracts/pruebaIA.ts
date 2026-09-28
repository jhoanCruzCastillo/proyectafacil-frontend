export interface ArchivoAdjuntoPrueba {
  nombre: string;
  dataUrl: string;
}

export interface ModeloPruebaIA {
  id: string;
  precioEntradaUsdPorMtok: number;
  precioSalidaUsdPorMtok: number;
}

export interface UsoTokensPruebaIA {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
  output_tokens_details?: { reasoning_tokens?: number };
}

/** Un turno de conversación ya resuelto — lo que necesita CostoConversacionPanel.vue para calcular
 * totales sin volver a golpear al backend. */
export interface UsoTurno {
  modelo: string;
  usage: UsoTokensPruebaIA;
  costoUsd: number;
}

export interface RespuestaPruebaIA {
  responseId: string;
  mensaje: string;
  archivos: ArchivoAdjuntoPrueba[];
  modelo: string;
  usage: UsoTokensPruebaIA;
  costoUsd: number;
}

export interface PruebaIAApi {
  /** Sandbox de prueba (ver backend/app/Controllers/PruebaIAController.php) — llama a OpenAI
   * directo (Responses API + Code Interpreter), fuera del flujo normal de la app. */
  chat(payload: {
    mensaje: string;
    archivos: ArchivoAdjuntoPrueba[];
    previousResponseId?: string;
    modelo: string;
  }): Promise<RespuestaPruebaIA>;
  /** Modelos disponibles en el selector, con el precio (USD/millón de tokens) ya vetado que usa
   * el backend para calcular costoUsd — única fuente de verdad, no se duplica en el frontend. */
  modelos(): Promise<ModeloPruebaIA[]>;
}
