import type { Campo, ConfigTabla, Plantilla } from '../types';

// Una columna de Excel se referencia por letra (A, B, ..., AA...), nunca por número — la UI del
// editor sí numera visualmente las columnas de una tabla (1, 2, 3...) y es fácil escribir ese
// número acá por error, pensando en esa posición visual en vez de la letra real de la hoja. Un
// valor así no está "vacío" (pasa columnaFaltaCaptura sin avisar) pero rompe la aritmética de
// columnas de excelWriter.ts (colLetterToIndex/addCols) más adelante, con un error críptico al
// insertar (ver ColumnaExcelInvalidaError). Se valida acá, en el mismo punto donde se escribe.
export const COLUMNA_EXCEL_VALIDA = /^[A-Za-z]+$/;

export function columnaExcelFormatoInvalido(valor: string | undefined | null): boolean {
  return !!valor && !COLUMNA_EXCEL_VALIDA.test(valor);
}

// Una columna de tabla necesita su propia posición en Excel (columnaExcel) — si falta,
// excelWriter.ts la salta silenciosamente al insertar valores (ver writeFilaColumnas/writeCampoTabla).
export function columnaFaltaCaptura(col: { columnaExcel?: string }): boolean {
  return !col.columnaExcel;
}

function tablaFaltaCaptura(config: ConfigTabla | undefined): boolean {
  if (!config || config.columnas.length === 0) return true;
  if (!config.captura?.filaInicial) return true;
  return config.columnas.some(columnaFaltaCaptura);
}

// Un campo "falta captura" si no tiene registrada la posición donde se escribe su valor en el
// Excel — para tablas, la fila inicial de la tabla y la columna de cada una de sus columnas;
// para campos sueltos, columna + fila. Sin esto, excelWriter.ts no puede insertar el valor.
export function campoFaltaCaptura(campo: Campo): boolean {
  // Una nota (4.11) no es un campo real de la ficha: nunca tiene ni necesita captura en Excel.
  if (campo.tipo === 'nota') return false;
  const esTabla = campo.tipo === 'tabla' || campo.tipo === 'tabla_jerarquica';
  if (esTabla) return tablaFaltaCaptura(campo.configTabla);
  return !campo.captura?.columna || !campo.captura?.fila;
}

export function contarCamposSinCaptura(plantilla: Plantilla): number {
  let total = 0;
  for (const seccion of plantilla.secciones) {
    for (const sub of seccion.subsecciones) {
      for (const campo of sub.campos) {
        if (campoFaltaCaptura(campo)) total++;
      }
    }
  }
  return total;
}

/** Primer campo sin captura, en el mismo orden en que se recorren las secciones/subsecciones —
 * usado tras guardar para llevar al usuario directo a ese campo (ver usePlantillaEditor::handleSave). */
export function primerCampoSinCaptura(plantilla: Plantilla): { seccionId: string; campo: Campo } | null {
  for (const seccion of plantilla.secciones) {
    for (const sub of seccion.subsecciones) {
      for (const campo of sub.campos) {
        if (campoFaltaCaptura(campo)) return { seccionId: seccion.id, campo };
      }
    }
  }
  return null;
}

/** Busca un campo por su `identificador` (ej. "03.06.3") recorriendo toda la plantilla — usado para
 * ir directo al campo señalado por un error estructurado (ver ColumnaExcelInvalidaError). */
export function buscarCampoPorIdentificador(plantilla: Plantilla, identificador: string): { seccionId: string; campo: Campo } | null {
  for (const seccion of plantilla.secciones) {
    for (const sub of seccion.subsecciones) {
      for (const campo of sub.campos) {
        if (campo.identificador === identificador) return { seccionId: seccion.id, campo };
      }
    }
  }
  return null;
}

/**
 * Aproxima qué campo estaba escribiendo cerca de una FILA de Excel que falló al insertar (ej. "Dirección
 * de celda inválida: 166", ver excelWriter.ts) — pedido explícito del usuario para no dejarlo solo con
 * un mensaje críptico. No hay forma barata de saber la fila EXACTA de una tabla ya crecida (eso requiere
 * recorrer todo el árbol con el Excel vivo cargado, igual que excelWriter.ts), así que se usa una
 * aproximación honesta: de todos los campos con posición declarada en o antes de esa fila, el de
 * posición más alta — normalmente esa tabla (o la inmediatamente anterior, si la fila cayó dentro de
 * filas que creció más allá de su base) es la responsable.
 *
 * Los números de fila de Excel son independientes POR HOJA (cada hoja del libro numera su propio
 * `sheetData` desde 1) — comparar "fila 166" de una sección contra la fila de un campo en otra hoja
 * no tiene sentido. Cuando se puede identificar la hoja donde ocurrió el error (ver
 * xlsxXmlPatcher::aplicarEdicionesXlsx, que ahora antepone `Hoja "..."` al mensaje), se restringe la
 * búsqueda a las secciones de esa misma hoja; si no se pudo identificar la hoja, se cae de vuelta al
 * comportamiento anterior (buscar en toda la plantilla) como aproximación degradada pero útil.
 */
export function campoCercaDeFilaExcel(
  plantilla: Plantilla,
  fila: number,
  hoja: string | null = null,
): { seccionId: string; campo: Campo } | null {
  let mejor: { seccionId: string; campo: Campo; posicion: number } | null = null;
  for (const seccion of plantilla.secciones) {
    if (hoja != null && seccion.hoja !== hoja) continue;
    for (const sub of seccion.subsecciones) {
      for (const campo of sub.campos) {
        const esTabla = campo.tipo === 'tabla' || campo.tipo === 'tabla_jerarquica';
        const posicion = esTabla ? campo.configTabla?.captura?.filaInicial : campo.captura?.fila;
        if (posicion == null || posicion > fila) continue;
        if (!mejor || posicion > mejor.posicion) {
          mejor = { seccionId: seccion.id, campo, posicion };
        }
      }
    }
  }
  return mejor ? { seccionId: mejor.seccionId, campo: mejor.campo } : null;
}
