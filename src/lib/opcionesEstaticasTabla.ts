import type { ConfigTabla } from '@/types';
import type { ExcelVivo } from '@/composables/useListasExcel';

/**
 * Para columnas de tabla con un desplegable FIJO en el Excel (validación de datos por lista, que NO
 * depende de otra celda) que el JSON de estructura no capturó como `opciones` estático — lee la lista
 * vigente directo del Excel en vivo y la manda al backend como si viniera del JSON.
 *
 * Generaliza a CUALQUIER tabla/columna, a diferencia de cascadaProblemaObjetivo.ts (que sigue siendo
 * necesario aparte, solo para las 3 columnas de la Sección 5 cuyo desplegable SÍ depende de otra celda
 * vía INDIRECT — eso requiere lógica condicional que esta función no intenta cubrir). Encontrado en
 * vivo: la columna "¿Se incluye como parte del PI?" de 08.03.1 no tenía `opciones` en el JSON (solo
 * existe como validación de datos del Excel), así que la IA proponía texto libre ("Sí") que no
 * calzaba con ninguna de las 2 opciones reales del desplegable.
 *
 * Se lee la PRIMERA fila de datos de la tabla (`captura.filaInicial`) porque el rango de validación de
 * datos de Excel normalmente cubre toda la columna por igual — si en algún caso real la lista cambiara
 * fila a fila sin depender de otra celda (no visto todavía en esta ficha), esta función no lo detecta;
 * seguiría haciendo falta un resolver dedicado como el de la Sección 5.
 */
export function opcionesEstaticasPorColumna(excel: ExcelVivo, hoja: string, config: ConfigTabla): Record<string, string[]> {
  const fila = config.captura?.filaInicial;
  if (fila == null) return {};

  const out: Record<string, string[]> = {};
  for (const columna of config.columnas) {
    if (!columna.columnaExcel) continue;
    const opciones = excel.opcionesDe(hoja, `${columna.columnaExcel}${fila}`);
    if (opciones && opciones.length > 0) {
      out[columna.id] = opciones;
    }
  }
  return out;
}
