import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue';

/** Por debajo de este tamaño el costo de montar todo es bajo: no virtualizamos. */
export const VIRTUAL_ROW_THRESHOLD = 40;

/** Altura estimada por fila (px). Las textareas pueden crecer; es un compromiso para el spacer. */
export const VIRTUAL_ROW_HEIGHT_PX = 40;

/** Filas extra arriba/abajo del viewport para que el scroll no “parpadee”. */
export const VIRTUAL_OVERSCAN = 10;

/** Alto máximo del contenedor con scroll (px). */
export const VIRTUAL_VIEWPORT_MAX_PX = 420;

export interface VirtualRowWindow {
  /** Índice absoluto en el array de datos */
  ri: number;
}

/**
 * Ventana virtual sobre una lista indexada (p. ej. filas de tabla).
 * Si `count <= threshold`, expone todas las filas sin spacers.
 */
export function useVirtualRowWindow(count: Ref<number>) {
  const scrollEl = ref<HTMLElement | null>(null);
  const scrollTop = ref(0);
  const viewportHeight = ref(VIRTUAL_VIEWPORT_MAX_PX);

  const activo = computed(() => count.value > VIRTUAL_ROW_THRESHOLD);

  let raf = 0;
  function onScroll() {
    if (!activo.value || !scrollEl.value) return;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!scrollEl.value) return;
      scrollTop.value = scrollEl.value.scrollTop;
      viewportHeight.value = scrollEl.value.clientHeight || VIRTUAL_VIEWPORT_MAX_PX;
    });
  }

  onBeforeUnmount(() => {
    if (raf) cancelAnimationFrame(raf);
  });

  // Si deja de estar activo (p. ej. borraron filas), resetea el scroll state.
  watch(activo, (on) => {
    if (!on) {
      scrollTop.value = 0;
    }
  });

  const startIndex = computed(() => {
    if (!activo.value) return 0;
    return Math.max(0, Math.floor(scrollTop.value / VIRTUAL_ROW_HEIGHT_PX) - VIRTUAL_OVERSCAN);
  });

  const endIndex = computed(() => {
    if (!activo.value) return count.value;
    const visibles = Math.ceil(viewportHeight.value / VIRTUAL_ROW_HEIGHT_PX) + VIRTUAL_OVERSCAN * 2;
    return Math.min(count.value, startIndex.value + visibles);
  });

  const ventana = computed<VirtualRowWindow[]>(() => {
    const out: VirtualRowWindow[] = [];
    for (let ri = startIndex.value; ri < endIndex.value; ri++) {
      out.push({ ri });
    }
    return out;
  });

  const padTopPx = computed(() => (activo.value ? startIndex.value * VIRTUAL_ROW_HEIGHT_PX : 0));
  const padBottomPx = computed(() =>
    activo.value ? Math.max(0, (count.value - endIndex.value) * VIRTUAL_ROW_HEIGHT_PX) : 0,
  );

  async function scrollToIndex(ri: number) {
    await nextTick();
    const el = scrollEl.value;
    if (!el || !activo.value) return;
    const top = Math.max(0, ri * VIRTUAL_ROW_HEIGHT_PX - viewportHeight.value / 3);
    el.scrollTop = top;
    scrollTop.value = el.scrollTop;
  }

  return {
    scrollEl,
    activo,
    ventana,
    padTopPx,
    padBottomPx,
    onScroll,
    scrollToIndex,
    viewportMaxPx: VIRTUAL_VIEWPORT_MAX_PX,
  };
}
