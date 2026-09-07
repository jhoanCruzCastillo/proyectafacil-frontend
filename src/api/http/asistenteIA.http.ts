import { apiFetch } from './_shared';

export interface TurnoAsistente {
  autor: 'usuario' | 'ia';
  texto: string;
}

/**
 * Pregunta al asesor de IA. La llamada a OpenAI la hace el BACKEND: la API key nunca llega al
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

export interface DescriptorCampoAyuda {
  identificador: string;
  etiqueta: string;
  tipo: string;
  /** Opciones de catálogo cerrado, si el campo es catalogo_simple/catalogo_encadenado/seleccion */
  opciones?: string[];
  /** Lo que el usuario ya tenga escrito (borrador o confirmado), por si está incompleto */
  valorActual?: string;
}

export interface ArchivoContextoIA {
  id: string;
  nombre: string;
  url: string;
}

export interface RespuestaAyudaCampo {
  explicacion: string;
  opciones: string[];
  /** Solo modo "verificar": si el valor actual ya está bien (null en modo "llenar"). */
  correcto: boolean | null;
  /** true = ni la fuente de la verdad ni los PDF de "Contexto general" bastaron — el frontend debe
   * ofrecer los PDF de `archivosContexto` para que el usuario los revise él mismo. */
  sinInformacionSuficiente?: boolean;
  archivosContexto?: ArchivoContextoIA[];
}

/**
 * "Ayúdame a llenar/verificar el campo X" — a diferencia de consultarAsistenteIA (charla libre), esta
 * siempre responde en un formato estructurado: una explicación breve + una lista corta de valores
 * recomendados, listos para mostrarse como botones seleccionables (ver AsesorIAChat.vue).
 */
export function pedirAyudaCampo(datos: {
  plantillaId: string;
  seccionId: string;
  /** Para traer la fuente de la verdad REAL de esta ficha (documentos que el cliente ya subió) — sin
   * esto, la IA solo tiene guías genéricas del admin, nunca los datos concretos del proyecto. */
  ejemploId: string;
  /** "llenar" (campo vacío, default) o "verificar" (campo con valor — evalúa si está bien). */
  modo?: 'llenar' | 'verificar';
  /** Valores ya confirmados de OTROS campos de la sección activa, por identificador — le da a la IA
   * contexto situacional sin tener que repetirlo en cada pregunta. */
  contextoSeccion?: Record<string, string>;
  campo: DescriptorCampoAyuda;
}): Promise<RespuestaAyudaCampo> {
  return apiFetch<RespuestaAyudaCampo>('asistente-ia/ayuda-campo', { method: 'POST', body: JSON.stringify(datos) });
}
