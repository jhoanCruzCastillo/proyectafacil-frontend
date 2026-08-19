/**
 * Tablas que son de solo-fórmula (el Excel las calcula solas) y por lo tanto no ofrecen el botón
 * "Llenar con IA" — misma lista hardcodeada por `plantilla.codigo` que
 * `LlenadoIAController::CAMPOS_TABLA_EXCLUIDOS` en el backend (duplicada aquí solo para no mostrar el
 * botón; el backend igual la vuelve a aplicar si de todos modos llega la petición). Verificado contra
 * el instructivo MIDIS: 7.02.01/7.03.01/7.05.01/7.06.01 se calculan automáticamente; 7.04.01 no, y sí
 * se ofrece. 12/13/14.02.1/.02.2/.03.1/.04.1/.05.1 (Evaluación Social, las 3 alternativas) son costos
 * sociales/flujo/indicadores/sensibilidad derivados por fórmula de Costos del Proyecto — ver el
 * comentario homónimo en el backend.
 */
const CAMPOS_TABLA_EXCLUIDOS: Record<string, string[]> = {
  'FTE-CUIDADO-DIURNO': [
    '7.02.01', '7.03.01', '7.05.01', '7.06.01',
    '12.02.1', '12.02.2', '12.03.1', '12.04.1', '12.05.1',
    '13.02.1', '13.02.2', '13.03.1', '13.04.1', '13.05.1',
    '14.02.1', '14.02.2', '14.03.1', '14.04.1', '14.05.1',
  ],
};

export function esTablaExcluidaDeIA(plantillaCodigo: string, identificador: string): boolean {
  return (CAMPOS_TABLA_EXCLUIDOS[plantillaCodigo] ?? []).includes(identificador);
}
