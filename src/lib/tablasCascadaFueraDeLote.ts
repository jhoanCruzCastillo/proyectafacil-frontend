/**
 * Tablas que dependen del Excel vivo del cliente (catálogo en cascada, ver
 * opcionesLlenadoCascada.ts) y por eso el backend las deja FUERA del lote de "Llenar toda la ficha"
 * (ver LlenadoIAController::TABLAS_CASCADA_FUERA_DE_LOTE — misma lista, duplicada aquí solo para que
 * el cliente sepa cuáles debe llenar aparte, síncrono, en cuanto el lote termine). Un lote
 * server-side no tiene forma de leer el Excel del navegador ni de ver el borrador de la tabla
 * anterior antes de pedir la siguiente.
 */
const TABLAS_CASCADA_FUERA_DE_LOTE: Record<string, string[]> = {
  'FTE-CUIDADO-DIURNO': ['5.01.02', '5.02.02', '5.02.04'],
};

export function esTablaCascadaFueraDeLote(plantillaCodigo: string, identificador: string): boolean {
  return (TABLAS_CASCADA_FUERA_DE_LOTE[plantillaCodigo] ?? []).includes(identificador);
}
