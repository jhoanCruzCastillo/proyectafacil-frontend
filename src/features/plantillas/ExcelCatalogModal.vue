<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faFileExcel, faFileImport, faTrash, faCheck, faSpinner, faDownload } from '@/lib/icons';
import ExcelViewer from '@/components/ExcelViewer.vue';
import { useCatalogoExcelQuery, useAgregarArchivoExcel, useEliminarArchivoExcel, useAsignarArchivoExcel } from '@/composables/useArchivosExcel';
import { descargarArchivoUrl } from '@/lib/fetchBinario';
import { useUiStore } from '@/stores/ui';
import type { ArchivoExcel, Plantilla } from '@/types';

const props = defineProps<{
  isOpen: boolean;
  plantilla: Plantilla;
}>();

const emit = defineEmits<{ close: [] }>();

const ui = useUiStore();
const plantillaId = computed(() => props.plantilla.id);
const { data: catalogo } = useCatalogoExcelQuery(plantillaId);
const agregarArchivo = useAgregarArchivoExcel();
const eliminarArchivo = useEliminarArchivoExcel();
const asignarArchivo = useAsignarArchivoExcel();

const archivos = computed(() => catalogo.value?.archivos ?? []);
const asignadoId = computed(() => catalogo.value?.asignadoId);
const asignado = computed(() => archivos.value.find((a) => a.id === asignadoId.value) ?? null);

const inputRef = ref<HTMLInputElement | null>(null);
/** null = idle; 0–100 = subiendo (barra funcional). */
const uploadProgress = ref<number | null>(null);
const uploadLabel = ref('');
const subiendo = computed(() => uploadProgress.value != null);

function setProgress(pct: number, label: string) {
  uploadProgress.value = Math.min(100, Math.max(0, Math.round(pct)));
  uploadLabel.value = label;
}

async function handleImport(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || subiendo.value) return;

  setProgress(0, 'Subiendo al servidor…');

  try {
    await agregarArchivo.mutateAsync({
      plantillaId: plantillaId.value,
      file,
      onProgress: (fraction, label) => {
        const pct = fraction >= 1 ? 90 : fraction * 90;
        setProgress(pct, label || 'Subiendo al servidor…');
      },
    });
    setProgress(100, 'Listo');
    ui.toast(`Archivo "${file.name}" agregado al catálogo`);
    await new Promise((r) => setTimeout(r, 350));
  } catch (err) {
    ui.toast(err instanceof Error ? err.message : 'No se pudo subir el Excel', 'error');
  } finally {
    uploadProgress.value = null;
    uploadLabel.value = '';
  }
}

function handleClose() {
  if (subiendo.value) return;
  emit('close');
}

async function handleDownload(archivo: ArchivoExcel) {
  try {
    await descargarArchivoUrl(archivo.dataUrl, archivo.nombre);
  } catch {
    ui.toast('No se pudo descargar el Excel', 'error');
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click="handleClose">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-[95vw] h-[95vh] flex flex-col overflow-hidden" @click.stop>
          <div class="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faFileExcel" class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <h2 class="text-base font-bold text-heading truncate">Excel — {{ plantilla.codigo }} · {{ plantilla.nombre }}</h2>
                <p class="text-xs text-muted">Gestiona el catálogo de archivos Excel de referencia de esta plantilla</p>
              </div>
            </div>
            <button
              @click="handleClose"
              type="button"
              :disabled="subiendo"
              class="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Cerrar"
            >
              <FontAwesomeIcon :icon="faXmark" class="w-4 h-4" />
            </button>
          </div>

          <div class="flex-1 min-h-0 flex">
            <div class="w-80 shrink-0 border-r border-gray-100 flex flex-col">
              <div class="p-4 border-b border-gray-100 space-y-3">
                <input ref="inputRef" type="file" accept=".xlsx,.xls,.xlsm" class="hidden" @change="handleImport" />
                <button
                  @click="inputRef?.click()"
                  type="button"
                  :disabled="subiendo"
                  class="w-full py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors duration-75 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <FontAwesomeIcon :icon="subiendo ? faSpinner : faFileImport" class="w-3.5 h-3.5" :class="{ 'animate-spin': subiendo }" />
                  {{ subiendo ? 'Subiendo…' : 'Importar Excel' }}
                </button>

                <div v-if="uploadProgress != null" class="rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2.5">
                  <div class="h-2 rounded-full bg-white overflow-hidden border border-brand-100">
                    <div
                      class="h-full bg-brand-600 rounded-full transition-[width] duration-150 ease-out"
                      :style="{ width: `${uploadProgress}%` }"
                    />
                  </div>
                  <div class="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-brand-800">
                    <span class="truncate">{{ uploadLabel || 'Procesando…' }}</span>
                    <span class="shrink-0 font-semibold tabular-nums">{{ uploadProgress }}%</span>
                  </div>
                </div>
              </div>
              <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
                <p v-if="archivos.length === 0" class="text-xs text-muted text-center px-4 py-6">
                  Aún no hay archivos Excel en el catálogo de esta plantilla.
                </p>
                <div
                  v-for="archivo in archivos"
                  :key="archivo.id"
                  @click="!subiendo && asignarArchivo.mutate({ plantillaId, archivoId: archivo.id })"
                  class="group flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors duration-75"
                  :class="[
                    archivo.id === asignadoId ? 'border-brand-300 bg-brand-50' : 'border-gray-200 hover:bg-gray-50',
                    subiendo ? 'opacity-60 pointer-events-none' : '',
                  ]"
                >
                  <div class="w-6 h-6 rounded-md flex items-center justify-center shrink-0" :class="archivo.id === asignadoId ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-400'">
                    <FontAwesomeIcon :icon="archivo.id === asignadoId ? faCheck : faFileExcel" class="w-3 h-3" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-medium text-heading truncate">{{ archivo.nombre }}</div>
                    <div class="text-[10px] text-muted">{{ archivo.id === asignadoId ? 'Asignado · ' : '' }}{{ archivo.fechaSubida }}</div>
                  </div>
                  <div class="flex items-center gap-0.5 shrink-0">
                    <button
                      @click.stop="handleDownload(archivo)"
                      type="button"
                      :disabled="subiendo"
                      class="w-6 h-6 rounded flex items-center justify-center text-gray-300 opacity-0 group-hover:opacity-100 hover:text-brand-600 transition-opacity disabled:opacity-0"
                      title="Descargar Excel"
                    >
                      <FontAwesomeIcon :icon="faDownload" class="w-3 h-3" />
                    </button>
                    <button
                      @click.stop="eliminarArchivo.mutate({ plantillaId, archivoId: archivo.id })"
                      type="button"
                      :disabled="subiendo"
                      class="w-6 h-6 rounded flex items-center justify-center text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity disabled:opacity-0"
                      title="Eliminar del catálogo"
                    >
                      <FontAwesomeIcon :icon="faTrash" class="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <ExcelViewer
                :file-url="asignado?.dataUrl ?? null"
                :sugerir-descarga-arriba="false"
                empty-message="Importa o selecciona un archivo del catálogo para previsualizarlo"
              />
            </div>
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
