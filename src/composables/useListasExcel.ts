// Lee el Excel asignado y lo deja disponible para toda la pantalla del editor vía provide/inject,
// de forma que cada campo pueda preguntar por su celda sin que haya que pasar nada como prop por los
// tres niveles (página -> SectionContent -> FieldCard). Da dos cosas:
//
//   - las opciones del desplegable de esa celda (xlsxListas)
//   - el valor que el Excel calcularía ahí, en vivo (excelFormulaEval)
//
// Ambas son SIEMPRE una ayuda opcional: si no hay Excel, si la descarga falla o si la celda no
// aplica, el campo se comporta como texto libre igual que antes.

import { computed, shallowRef, watch, type ComputedRef, type InjectionKey, type Ref, type ShallowRef } from 'vue';
import { leerLibroXlsx, type LibroLeido } from '@/lib/xlsxXmlReader';
import type { AltoDeBloque } from '@/lib/tableRowHelpers';
import { catalogoDeListas, type CatalogoListas } from '@/lib/xlsxListas';
import { calcularCelda, type ResultadoCelda } from '@/lib/excelFormulaEval';

export interface ExcelVivo {
  /** Opciones del desplegable de esa celda, o undefined si no tiene o no se pudo resolver */
  opcionesDe(hoja: string, ref: string): string[] | undefined;
  /** Lo que el Excel calcularía en esa celda, o undefined si la celda no tiene fórmula */
  calculado(hoja: string, ref: string): ResultadoCelda | undefined;
  /**
   * Filas que ocupa el bloque fusionado anclado en esa celda (1 si no hay fusión). Lo necesitan las
   * tablas jerárquicas para ubicar sus filas: en la plantilla oficial una fila de la tabla suele
   * ocupar un bloque de 2-3 filas ya fusionadas, y suponer 1 desalinea toda la tabla.
   */
  altoDeBloque(hoja: string, columna: string | undefined, fila: number): number | undefined;
}

export const EXCEL_VIVO: InjectionKey<ComputedRef<ExcelVivo | null>> = Symbol('excelVivo');

// El libro se descarga y parsea una sola vez por URL, para toda la sesión: son ~250 KB y ni las
// opciones ni las fórmulas cambian mientras el archivo asignado sea el mismo.
const cache = new Map<string, Promise<LibroLeido>>();

function useLibro(fuente: Ref<string | null | undefined>): ShallowRef<LibroLeido | null> {
  const libro = shallowRef<LibroLeido | null>(null);

  watch(
    fuente,
    (url) => {
      libro.value = null;
      if (!url) return;

      let promesa = cache.get(url);
      if (!promesa) {
        promesa = leerLibroXlsx(url);
        cache.set(url, promesa);
      }
      promesa
        .then((l) => {
          if (fuente.value === url) libro.value = l; // el archivo pudo cambiar mientras se bajaba
        })
        .catch((e) => {
          cache.delete(url); // que un fallo puntual de red no deje la pantalla sin ayudas
          console.warn('[excel] no se pudo leer el Excel asignado:', e);
        });
    },
    { immediate: true },
  );

  return libro;
}

/**
 * Altura de los bloques fusionados del libro, sin montar todo el servicio de cálculo.
 *
 * Existe aparte porque hay un orden de dependencias que no se puede invertir: para indexar las
 * celdas de una tabla jerárquica (las ENTRADAS del cálculo) ya hace falta saber cuántas filas ocupa
 * cada bloque, y eso se lee del libro. Como la caché de libros es por URL, pedirlo aquí no descarga
 * nada extra: es el mismo archivo que luego usa `useExcelVivo`.
 */
export function useAltoDeBloqueExcel(fuente: Ref<string | null | undefined>): ComputedRef<AltoDeBloque> {
  const libro = useLibro(fuente);
  return computed<AltoDeBloque>(() => (hoja, columna, fila) =>
    columna ? libro.value?.fusion(hoja, `${columna}${fila}`)?.filas : undefined,
  );
}

/**
 * `valoresPorCelda` son los valores que la estructura tiene mapeados, indexados `hoja!REF`; son las
 * entradas del cálculo. Pasar `null` desactiva el cálculo en vivo (las opciones siguen activas).
 */
export function useExcelVivo(
  fuente: Ref<string | null | undefined>,
  valoresPorCelda: Ref<Map<string, string> | null>,
): ComputedRef<ExcelVivo | null> {
  const libro = useLibro(fuente);
  // El catálogo depende de los valores porque las listas dependientes (`INDIRECT`) se calculan a
  // partir de otros campos: al cambiar el campo padre, cambian las opciones que ofrece el hijo.
  const catalogo = computed<CatalogoListas | null>(() =>
    libro.value ? catalogoDeListas(libro.value, valoresPorCelda.value ?? new Map()) : null,
  );

  return computed<ExcelVivo | null>(() => {
    const l = libro.value;
    if (!l) return null;
    const valores = valoresPorCelda.value;
    // Se memoriza dentro de la pasada: varias celdas de la misma hoja comparten dependencias
    // (todas las de Datos Generales cuelgan de B44) y así no se recalculan una y otra vez.
    const memo = new Map<string, ResultadoCelda | undefined>();

    return {
      opcionesDe: (hoja, ref) => catalogo.value?.opcionesDe(hoja, ref),
      altoDeBloque: (hoja, columna, fila) => (columna ? l.fusion(hoja, `${columna}${fila}`)?.filas : undefined),
      calculado: (hoja, ref) => {
        if (!valores) return undefined;
        const clave = `${hoja}!${ref}`;
        if (!memo.has(clave)) memo.set(clave, calcularCelda(l, valores, hoja, ref));
        return memo.get(clave);
      },
    };
  });
}
