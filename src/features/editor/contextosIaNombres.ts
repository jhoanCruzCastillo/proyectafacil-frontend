/** Nombres fijos en `contextos_ia_general` para los pilares 1 y 2 del nuevo panel. */
export const NOMBRE_PROMPT_SISTEMA = 'Prompt del sistema';
export const NOMBRE_CONTEXTO_GENERAL = 'Contexto general';

/**
 * Nombre fijo en `contextos_ia_globales` que el backend busca por texto literal
 * (LlenadoIAController::contenidoGlobalPorNombre) para armar las "Reglas de llenado" de CUALQUIER
 * plantilla — a diferencia de los demás globales (reutilizables, sin nombre reservado), renombrar
 * o borrar esta fila específica rompe ese lookup para toda la plataforma, no solo esta ficha.
 */
export const NOMBRE_REGLAS_LLENADO = 'Reglas de llenado automático con IA';

/**
 * Igual que NOMBRE_REGLAS_LLENADO, pero para la frase de rol — antes hardcodeada dentro de
 * construirSistema()/construirSistemaTabla(), movida acá porque es pura prosa de encuadre (nadie la
 * parsea con código, a diferencia del contrato JSON de salida, que se queda en el backend). Ver
 * LlenadoIAController::rolAsistente() — si esta fila se borra o queda vacía, cae a un texto de
 * respaldo hardcodeado, así que borrarla no rompe el llenado, pero sí lo deja sin la versión
 * editable por el admin.
 */
export const NOMBRE_ROL_ASISTENTE = 'Rol del asistente de IA';
