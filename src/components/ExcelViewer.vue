<script setup lang="ts">
import { nextTick, ref, shallowRef, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faSpinner, faFileExcel, faTriangleExclamation } from '@/lib/icons';

// Visor de Excel de solo lectura (Luckysheet). Reutilizado por ExcelCatalogModal y (más adelante)
// por ExcelPreviewModal — cambia de archivo cuando cambia `fileUrl`.
const props = withDefaults(
  defineProps<{
    fileUrl: string | null;
    emptyMessage?: string;
    /** Si false (catálogo de plantilla), no menciona "el botón de arriba" — ahí no hay descarga en el header del visor. */
    sugerirDescargaArriba?: boolean;
  }>(),
  { emptyMessage: 'Ningún archivo asignado', sugerirDescargaArriba: true },
);

const VENDOR = '/vendor/luckysheet';
const CSS_FILES = [
  `${VENDOR}/plugins/css/pluginsCss.css`,
  `${VENDOR}/plugins/plugins.css`,
  `${VENDOR}/css/luckysheet.css`,
  `${VENDOR}/assets/iconfont/iconfont.css`,
];
const JS_FILES = [`${VENDOR}/plugins/js/plugin.js`, `${VENDOR}/luckysheet.umd.js`];

function loadAsset(url: string, kind: 'css' | 'js'): Promise<void> {
  return new Promise((resolve, reject) => {
    const selector = kind === 'css' ? `link[href="${url}"]` : `script[src="${url}"]`;
    if (document.querySelector(selector)) return resolve();
    const el = kind === 'css' ? document.createElement('link') : document.createElement('script');
    if (el instanceof HTMLLinkElement) {
      el.rel = 'stylesheet';
      el.href = url;
    } else {
      el.src = url;
    }
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
    document.head.appendChild(el);
  });
}

interface HojaLucky {
  celldata?: { r: number; c: number }[];
  row?: number;
  column?: number;
  config?: { merge?: Record<string, { r?: number; c?: number; rs?: number; cs?: number }>; columnlen?: Record<string, unknown>; rowlen?: Record<string, unknown> };
}

// El Excel real declara su grilla (row/column) mucho más grande que su contenido real — es
// habitual que una plantilla oficial aplique formato/bordes a columnas o filas enteras "por si
// acaso", lo que en el XML de Excel infla la dimensión declarada de la hoja sin agregar celdas
// reales. Luckysheet calcula el ancho de CADA columna declarada al crear el libro (autofit), así
// que una hoja que dice "columna 404" cuando el contenido real llega hasta la 30 le hace medir
// ~370 columnas vacías de más — multiplicado por hoja, esto es lo que cuelga el navegador con
// libros grandes (ver caso real: 1_FORMATO_FTE_EBR_MINEDU_2.xlsx, ~8MB). Acotar row/column al
// rango realmente usado (celdas + fusiones + anchos/altos explícitos, con margen) no pierde
// ningún dato — nunca hay celdas con contenido más allá de ese rango — y reduce ese trabajo a
// una fracción.
function limitarDimensiones(sheet: HojaLucky): void {
  let maxFila = 0;
  let maxCol = 0;
  for (const c of sheet.celldata ?? []) {
    if (c.r > maxFila) maxFila = c.r;
    if (c.c > maxCol) maxCol = c.c;
  }
  for (const m of Object.values(sheet.config?.merge ?? {})) {
    maxFila = Math.max(maxFila, (m.r ?? 0) + (m.rs ?? 1) - 1);
    maxCol = Math.max(maxCol, (m.c ?? 0) + (m.cs ?? 1) - 1);
  }
  for (const idx of Object.keys(sheet.config?.rowlen ?? {})) maxFila = Math.max(maxFila, Number(idx));
  for (const idx of Object.keys(sheet.config?.columnlen ?? {})) maxCol = Math.max(maxCol, Number(idx));

  const MARGEN = 5;
  sheet.row = Math.max(Math.min(sheet.row ?? 0, maxFila + MARGEN + 1), 20);
  sheet.column = Math.max(Math.min(sheet.column ?? 0, maxCol + MARGEN + 1), 10);
}

const status = ref<'loading' | 'ready' | 'error'>('loading');
const errorMsg = ref('');
const reloadKey = ref(0);
const sheetsRef = shallowRef<unknown[] | null>(null);
// Fase visible del `loading`: 'descargando' tiene porcentaje real (bytes del archivo, la parte que
// de verdad pesa en libros grandes); 'procesando' es la conversión LuckyExcel + el primer render de
// Luckysheet — ninguna de las dos expone progreso, así que ahí solo se muestra un spinner.
const fase = ref<'descargando' | 'procesando'>('descargando');
const progresoDescarga = ref<number | null>(null);
// Aviso de "esto está tardando" — no depende de conocer el tamaño del archivo, solo de un reloj:
// si a los 15s seguimos en loading, se asume que el archivo es pesado y conviene ofrecer la
// alternativa de descargar y abrir en Excel de escritorio en vez de seguir esperando a ciegas.
const tardandoMucho = ref(false);
let timeoutTardando: ReturnType<typeof setTimeout> | null = null;
// Mismo patrón que la carga inicial, pero para el cambio de hoja (watcher de montaje más abajo):
// ese también puede tardar varios segundos en libros grandes, y hasta ahora no mostraba nada propio
// mientras tanto — solo el spinner interno de Luckysheet.
const cambiandoHoja = ref(false);
const tardandoHoja = ref(false);
let timeoutTardandoHoja: ReturnType<typeof setTimeout> | null = null;
let pollLoadingNativo: ReturnType<typeof setInterval> | null = null;

async function descargarConProgreso(url: string): Promise<ArrayBuffer> {
  const { fetchBinario } = await import('@/lib/fetchBinario');
  const res = await fetchBinario(url);
  if (!res.ok) throw new Error(`No se pudo cargar el archivo (${res.status})`);
  const total = Number(res.headers.get('content-length') ?? 0);
  if (!total || !res.body) return res.arrayBuffer(); // sin Content-Length no hay % real posible

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let recibido = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    recibido += value.length;
    progresoDescarga.value = Math.min(100, Math.round((recibido / total) * 100));
  }
  const buffer = new Uint8Array(recibido);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  return buffer.buffer;
}
// Índice de la hoja que se le pasa a Luckysheet. Solo esa se crea/renderiza — ver el comentario
// del watcher de montaje, más abajo, para el porqué.
const sheetActivoIdx = ref(0);
const nombresHojas = shallowRef<string[]>([]);

watch(
  [() => props.fileUrl, reloadKey],
  async ([fileUrl], _old, onCleanup) => {
    if (!fileUrl) return;
    let disposed = false;
    onCleanup(() => {
      disposed = true;
      if (timeoutTardando) clearTimeout(timeoutTardando);
    });
    sheetsRef.value = null;
    fase.value = 'descargando';
    progresoDescarga.value = null;
    tardandoMucho.value = false;
    timeoutTardando = setTimeout(() => { if (!disposed) tardandoMucho.value = true; }, 15000);
    try {
      status.value = 'loading';
      await Promise.all(CSS_FILES.map((u) => loadAsset(u, 'css')));
      for (const js of JS_FILES) await loadAsset(js, 'js'); // plugin.js debe ir antes del umd
      const [{ default: LuckyExcel }, buffer] = await Promise.all([import('luckyexcel'), descargarConProgreso(fileUrl)]);
      if (disposed) return;
      fase.value = 'procesando';
      // Algunos libros completamente vacíos hacen que transformExcelToLucky nunca invoque
      // ni resolve ni reject (cuelga la conversión) — con un plazo, si no responde a tiempo
      // se asume que el libro está vacío y se muestra una hoja en blanco igualmente.
      const conversion = new Promise<{ sheets?: unknown[] } | null>((resolve, reject) =>
        LuckyExcel.transformExcelToLucky(buffer, resolve, reject),
      );
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
      const json = await Promise.race([conversion, timeout]);
      const todasLasHojas = json?.sheets ?? [];
      // Omitir hojas sin celdas (p. ej. la portada "MENÚ" del 6A) — salvo que el libro esté
      // completamente vacío (o la conversión no haya respondido), en cuyo caso se muestra
      // una hoja en blanco en vez de un error.
      const conCeldas = todasLasHojas.filter((s) => ((s as { celldata?: unknown[] }).celldata?.length ?? 0) > 0);
      const sheets = conCeldas.length > 0
        ? conCeldas
        : todasLasHojas.length > 0
          ? todasLasHojas
          : [{ name: 'Hoja1', celldata: [], row: 36, column: 18, status: 1, order: 0, config: {} }];
      sheets.forEach((s) => limitarDimensiones(s as HojaLucky));
      if (!disposed) {
        sheetsRef.value = sheets;
        nombresHojas.value = sheets.map((s, i) => (s as { name?: string }).name || `Hoja ${i + 1}`);
        sheetActivoIdx.value = 0;
        status.value = 'ready';
      }
    } catch (e) {
      if (!disposed) {
        errorMsg.value = e instanceof Error ? e.message : 'Error al leer el archivo';
        status.value = 'error';
      }
    } finally {
      if (timeoutTardando) clearTimeout(timeoutTardando);
    }
  },
  { immediate: true },
);

// Montar Luckysheet cuando los datos están listos; destruir al desmontar/cambiar.
//
// SOLO se le pasa la hoja activa (`sheetActivoIdx`), nunca el libro completo. Luckysheet calcula
// el layout (anchos de columna, fusiones, formato) de TODAS las hojas que recibe en `create()` de
// una sola vez, de forma síncrona — con un libro de varias hojas grandes (caso real:
// 1_FORMATO_FTE_EBR_MINEDU_2.xlsx, ~8MB, más de 10 hojas) eso bloquea el hilo principal el tiempo
// suficiente para colgar la pestaña, incluso después de acotar las dimensiones de cada hoja
// (`limitarDimensiones`). Mostrar una hoja a la vez reduce ese trabajo a una fracción — el propio
// selector de hojas de abajo reemplaza a la barra de hojas nativa de Luckysheet (deshabilitada con
// `showsheetbar: false`) y recrea el libro con la hoja elegida al cambiar.
watch(
  [() => props.fileUrl, status, sheetActivoIdx],
  async ([fileUrl, st, idx], _old, onCleanup) => {
    const hoja = sheetsRef.value?.[idx];
    if (!fileUrl || st !== 'ready' || !hoja) return;
    let disposed = false;
    onCleanup(() => {
      disposed = true;
      if (timeoutTardandoHoja) clearTimeout(timeoutTardandoHoja);
      if (pollLoadingNativo) clearInterval(pollLoadingNativo);
      try { window.luckysheet?.destroy(); } catch { /* ya destruido */ }
    });
    // `luckysheet.create()` en sí vuelve rápido, pero deja trabajo pendiente async (layout/pintado) —
    // por eso el "Cargando..." propio de Luckysheet seguía viéndose después de que create() retornaba.
    // `workbookCreateAfter` es un hook real de la librería (confirmado en el propio bundle vendorizado)
    // que dispara cuando ESE trabajo async termina de verdad, así que nuestro overlay se cierra
    // cuando corresponde en vez de a ciegas. Antes de llamar a create(), se espera un frame para que
    // "Cambiando de hoja..." alcance a pintarse — si no, Vue programa la actualización pero el
    // navegador nunca llega a pintarla antes de que arranque el trabajo pesado.
    cambiandoHoja.value = true;
    tardandoHoja.value = false;
    timeoutTardandoHoja = setTimeout(() => { if (!disposed) tardandoHoja.value = true; }, 15000);
    await nextTick();
    await new Promise((r) => requestAnimationFrame(r));
    if (disposed) return;
    const hojaParaMostrar = { ...(hoja as object), status: 1, order: 0 };
    window.luckysheet?.create({
      container: 'excel-viewer-container',
      data: JSON.parse(JSON.stringify([hojaParaMostrar])), // luckysheet muta los datos
      lang: 'es',
      allowEdit: false,
      showtoolbar: false,
      showinfobar: false,
      showstatisticBar: false,
      sheetFormulaBar: false,
      enableAddRow: false,
      enableAddBackTop: false,
      showsheetbar: false,
      cellRightClickConfig: {
        copy: true, copyAs: false, paste: false, insertRow: false, insertColumn: false,
        deleteRow: false, deleteColumn: false, deleteCell: false, hideRow: false,
        hideColumn: false, rowHeight: false, columnWidth: false, clear: false,
        matrix: false, sort: false, filter: false, chart: false, image: false,
        link: false, data: false, cellFormat: false,
      },
      // `workbookCreateAfter` puede disparar antes de que el propio indicador de carga de
      // Luckysheet (`#luckysheetloadingdata`) se oculte — en hojas pesadas se ha visto ese hook
      // llegar mientras el spinner nativo de la librería sigue en pantalla. Si cerráramos nuestro
      // overlay ahí mismo, dejaríamos expuesto un instante ese "Cargando..." nativo (sin nuestro
      // mensaje ni la opción de descargar) mientras Luckysheet termina su propio trabajo interno.
      // Por eso se espera a que ese indicador realmente desaparezca antes de cerrar el propio.
      workbookCreateAfter: () => {
        if (timeoutTardandoHoja) clearTimeout(timeoutTardandoHoja);
        if (pollLoadingNativo) clearInterval(pollLoadingNativo);
        const nativoListo = () => {
          const el = document.getElementById('luckysheetloadingdata');
          return !el || getComputedStyle(el).display === 'none';
        };
        if (nativoListo()) {
          if (!disposed) cambiandoHoja.value = false;
          return;
        }
        pollLoadingNativo = setInterval(() => {
          if (disposed || nativoListo()) {
            if (pollLoadingNativo) clearInterval(pollLoadingNativo);
            if (!disposed) cambiandoHoja.value = false;
          }
        }, 300);
      },
    });
  },
);

function handleRetry() {
  sheetsRef.value = null;
  errorMsg.value = '';
  reloadKey.value += 1;
}
</script>

<template>
  <div v-if="!fileUrl" class="h-full flex flex-col items-center justify-center gap-2 text-muted">
    <FontAwesomeIcon :icon="faFileExcel" class="w-8 h-8 text-gray-300" />
    <span class="text-sm">{{ emptyMessage }}</span>
  </div>
  <div v-else class="h-full min-h-0 flex flex-col">
    <div v-if="status === 'ready' && nombresHojas.length > 1" class="shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-gray-200 bg-gray-50/60 overflow-x-auto">
      <button
        v-for="(nombre, i) in nombresHojas"
        :key="i"
        @click="sheetActivoIdx = i"
        type="button"
        class="px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors duration-75"
        :class="i === sheetActivoIdx ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-200/70'"
      >
        {{ nombre }}
      </button>
    </div>
    <div class="relative flex-1 min-h-0">
      <div
        v-if="status === 'loading'"
        class="absolute inset-0 bg-white flex flex-col items-center justify-center gap-3 text-muted px-6"
        style="z-index: 2147483647"
      >
        <template v-if="fase === 'descargando' && progresoDescarga !== null">
          <div class="w-64 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div class="h-full bg-brand-600 rounded-full transition-[width] duration-150" :style="{ width: `${progresoDescarga}%` }" />
          </div>
          <span class="text-sm">Descargando archivo... {{ progresoDescarga }}%</span>
        </template>
        <template v-else>
          <FontAwesomeIcon :icon="faSpinner" class="w-6 h-6 animate-spin text-brand-600" />
          <span class="text-sm">{{ fase === 'descargando' ? 'Descargando archivo...' : 'Procesando archivo...' }}</span>
        </template>
        <div v-if="tardandoMucho" class="mt-2 max-w-sm flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-left">
          <FontAwesomeIcon :icon="faTriangleExclamation" class="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p class="text-xs text-amber-800">
            <template v-if="sugerirDescargaArriba">
              Esto está tardando más de lo esperado — el archivo parece pesado. Si prefieres no esperar, descárgalo con el botón de arriba y ábrelo con Excel de escritorio.
            </template>
            <template v-else>
              Esto está tardando más de lo esperado — el archivo parece pesado. Puedes esperar o descargarlo desde la lista de la izquierda y abrirlo con Excel de escritorio.
            </template>
          </p>
        </div>
      </div>
      <div
        v-if="cambiandoHoja"
        class="absolute inset-0 bg-white flex flex-col items-center justify-center gap-3 text-muted px-6"
        style="z-index: 2147483647"
      >
        <FontAwesomeIcon :icon="faSpinner" class="w-6 h-6 animate-spin text-brand-600" />
        <span class="text-sm">Cambiando de hoja...</span>
        <div v-if="tardandoHoja" class="mt-2 max-w-sm flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-left">
          <FontAwesomeIcon :icon="faTriangleExclamation" class="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p class="text-xs text-amber-800">
            <template v-if="sugerirDescargaArriba">
              Esto está tardando más de lo esperado — esta hoja parece pesada. Si prefieres no esperar, descarga el archivo con el botón de arriba y ábrelo con Excel de escritorio.
            </template>
            <template v-else>
              Esto está tardando más de lo esperado — esta hoja parece pesada. Puedes esperar o descargarlo desde la lista de la izquierda y abrirlo con Excel de escritorio.
            </template>
          </p>
        </div>
      </div>
      <div v-if="status === 'error'" class="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <span class="text-sm text-red-600 px-6 text-center">{{ errorMsg }}</span>
        <button @click="handleRetry" type="button" class="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75">
          Reintentar
        </button>
      </div>
      <div id="excel-viewer-container" class="absolute inset-0" />
    </div>
  </div>
</template>
