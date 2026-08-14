import { onBeforeUnmount, shallowRef, watch, type Ref, type ShallowRef } from 'vue';
import { indexarCeldasDeTabla, type AltoDeBloque } from '@/lib/tableRowHelpers';
import type { Plantilla } from '@/types';

export type ResolverValorCampo = (identificador: string, valorEjemplo: string | undefined) => string;

/** Construye el mapa `hoja!REF → valor` que alimenta Excel-vivo (listas + fórmulas). */
export function construirMapaValoresPorCelda(
  plantilla: Plantilla,
  altoDeBloque: AltoDeBloque,
  valorDe: ResolverValorCampo,
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const sec of plantilla.secciones) {
    if (!sec.hoja) continue;
    for (const sub of sec.subsecciones) {
      for (const campo of sub.campos) {
        const crudo = valorDe(campo.identificador, campo.valorEjemplo);
        const cap = campo.captura;
        if (cap?.columna && cap.fila) {
          mapa.set(`${sec.hoja}!${cap.columna}${cap.fila}`, crudo);
          continue;
        }
        indexarCeldasDeTabla(mapa, sec.hoja, campo, crudo, altoDeBloque);
      }
    }
  }
  return mapa;
}

/**
 * Reconstruye el mapa de celdas con debounce.
 * Indexar tablas grandes (Anexo 2) en cada tecla es caro; Excel-vivo puede ir ~300 ms detrás.
 */
export function useMapaValoresExcelDebounced(
  plantilla: Ref<Plantilla | null | undefined>,
  altoDeBloque: Ref<AltoDeBloque>,
  valorDe: Ref<ResolverValorCampo>,
  /** Señal que cambia cuando hay que reindexar (valores editados, tab, etc.). */
  trigger: Ref<unknown>,
  debounceMs = 300,
): ShallowRef<Map<string, string> | null> {
  const mapa = shallowRef<Map<string, string> | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let primera = true;

  function rebuild() {
    const p = plantilla.value;
    if (!p) {
      mapa.value = null;
      return;
    }
    mapa.value = construirMapaValoresPorCelda(p, altoDeBloque.value, valorDe.value);
  }

  function schedule(immediate: boolean) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (immediate || primera) {
      primera = false;
      rebuild();
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      rebuild();
    }, debounceMs);
  }

  watch(
    [plantilla, altoDeBloque, valorDe, trigger],
    (curr, prev) => {
      const plantillaCambio = !prev || curr[0]?.id !== prev[0]?.id;
      const altoCambio = !prev || curr[1] !== prev[1];
      schedule(plantillaCambio || altoCambio);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer);
  });

  return mapa;
}
