// Lee el Excel asignado y lo deja disponible para toda la pantalla del editor vía provide/inject,
// de forma que cada campo pueda preguntar por su celda sin que haya que pasar nada como prop por los
// tres niveles (página -> SectionContent -> FieldCard). Da dos cosas:
//
//   - las opciones del desplegable de esa celda (xlsxListas)
//   - el valor que el Excel calcularía ahí, en vivo (excelFormulaEval)
//
// Ambas son SIEMPRE una ayuda opcional: si no hay Excel, si la descarga falla o si la celda no
// aplica, el campo se comporta como texto libre igual que antes.
//
// El cálculo en batch (opcionesDe/calculado para TODAS las celdas de la plantilla, repetido tras
// cada edición) corre en un Web Worker (excelVivoWorker.ts) — es lo que documentaba el freeze real
// del hilo principal (ver excelFormulaEval.ts). El parseo del .xlsx se queda acá (DOMParser no
// funciona dentro de un Worker, confirmado en el spike de la Fase 0): el libro real
// (`LibroLeido`) sigue viviendo en el hilo principal igual que siempre, y solo se le manda al
// worker una copia serializada de sus datos (ver excelVivoSnapshot.ts) cada vez que cambia el
// archivo. `codigoFormato`/`altoDeBloque` (propiedades ESTÁTICAS de la celda, no dependen de
// valoresPorCelda) y las simulaciones puntuales `*ConOverride` (consultas baratas de una sola
// celda, no el batch completo) se siguen resolviendo directo contra ese libro real, sin pasar por
// el worker — la interfaz pública `ExcelVivo` no cambia de forma, sigue siendo 100% síncrona.

import { computed, onScopeDispose, ref, shallowRef, watch, type ComputedRef, type InjectionKey, type Ref, type ShallowRef } from 'vue';
import { leerLibroXlsx, type LibroLeido } from '@/lib/xlsxXmlReader';
import type { AltoDeBloque } from '@/lib/tableRowHelpers';
import { serializarLibro } from '@/lib/excelVivoSnapshot';
import { catalogoDeListas } from '@/lib/xlsxListas';
import { calcularCelda, type ResultadoCelda } from '@/lib/excelFormulaEval';
import type { CeldaResultado, MensajeAWorker, MensajeDeWorker, ModoCalculoExcel } from '@/workers/excelVivoProtocolo';

export type { ModoCalculoExcel };

export interface ExcelVivo {
  /** Opciones del desplegable de esa celda, o undefined si no tiene o no se pudo resolver */
  opcionesDe(hoja: string, ref: string): string[] | undefined;
  /** Código de formato numérico OOXML de la celda (`"E-"00`, …) */
  codigoFormato(hoja: string, ref: string): string | undefined;
  /** Lo que el Excel calcularía en esa celda, o undefined si la celda no tiene fórmula */
  calculado(hoja: string, ref: string): ResultadoCelda | undefined;
  /**
   * Filas que ocupa el bloque fusionado anclado en esa celda (1 si no hay fusión). Lo necesitan las
   * tablas jerárquicas para ubicar sus filas: en la plantilla oficial una fila de la tabla suele
   * ocupar un bloque de 2-3 filas ya fusionadas, y suponer 1 desalinea toda la tabla.
   */
  altoDeBloque(hoja: string, columna: string | undefined, fila: number): number | undefined;
  /**
   * Igual que `opcionesDe`, pero simulando que ciertas celdas tuvieran otro valor (sin tocar el
   * campo real). Existe para catálogos en cascada de más de un nivel (ej. Sección 5 Problema-
   * Objetivo: la causa indirecta depende de qué causa directa se elija, y esa elección todavía no
   * se ha hecho cuando se le pide a la IA que la proponga) — permite "para cada opción posible de la
   * celda de la que depende, ¿qué lista tendría esta otra celda?" sin escribir nada todavía.
   * `overrides` usa la misma clave `hoja!REF` que `valoresPorCelda`.
   */
  opcionesDeConOverride(hoja: string, ref: string, overrides: Map<string, string>): string[] | undefined;
  /**
   * Igual que `calculado`, pero simulando que ciertas celdas tuvieran otro valor — para releer una
   * columna `calculado` (ej. Departamento/Provincia/Distrito, VLOOKUP contra Ubigeo) justo después de
   * editar la celda de la que depende, SIN esperar a que `valoresPorCelda` (con debounce de 300 ms)
   * se ponga al día. Sin esto, leer `calculado()` en el mismo instante del cambio devuelve el
   * resultado calculado con el valor VIEJO de la celda de la que depende.
   */
  calculadoConOverride(hoja: string, ref: string, overrides: Map<string, string>): ResultadoCelda | undefined;
}

export const EXCEL_VIVO: InjectionKey<ComputedRef<ExcelVivo | null>> = Symbol('excelVivo');

// El libro se descarga y parsea una sola vez por URL, para toda la sesión: son ~250 KB y ni las
// opciones ni las fórmulas cambian mientras el archivo asignado sea el mismo.
const cache = new Map<string, Promise<LibroLeido>>();

/** `intentoTerminado`: true una vez que el intento de descarga/parseo ya resolvió (con éxito o con
 * error) — o de entrada si no hay `fuente` en absoluto. Distinto de `libro !== null`: permite que el
 * gate de carga de la ficha (ver useClienteFichaEditor.ts) sepa cuándo dejar de esperar aunque la
 * descarga haya fallado, en vez de quedarse esperando para siempre un Excel que nunca va a llegar. */
function useLibro(fuente: Ref<string | null | undefined>): { libro: ShallowRef<LibroLeido | null>; intentoTerminado: ShallowRef<boolean> } {
  const libro = shallowRef<LibroLeido | null>(null);
  const intentoTerminado = shallowRef(!fuente.value);

  watch(
    fuente,
    (url) => {
      libro.value = null;
      intentoTerminado.value = !url;
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
        })
        .finally(() => {
          if (fuente.value === url) intentoTerminado.value = true;
        });
    },
    { immediate: true },
  );

  return { libro, intentoTerminado };
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
  const { libro } = useLibro(fuente);
  return computed<AltoDeBloque>(() => (hoja, columna, fila) =>
    columna ? libro.value?.fusion(hoja, `${columna}${fila}`)?.filas : undefined,
  );
}

/**
 * `valoresPorCelda` son los valores que la estructura tiene mapeados, indexados `hoja!REF`; son las
 * entradas del cálculo. Pasar `null` desactiva el cálculo en vivo (las opciones siguen activas).
 */
export interface ExcelVivoConEstado {
  excelVivo: ComputedRef<ExcelVivo | null>;
  /**
   * true cuando ya no queda nada por esperar: sin Excel asignado, o el Excel terminó de
   * descargarse/parsear/cargarse en el worker Y llegó su primer batch de cálculo (o el worker no
   * se pudo crear/cargar — degradado, pero tampoco hay nada más que esperar). Antes de esto, los
   * campos "Calculado" todavía no tienen su valor real — se usa como gate de la pantalla de carga
   * de la ficha (ver useClienteFichaEditor.ts) para que el usuario nunca vea un campo calculado
   * "saltar" de vacío/editable a su valor real después de que ya se mostró la UI.
   */
  listo: ComputedRef<boolean>;
}

export function useExcelVivo(
  fuente: Ref<string | null | undefined>,
  valoresPorCelda: Ref<Map<string, string> | null>,
  modo?: Ref<ModoCalculoExcel>,
): ExcelVivoConEstado {
  const { libro, intentoTerminado: libroIntentoTerminado } = useLibro(fuente);

  let worker: Worker | null = null;
  let reqIdSeq = 0;
  let version = 0;
  const libroListoEnWorker = shallowRef(false);
  const primerResultadoListo = shallowRef(false);
  const workerFallo = shallowRef(false);
  const resultados = shallowRef<Map<string, CeldaResultado>>(new Map());

  /** null si el worker no se pudo crear (bloqueado por el navegador, CSP, etc.) — degrada a "sin
   * cálculo en batch" (mismo comportamiento que si no hubiera Excel asignado) sin romper el resto
   * de ExcelVivo, que sigue funcionando contra el libro real del hilo principal. */
  function asegurarWorker(): Worker | null {
    if (worker) return worker;
    let w: Worker;
    try {
      w = new Worker(new URL('../workers/excelVivoWorker.ts', import.meta.url), { type: 'module' });
    } catch (e) {
      console.warn('[excel-vivo-worker] no se pudo crear el worker, sigue sin cálculo en vivo:', e);
      workerFallo.value = true;
      return null;
    }
    w.onmessage = (ev: MessageEvent<MensajeDeWorker>) => {
      const msg = ev.data;
      switch (msg.tipo) {
        case 'libro-ok':
          libroListoEnWorker.value = true;
          break;
        case 'libro-error':
          console.warn('[excel-vivo-worker] no se pudo cargar el libro en el worker:', msg.mensaje);
          libroListoEnWorker.value = false;
          workerFallo.value = true;
          break;
        case 'resultado':
          if (msg.version !== version) return; // respuesta de una versión vieja: se descarta
          resultados.value = new Map(msg.porCelda);
          primerResultadoListo.value = true;
          break;
        case 'error':
          console.warn('[excel-vivo-worker] error puntual:', msg.mensaje);
          break;
      }
    };
    w.onerror = (ev) => {
      console.warn('[excel-vivo-worker] el worker falló:', ev.message);
      workerFallo.value = true;
    };
    worker = w;
    return w;
  }

  onScopeDispose(() => {
    worker?.terminate();
    worker = null;
  });

  // Manda el libro al worker cada vez que cambia el archivo real (nuevo fetch/parseo terminado).
  watch(
    libro,
    (l) => {
      libroListoEnWorker.value = false;
      primerResultadoListo.value = false;
      resultados.value = new Map();
      if (!l) return;
      const w = asegurarWorker();
      if (!w) return; // sin worker disponible: opcionesDe/calculado quedan undefined, resto de ExcelVivo sigue andando
      const msg: MensajeAWorker = { tipo: 'cargar', reqId: ++reqIdSeq, snapshot: serializarLibro(l) };
      w.postMessage(msg);
    },
    { immediate: true },
  );

  // Batch de cálculo: se dispara cuando el worker ya tiene el libro Y cambian los valores/modo.
  const modoRef: Ref<ModoCalculoExcel> = modo ?? ref<ModoCalculoExcel>('cache');
  watch(
    [libroListoEnWorker, valoresPorCelda, modoRef],
    ([listo, valores, modoActual]) => {
      if (!listo || !worker) return;
      version++;
      const entradas = Array.from((valores ?? new Map()).entries());
      const msg: MensajeAWorker = {
        tipo: 'recalcular',
        reqId: ++reqIdSeq,
        version,
        entradas,
        modo: modoActual,
      };
      worker.postMessage(msg);
    },
    { immediate: true },
  );

  const excelVivo = computed<ExcelVivo | null>(() => {
    const l = libro.value;
    if (!l) return null;
    const porCelda = resultados.value;

    return {
      opcionesDe: (hoja, ref) => porCelda.get(`${hoja}!${ref}`)?.opciones,
      codigoFormato: (hoja, ref) => l.codigoFormato(hoja, ref),
      altoDeBloque: (hoja, columna, fila) => (columna ? l.fusion(hoja, `${columna}${fila}`)?.filas : undefined),
      calculado: (hoja, ref) => porCelda.get(`${hoja}!${ref}`)?.calculado,
      // Simulaciones puntuales (una sola celda, no el batch de miles) — se calculan directo contra
      // el libro real del hilo principal, igual que siempre: no hay freeze que evitar acá y así la
      // interfaz de estos 2 métodos no tiene que volverse async para el resto del código que ya los
      // llama de forma síncrona (cascadaProblemaObjetivo.ts, opcionesEstaticasTabla.ts,
      // usePlantillaEditor.ts).
      opcionesDeConOverride: (hoja, ref, overrides) => {
        const valoresSimulados = new Map(valoresPorCelda.value ?? new Map());
        for (const [clave, valor] of overrides) valoresSimulados.set(clave, valor);
        return catalogoDeListas(l, valoresSimulados, undefined, false).opcionesDe(hoja, ref);
      },
      calculadoConOverride: (hoja, ref, overrides) => {
        const valoresSimulados = new Map(valoresPorCelda.value ?? new Map());
        for (const [clave, valor] of overrides) valoresSimulados.set(clave, valor);
        return calcularCelda(l, valoresSimulados, hoja, ref, undefined);
      },
    };
  });

  const listo = computed(() => {
    if (!fuente.value) return true; // sin Excel asignado a esta plantilla — nada que esperar
    if (!libroIntentoTerminado.value) return false; // todavía descargando/parseando el .xlsx
    if (!libro.value) return true; // terminó pero falló (red, archivo corrupto) — degradado
    if (workerFallo.value) return true; // el worker no se pudo crear o se cayó — degradado
    if (!libroListoEnWorker.value) return false; // esperando que el worker cargue el snapshot
    return primerResultadoListo.value; // esperando el primer batch de cálculo real
  });

  return { excelVivo, listo };
}
