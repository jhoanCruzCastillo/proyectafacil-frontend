<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faXmark, faFolderOpen, faPlus, faFilePdf, faFileLines, faFileCode, faTrash,
  faInfoCircle, faWandMagicSparkles, faSpinner,
} from '@/lib/icons';
import ConfirmModal from '@/components/ConfirmModal.vue';
import {
  useFuenteVerdadQuery, useGuardarArchivoFuente, useEliminarArchivoFuente, useGuardarTextoFuente,
} from '@/composables/useFuenteVerdad';
import { useUiStore } from '@/stores/ui';
import type { ArchivoFuenteVerdad, Seccion } from '@/types';

const props = defineProps<{
  isOpen: boolean;
  ejemploId: string;
  /** Secciones de la plantilla para elegir cuáles llenar con IA */
  secciones?: Seccion[];
}>();

const emit = defineEmits<{
  close: [];
  'iniciar-llenado': [payload: { seccionIds: string[] }];
}>();

const ui = useUiStore();
const { data: fuente } = useFuenteVerdadQuery(() => props.ejemploId);
const guardarArchivo = useGuardarArchivoFuente();
const eliminarArchivo = useEliminarArchivoFuente();
const guardarTexto = useGuardarTextoFuente();

const archivos = computed(() => fuente.value?.archivos ?? []);
const texto = ref('');
let textoOriginal = '';
// Se rehidrata cada vez que llega un fuente nuevo del servidor (abrir el modal, o tras guardar).
watch(fuente, (f) => {
  texto.value = f?.textoAdicional ?? '';
  textoOriginal = f?.textoAdicional ?? '';
}, { immediate: true });

const seccionesDisponibles = computed(() => props.secciones ?? []);
const seccionIdsSeleccionados = ref<string[]>([]);

function seleccionarTodas() {
  seccionIdsSeleccionados.value = seccionesDisponibles.value.map((s) => s.id);
}

function quitarTodas() {
  seccionIdsSeleccionados.value = [];
}

function toggleSeccion(id: string) {
  const set = new Set(seccionIdsSeleccionados.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  seccionIdsSeleccionados.value = [...set];
}

const todasSeleccionadas = computed(
  () =>
    seccionesDisponibles.value.length > 0 &&
    seccionIdsSeleccionados.value.length === seccionesDisponibles.value.length,
);

// Al abrir el modal (o si cambia el catálogo), por defecto todas seleccionadas.
watch(
  () => [props.isOpen, seccionesDisponibles.value.map((s) => s.id).join('|')] as const,
  ([open]) => {
    if (open) seleccionarTodas();
  },
  { immediate: true },
);

const EXTENSIONES_PERMITIDAS = ['pdf', 'txt', 'md'];
const TAMANO_MAXIMO = 10 * 1024 * 1024;

const inputRef = ref<HTMLInputElement | null>(null);
const subiendo = ref(false);

function abrirSelector() {
  inputRef.value?.click();
}

function iconoDe(extension: string) {
  if (extension === 'pdf') return faFilePdf;
  if (extension === 'txt') return faFileLines;
  return faFileCode;
}
function colorDe(extension: string) {
  if (extension === 'pdf') return 'bg-red-100 text-red-600';
  if (extension === 'txt') return 'bg-blue-100 text-blue-600';
  return 'bg-gray-200 text-gray-600';
}
function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function handleArchivo(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!file) return;

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!EXTENSIONES_PERMITIDAS.includes(extension)) {
    ui.toast('Solo se admiten archivos PDF, TXT o MD', 'error');
    return;
  }
  if (file.size > TAMANO_MAXIMO) {
    ui.toast('El archivo supera los 10 MB permitidos', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    subiendo.value = true;
    try {
      await guardarArchivo.mutateAsync({ ejemploId: props.ejemploId, nombre: file.name, dataUrl: reader.result as string });
      ui.toast(`"${file.name}" agregado`);
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'No se pudo subir el archivo', 'error');
    } finally {
      subiendo.value = false;
    }
  };
  reader.onerror = () => ui.toast('No se pudo leer el archivo', 'error');
  reader.readAsDataURL(file);
}

const eliminarTarget = ref<ArchivoFuenteVerdad | null>(null);
async function confirmarEliminar() {
  if (!eliminarTarget.value) return;
  await eliminarArchivo.mutateAsync({ ejemploId: props.ejemploId, archivoId: eliminarTarget.value.id });
  eliminarTarget.value = null;
}

async function handleGuardarFuente() {
  if (texto.value !== textoOriginal) {
    await guardarTexto.mutateAsync({ ejemploId: props.ejemploId, texto: texto.value });
  }
  ui.toast('Fuente de la verdad guardada');
  emit('close');
}

const showConfirmLlenar = ref(false);
const hayFuente = computed(() => archivos.value.length > 0 || texto.value.trim() !== '');
const puedeLlenar = computed(
  () => hayFuente.value && seccionIdsSeleccionados.value.length > 0 && !guardarTexto.isPending.value,
);

const mensajeConfirmLlenar = computed(() => {
  const n = seccionIdsSeleccionados.value.length;
  const total = seccionesDisponibles.value.length;
  if (n >= total && total > 0) {
    return 'Esto BORRARÁ los valores actuales de todas las secciones seleccionadas y los volverá a llenar desde la fuente de la verdad. Puede tardar varios minutos. Esta acción no se puede deshacer.';
  }
  return `Se llenarán ${n} sección${n === 1 ? '' : 'es'} con IA. Solo se reemplazarán los campos de esas secciones; el resto de la ficha se conserva. Puede tardar unos minutos.`;
});

async function handleLlenarFicha() {
  showConfirmLlenar.value = false;
  if (seccionIdsSeleccionados.value.length === 0) {
    ui.toast('Selecciona al menos una sección', 'error');
    return;
  }
  // Guarda el texto adicional pendiente para que la IA lo tenga en la misma corrida.
  if (texto.value !== textoOriginal) {
    try {
      await guardarTexto.mutateAsync({ ejemploId: props.ejemploId, texto: texto.value });
      textoOriginal = texto.value;
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'No se pudo guardar el texto adicional', 'error');
      return;
    }
  }
  emit('iniciar-llenado', { seccionIds: [...seccionIdsSeleccionados.value] });
  emit('close');
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto" @click.stop>
          <div class="flex items-start justify-between p-6 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faFolderOpen" class="w-4 h-4" />
              </div>
              <div>
                <h2 class="text-lg font-bold text-heading flex items-center gap-2">
                  Fuente de la verdad
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-600 tracking-wide">BETA</span>
                </h2>
                <p class="text-sm text-muted">Documentos y textos que contienen la información base del proyecto. Esta información será usada por la IA como contexto principal.</p>
              </div>
            </div>
            <button @click="emit('close')" type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100 shrink-0">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <div class="px-6 pb-6 space-y-5">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-bold text-heading">Archivos cargados</span>
                <span class="text-xs text-muted">Máx. 10 MB por archivo</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div
                  v-for="a in archivos"
                  :key="a.id"
                  class="relative group rounded-xl border border-gray-200 p-3 flex flex-col items-start gap-2"
                >
                  <span class="w-8 h-8 rounded-lg flex items-center justify-center" :class="colorDe(a.extension)">
                    <FontAwesomeIcon :icon="iconoDe(a.extension)" class="w-3.5 h-3.5" />
                  </span>
                  <div class="min-w-0 w-full">
                    <p class="text-xs font-medium text-heading truncate" :title="a.nombre">{{ a.nombre }}</p>
                    <p class="text-[11px] text-muted">{{ formatoTamano(a.tamanoBytes) }}</p>
                  </div>
                  <button
                    @click="eliminarTarget = a"
                    type="button"
                    title="Eliminar"
                    class="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-colors duration-75"
                  >
                    <FontAwesomeIcon :icon="faTrash" class="w-3 h-3" />
                  </button>
                </div>

                <button
                  @click="abrirSelector"
                  :disabled="subiendo"
                  type="button"
                  class="rounded-xl border border-dashed border-gray-300 p-3 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50/40 transition-colors duration-75 disabled:opacity-50 min-h-[86px]"
                >
                  <FontAwesomeIcon :icon="subiendo ? faSpinner : faPlus" class="w-4 h-4" :class="{ 'animate-spin': subiendo }" />
                  <span class="text-[11px] font-medium">{{ subiendo ? 'Subiendo…' : 'Agregar archivo' }}</span>
                  <span v-if="!subiendo" class="text-[10px] text-gray-300">PDF, TXT o MD</span>
                </button>
                <input ref="inputRef" type="file" accept=".pdf,.txt,.md" class="hidden" @change="handleArchivo" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-bold text-heading mb-2">Texto adicional <span class="text-muted font-normal">(opcional)</span></label>
              <textarea
                v-model="texto"
                maxlength="5000"
                rows="3"
                placeholder="Escribe información adicional que la IA debe considerar sobre el proyecto..."
                class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <p class="text-right text-[11px] text-muted mt-1">{{ texto.length }} / 5000</p>
            </div>

            <div v-if="seccionesDisponibles.length > 0">
              <div class="flex items-center justify-between gap-2 mb-2">
                <span class="text-sm font-bold text-heading">Secciones a llenar con IA</span>
                <div class="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    class="font-medium text-violet-600 hover:text-violet-800"
                    @click="seleccionarTodas"
                  >
                    Todas
                  </button>
                  <span class="text-gray-300">|</span>
                  <button
                    type="button"
                    class="font-medium text-gray-500 hover:text-gray-700"
                    @click="quitarTodas"
                  >
                    Ninguna
                  </button>
                </div>
              </div>
              <p class="text-xs text-muted mb-2">
                Elige qué secciones autocompletar. Por defecto están todas; desmarcar acorta el tiempo de espera.
                <span class="font-medium text-heading">
                  {{ seccionIdsSeleccionados.length }}/{{ seccionesDisponibles.length }} seleccionadas
                </span>
              </p>
              <div class="rounded-xl border border-gray-200 max-h-48 overflow-y-auto divide-y divide-gray-50">
                <label
                  v-for="s in seccionesDisponibles"
                  :key="s.id"
                  class="flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50/80 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    class="mt-0.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    :checked="seccionIdsSeleccionados.includes(s.id)"
                    @change="toggleSeccion(s.id)"
                  >
                  <span class="min-w-0">
                    <span class="text-[11px] font-mono text-muted">{{ s.numero }}</span>
                    <span class="block text-sm text-heading leading-snug">{{ s.nombre }}</span>
                  </span>
                </label>
              </div>
            </div>

            <div class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-xs">
              <FontAwesomeIcon :icon="faInfoCircle" class="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Esta fuente de información se utilizará como contexto principal para las secciones que elijas llenar.</span>
            </div>

            <div class="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-bold text-heading flex items-center gap-2 flex-wrap">
                    <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3.5 h-3.5 text-violet-600" />
                    Llenar con IA
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-200 text-violet-700 tracking-wide">BETA</span>
                  </p>
                  <p class="text-xs text-muted mt-1">
                    <template v-if="todasSeleccionadas">La IA completará todas las secciones de la ficha técnica.</template>
                    <template v-else-if="seccionIdsSeleccionados.length === 0">Selecciona al menos una sección para continuar.</template>
                    <template v-else>
                      La IA completará {{ seccionIdsSeleccionados.length }} sección{{ seccionIdsSeleccionados.length === 1 ? '' : 'es' }} seleccionada{{ seccionIdsSeleccionados.length === 1 ? '' : 's' }}.
                    </template>
                  </p>
                </div>
                <button
                  @click="showConfirmLlenar = true"
                  :disabled="!puedeLlenar"
                  type="button"
                  class="shrink-0 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-75 flex items-center gap-2"
                >
                  <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3.5 h-3.5" />
                  {{ todasSeleccionadas ? 'Llenar toda la ficha' : 'Llenar selección' }}
                </button>
              </div>
            </div>

            <div class="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
              <button @click="emit('close')" type="button" class="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75">
                Cerrar
              </button>
              <button
                @click="handleGuardarFuente"
                :disabled="guardarTexto.isPending.value"
                type="button"
                class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition-colors duration-75"
              >
                Guardar fuente
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>

  <ConfirmModal
    :is-open="!!eliminarTarget"
    title="Eliminar archivo"
    :message="`¿Seguro que deseas eliminar &quot;${eliminarTarget?.nombre}&quot; de la fuente de la verdad?`"
    confirm-label="Eliminar"
    @confirm="confirmarEliminar"
    @close="eliminarTarget = null"
  />

  <ConfirmModal
    :is-open="showConfirmLlenar"
    title="Llenar con IA"
    :message="mensajeConfirmLlenar"
    confirm-label="Llenar"
    @confirm="handleLlenarFicha"
    @close="showConfirmLlenar = false"
  />
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
  transform: scale(0.97) translateY(10px);
}
</style>
