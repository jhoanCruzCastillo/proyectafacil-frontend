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
import { catalogoDeListas } from '@/lib/xlsxListas';
import { calcularCelda, crearMemoCompartido, type ResultadoCelda } from '@/lib/excelFormulaEval';

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

/**
 * 'cache' (por defecto): las listas del Excel que no dependen de otros campos se resuelven una sola
 * vez por archivo, y las fórmulas visibles de una misma pasada comparten lo que ya calcularon entre
 * sí — ver `useExcelVivo`. 'tiempo_real' apaga ambas cosas y vuelve al comportamiento original (todo
 * se recalcula desde cero en cada tecla): es la vía de escape manual del selector del editor, para
 * cuando se sospeche que el caché muestra algo desactualizado en una ficha puntual.
 */
export type ModoCalculoExcel = 'cache' | 'tiempo_real';

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
  modo?: Ref<ModoCalculoExcel>,
): ComputedRef<ExcelVivo | null> {
  const libro = useLibro(fuente);

  // `catalogo` y `calculado` se arman en el MISMO computed (antes eran dos computeds separados) para
  // poder compartir un único `memoFormulas` entre ambos: sin él, dos fórmulas visibles que leen el
  // mismo rango grande (p. ej. dos totales que suman las mismas 500 filas) lo recorrían cada una por
  // su cuenta. Compartirlo es seguro porque las dos cuelgan de las mismas dependencias reactivas
  // (`libro`, `valoresPorCelda` y `modo`): se recrea entero en cuanto cualquiera de las tres cambia,
  // así que nunca puede devolver un valor de un snapshot anterior.
  return computed<ExcelVivo | null>(() => {
    const l = libro.value;
    if (!l) return null;
    const valores = valoresPorCelda.value;
    const usarCache = (modo?.value ?? 'cache') === 'cache';
    // En modo 'tiempo_real' no se comparte memo entre fórmulas ni se usa el caché permanente de
    // listas: cada una vuelve a resolverse desde cero, igual que antes de que existiera el caché.
    const memoFormulas = usarCache ? crearMemoCompartido() : undefined;
    // El catálogo depende de los valores porque las listas dependientes (`INDIRECT`) se calculan a
    // partir de otros campos: al cambiar el campo padre, cambian las opciones que ofrece el hijo.
    const catalogo = catalogoDeListas(l, valores ?? new Map(), memoFormulas, usarCache);
    // Se memoriza aparte (por celda, no por fórmula) para no volver a llamar a `calcularCelda` si dos
    // campos visibles apuntan exactamente a la misma celda.
    const memoCalculado = new Map<string, ResultadoCelda | undefined>();

    return {
      opcionesDe: (hoja, ref) => catalogo.opcionesDe(hoja, ref),
      altoDeBloque: (hoja, columna, fila) => (columna ? l.fusion(hoja, `${columna}${fila}`)?.filas : undefined),
      calculado: (hoja, ref) => {
        if (!valores) return undefined;
        const clave = `${hoja}!${ref}`;
        if (!memoCalculado.has(clave)) memoCalculado.set(clave, calcularCelda(l, valores, hoja, ref, memoFormulas));
        return memoCalculado.get(clave);
      },
    };
  });
}
