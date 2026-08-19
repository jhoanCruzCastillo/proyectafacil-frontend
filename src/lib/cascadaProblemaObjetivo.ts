// Resuelve, para los 3 campos-tabla de la Sección 5 (Problema-Objetivo) de FTE-CUIDADO-DIURNO cuyo
// desplegable real depende de otro campo (INDIRECT de más de un nivel — ver la propuesta de llenado
// híbrido, Franja C), las opciones vigentes del Excel ANTES de llamar a la IA, para que
// `construirPromptTabla` (backend) no tenga que adivinar el catálogo.
//
// Mapeo de celdas verificado contra el Excel real (xl/worksheets/sheet7.xml, hoja 'Problema-
// Objetivo') — no es un motor genérico de cascada: es específico de esta ficha, porque construir uno
// genérico exigiría reimplementar el cálculo de posición de fila de HierarchicalTableEditor.vue
// (`posicionesArbol`/`fusion`) fuera de su contexto de render, que es un problema bastante más grande
// que el que hace falta resolver hoy.
//
//   Causa Directa (B12, B15)          <- INDIRECT(Listas!D44), depende de Datos Generales!B44
//   Causa Indirecta bajo B12 (F12-F14) <- INDIRECT(Listas!D48), depende del VALOR puesto en B12
//   Causa Indirecta bajo B15 (F15)     <- INDIRECT(Listas!D51), depende del VALOR puesto en B15
//   Acciones bajo F12 (5.02.02, fila dinámica desde G40) <- INDIRECT(Listas!C48), depende de F12
//   Acciones bajo F13 (5.02.04 fila 1, G44)               <- INDIRECT(Listas!C49), depende de F13
//   Acciones bajo F14 (5.02.04 fila 2, G45)               <- INDIRECT(Listas!C50), depende de F14
//   Acciones bajo F15 (5.02.04 fila 3, G46)                <- INDIRECT(Listas!C51), depende de F15
//
// Como al momento de llenar 5.01.02 todavía no se sabe qué Causa Directa va a elegir la IA, no se
// puede resolver una única lista de Causas Indirectas: se enumeran las opciones para CADA Causa
// Directa posible (con `opcionesDeConOverride`, sin escribir nada real) y se arma una guía
// condicional en texto para el prompt. La validación de las celdas hoja sigue siendo la UNIÓN de
// todas las ramas (ver LlenadoIAController::compararForma) — más laxa que una validación por fila,
// pero suficiente para no aceptar texto inventado, y la guía condicional es lo que ayuda al modelo a
// no cruzar una causa de una rama con la indirecta de otra.
import type { ExcelVivo } from '@/composables/useListasExcel';
import type { OpcionesLlenadoTabla } from '@/api/contracts/llenadoTablaIA';

const HOJA = 'Problema-Objetivo';

function union(...listas: (string[] | undefined)[]): string[] {
  const set = new Set<string>();
  for (const lista of listas ?? []) {
    for (const o of lista ?? []) set.add(o);
  }
  return [...set];
}

function resolverCausasDirectas(excel: ExcelVivo): string[] {
  return excel.opcionesDe(HOJA, 'B12') ?? [];
}

/** Para cada Causa Directa posible, qué Causas Indirectas tendría la fila `celdaCI` si esa fuera la
 * elegida en `celdaCD` — sin comprometer nada real. */
function resolverCausasIndirectasCondicional(excel: ExcelVivo, celdaCD: string, celdaCI: string): { porCD: Record<string, string[]>; texto: string } {
  const causasDirectas = resolverCausasDirectas(excel);
  const porCD: Record<string, string[]> = {};
  for (const cd of causasDirectas) {
    const overrides = new Map([[`${HOJA}!${celdaCD}`, cd]]);
    porCD[cd] = excel.opcionesDeConOverride(HOJA, celdaCI, overrides) ?? [];
  }
  const texto = Object.entries(porCD)
    .filter(([, ci]) => ci.length > 0)
    .map(([cd, ci]) => `si la Causa Directa es "${cd}", las Causas Indirectas válidas para esa fila son: ${ci.join(' | ')}`)
    .join('; ');
  return { porCD, texto };
}

/** 5.01.02 — Causas directas, indirectas y evidencias (árbol: cd / ci / evidencias). */
function opcionesCausasDirectasIndirectas(excel: ExcelVivo): OpcionesLlenadoTabla {
  const causasDirectas = resolverCausasDirectas(excel);
  const bajoB12 = resolverCausasIndirectasCondicional(excel, 'B12', 'F12');
  const bajoB15 = resolverCausasIndirectasCondicional(excel, 'B15', 'F15');

  return {
    opcionesPorColumna: {
      cd: causasDirectas,
      ci: union(...Object.values(bajoB12.porCD), ...Object.values(bajoB15.porCD)),
    },
    contextoAdicional:
      'NO cambies la forma del árbol de abajo (sigue teniendo exactamente 2 nodos raíz, con la misma '
      + 'cantidad de hijos que ya tienen) — esta guía es solo para saber qué texto poner en cada "value" '
      + `que ya existe, no para agregar ni quitar nodos. Guía: para el nodo raíz #1 (el de más hijos), ${bajoB12.texto}. `
      + `Para el nodo raíz #2 (el de un solo hijo), ${bajoB15.texto}. `
      + 'La Causa Indirecta de cada hijo debe salir de la lista que corresponde a la Causa Directa de SU PROPIO nodo raíz.',
  };
}

/** 5.02.02 — Medios fundamentales / Acciones bajo la Causa Indirecta de F12 (filas dinámicas, todas
 * las filas comparten la misma lista de acciones: la validación real del Excel cubre G40:J43 entero
 * como un solo rango). */
function opcionesAccionesF12(excel: ExcelVivo): OpcionesLlenadoTabla {
  const opciones = excel.opcionesDe(HOJA, 'G40') ?? [];

  return {
    opcionesPorColumna: { acciones: opciones },
    contextoAdicional: opciones.length > 0
      ? `Las acciones válidas para esta tabla son: ${opciones.join(' | ')}.`
      : 'Todavía no hay Causas Indirectas confirmadas en la tabla 5.01.02 — llena primero esa tabla y confírmala antes de llenar esta.',
  };
}

/** 5.02.04 — Medios fundamentales / Acciones para las 3 filas restantes (F13, F14, F15) — cada FILA
 * depende de una Causa Indirecta distinta, algo que esta versión del validador no distingue por fila
 * (solo por columna) — se pasa la unión de las 3 y se explica la correspondencia en el texto, igual
 * que en 5.01.02. */
function opcionesAccionesF13F14F15(excel: ExcelVivo): OpcionesLlenadoTabla {
  const porFila: [string, string][] = [
    ['F13', 'G44'],
    ['F14', 'G45'],
    ['F15', 'G46'],
  ];
  const listas = porFila.map(([, celdaAccion]) => excel.opcionesDe(HOJA, celdaAccion) ?? []);
  const partes = listas
    .map((opciones, i) => (opciones.length > 0 ? `fila N° ${i + 2}: ${opciones.join(' | ')}` : null))
    .filter((s): s is string => s !== null);

  return {
    opcionesPorColumna: { acciones: union(...listas) },
    contextoAdicional: partes.length > 0
      ? `Cada fila de esta tabla tiene su propia lista de acciones válidas, según su N°: ${partes.join('; ')}.`
      : 'Todavía no hay Causas Indirectas confirmadas en la tabla 5.01.02 — llena primero esa tabla y confírmala antes de llenar esta.',
  };
}

/** @returns las opciones a mandar junto con la petición de llenado con IA para este campo, o
 * `undefined` si no es uno de los 3 campos con catálogo en cascada de esta sección. */
export function opcionesLlenadoCascada(identificador: string, excel: ExcelVivo | null): OpcionesLlenadoTabla | undefined {
  if (!excel) return undefined;
  switch (identificador) {
    case '5.01.02':
      return opcionesCausasDirectasIndirectas(excel);
    case '5.02.02':
      return opcionesAccionesF12(excel);
    case '5.02.04':
      return opcionesAccionesF13F14F15(excel);
    default:
      return undefined;
  }
}
