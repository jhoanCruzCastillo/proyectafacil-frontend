import type { Campo, Plantilla } from '@/types';
import { aFechaISO, numeroDesdeTextoVisible } from './conversionesExcel';
import { esJerarquica, parseDynamicRows, parseGroupedRows, parseTree, type FilaDinamica, type TreeNode, type ValorCelda } from './tableRowHelpers';

// Validación de los VALORES que llena el cliente (obligatoriedad + tipo) — distinto de
// campoValidation.ts, que valida la posición de captura en Excel (cosa del admin).

export function validarValorCampo(campo: Campo, valor: string | undefined): string | null {
  const v = (valor ?? '').trim();
  if (!v) return campo.requerido ? 'Este campo es obligatorio' : null;
  if (campo.tipo === 'numero' || campo.tipo === 'decimal') {
    // Misma lectura que excelWriter.ts (coerceValor -> numeroDesdeTextoVisible): acepta "68%" (el
    // Excel real lo admite en una celda con formato de porcentaje) además de números planos — sin
    // esto, un valor que el Excel acepta sin problema quedaba rechazado aquí antes de guardarse.
    if (numeroDesdeTextoVisible(v) === null) return 'Debe ser un número válido';
  }
  // Misma lectura que conversionesExcel.ts (aFechaISO): acepta "DD/MM/YYYY" además de lo que ya
  // entiende Date.parse — sin esto, un Date.parse crudo interpreta "15/09/2026" como MM/DD/YYYY
  // (día 15 no es mes válido) y rechazaba fechas perfectamente válidas.
  if (campo.tipo === 'fecha' && aFechaISO(v, false) === null) {
    return 'Debe ser una fecha válida';
  }
  return null;
}

// Recorre toda la plantilla y devuelve un mapa identificador → mensaje de error, solo para
// campos simples (tabla/tabla_jerarquica quedan fuera por ahora — su valor es una estructura
// JSON, no un string plano comparable con estas reglas).
export function validarValoresPlantilla(plantilla: Plantilla, valores: Record<string, string>): Record<string, string> {
  const errores: Record<string, string> = {};
  for (const seccion of plantilla.secciones) {
    for (const sub of seccion.subsecciones) {
      for (const campo of sub.campos) {
        if (campo.tipo === 'tabla' || campo.tipo === 'tabla_jerarquica' || campo.tipo === 'nota' || !campo.editable) continue;
        const error = validarValorCampo(campo, valores[campo.identificador]);
        if (error) errores[campo.identificador] = error;
      }
    }
  }
  return errores;
}

function celdaTieneValor(v: ValorCelda | undefined): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.some((x) => (x ?? '').trim() !== '');
  return Object.values(v).some((x) => (x ?? '').trim() !== '');
}

function filaTieneValor(fila: FilaDinamica): boolean {
  return Object.values(fila).some(celdaTieneValor);
}

function nodoTieneValor(node: TreeNode): boolean {
  if (celdaTieneValor(node.value)) return true;
  if (node.valores && filaTieneValor(node.valores)) return true;
  return node.children.some(nodoTieneValor);
}

// Una tabla cuenta como "llena" solo si tiene al menos una celda con contenido real — las filas,
// grupos o nodos vacíos que tableRowHelpers genera por defecto (para que la tabla tenga algo que
// mostrar antes de que el cliente escriba nada) no cuentan, así que una tabla sin tocar queda
// pendiente igual que cualquier otro campo vacío. Mismo orden de ramas que indexarCeldasDeTabla
// (jerárquica primero, agrupador después) para no desalinearse de cómo se interpreta el JSON crudo.
export function tablaTieneValor(campo: Campo, raw: string | undefined): boolean {
  const config = campo.configTabla;
  if (!raw || !config) return false;
  if (esJerarquica(config.subtipo)) {
    return parseTree(raw, config.columnas, config).some(nodoTieneValor);
  }
  if (config.agrupador) {
    return parseGroupedRows(raw, config).some((g) => g.filas.some(filaTieneValor) || (g.valoresGrupo && filaTieneValor(g.valoresGrupo)));
  }
  return parseDynamicRows(raw, config).some(filaTieneValor);
}

export interface ProgresoFicha {
  llenos: number;
  total: number;
  /** 0-100. Si la plantilla no tiene campos editables, se considera 100 (nada pendiente). */
  porcentaje: number;
}

// Progreso de LLENADO (cuántos campos tienen algún valor) — distinto de validarValoresPlantilla,
// que solo mira obligatoriedad/formato. Un campo opcional vacío cuenta como pendiente aquí aunque
// no genere ningún error de validación. Los campos tabla/tabla_jerarquica SÍ cuentan (a diferencia
// de validarValoresPlantilla): valen como "llenos" si tienen al menos una celda con contenido real.
export function calcularProgresoValores(plantilla: Plantilla, valores: Record<string, string>): ProgresoFicha {
  let total = 0;
  let llenos = 0;
  for (const seccion of plantilla.secciones) {
    for (const sub of seccion.subsecciones) {
      for (const campo of sub.campos) {
        if (campo.tipo === 'nota' || !campo.editable) continue;
        total++;
        if (campo.tipo === 'tabla' || campo.tipo === 'tabla_jerarquica') {
          if (tablaTieneValor(campo, valores[campo.identificador])) llenos++;
        } else if ((valores[campo.identificador] ?? '').trim()) {
          llenos++;
        }
      }
    }
  }
  const porcentaje = total > 0 ? Math.round((llenos / total) * 100) : 100;
  return { llenos, total, porcentaje };
}
