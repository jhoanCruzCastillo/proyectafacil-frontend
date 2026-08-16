<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faFileExcel, faDownload, faSpinner } from '@/lib/icons';
import ExcelViewer from '@/components/ExcelViewer.vue';
import {
  descargarArchivoUrl,
  formatearBytes,
  formatearEta,
  formatearVelocidad,
  type DescargaProgreso,
} from '@/lib/fetchBinario';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{
  isOpen: boolean;
  fileUrl: string | null;
  fileName?: string;
  title: string;
}>();

const emit = defineEmits<{ close: [] }>();
const ui = useUiStore();

const descargando = ref(false);
const progreso = ref<DescargaProgreso | null>(null);

const etiquetaProgreso = computed(() => {
  const p = progreso.value;
  if (!p) return '';
  const pct = p.percent != null ? `${p.percent}%` : formatearBytes(p.loaded);
  const vel = p.speedBps > 0 ? formatearVelocidad(p.speedBps) : '…';
  const eta = p.percent != null && p.percent < 100 ? ` · queda ~${formatearEta(p.etaSeconds)}` : '';
  const tam =
    p.total != null ? `${formatearBytes(p.loaded)} / ${formatearBytes(p.total)}` : formatearBytes(p.loaded);
  return `${pct} · ${tam} · ${vel}${eta}`;
});

async function handleDownload() {
  if (!props.fileUrl || descargando.value) return;
  descargando.value = true;
  progreso.value = { percent: 0, loaded: 0, total: null, speedBps: 0, etaSeconds: null };
  try {
    await descargarArchivoUrl(props.fileUrl, props.fileName || 'archivo.xlsx', (p) => {
      progreso.value = p;
    });
  } catch {
    ui.toast('No se pudo descargar el Excel', 'error');
  } finally {
    descargando.value = false;
    progreso.value = null;
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-[95vw] h-[95vh] flex flex-col overflow-hidden" @click.stop>
          <div class="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faFileExcel" class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <h2 class="text-base font-bold text-heading truncate">{{ title }}</h2>
                <p class="text-xs text-muted">{{ fileUrl ? 'Previsualización — solo lectura' : 'Sin Excel asignado' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3 shrink-0 min-w-0">
              <div v-if="descargando && progreso" class="hidden sm:flex flex-col gap-1 w-56 max-w-[40vw]">
                <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    class="h-full bg-brand-600 rounded-full transition-[width] duration-150 ease-out"
                    :style="{ width: `${progreso.percent ?? Math.min(95, 10 + (progreso.loaded / 1e6) * 5)}%` }"
                  />
                </div>
                <p class="text-[10px] text-muted truncate tabular-nums">{{ etiquetaProgreso }}</p>
              </div>
              <button
                v-if="fileUrl"
                type="button"
                :disabled="descargando"
                @click="handleDownload"
                class="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors duration-75 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon :icon="descargando ? faSpinner : faDownload" class="w-3.5 h-3.5" :class="{ 'animate-spin': descargando }" />
                {{ descargando ? 'Descargando…' : 'Descargar' }}
              </button>
              <button
                @click="emit('close')"
                type="button"
                class="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100"
                title="Cerrar"
              >
                <FontAwesomeIcon :icon="faXmark" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div class="flex-1 min-h-0">
            <ExcelViewer :file-url="fileUrl" />
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.pop-enter-active,
.pop-leave-active {
  transition: all 0.12s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.98) translateY(10px);
}
</style>
