<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faPaperclip, faFilePdf, faFileExcel, faFileWord, faFileLines, faSpinner, faTriangleExclamation, faXmark, faCloudArrowUp, faDownload } from '@/lib/icons';
import { subirArchivoCampo } from '@/api/archivosCampo';
import { descargarArchivoUrl } from '@/lib/fetchBinario';

// Editor de un campo/columna tipo `archivo`. El dato que viaja en el JSON es SIEMPRE una URL, nunca
// el binario — mismo criterio que CampoImagenInput.vue. A diferencia de las imágenes, el nombre
// original del archivo no tiene dónde guardarse aparte (el campo es un solo string), así que viaja
// codificado como `?n=` en la propia URL que devuelve el backend (ver CampoArchivosController) — se
// extrae acá para mostrarlo y para nombrar la descarga.
const props = withDefaults(defineProps<{ value: string; editable?: boolean; compacto?: boolean }>(), { editable: true });
const emit = defineEmits<{ change: [value: string] }>();

const EXTENSIONES_PERMITIDAS = ['pdf', 'xls', 'xlsx', 'doc', 'docx', 'txt'];

const subiendo = ref(false);
const error = ref('');
const arrastrando = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const tieneArchivo = computed(() => props.value.trim() !== '');

function nombreDe(url: string): string {
  try {
    const n = new URL(url, window.location.origin).searchParams.get('n');
    return n ?? 'Archivo';
  } catch {
    return 'Archivo';
  }
}
const nombreArchivo = computed(() => nombreDe(props.value));

function extensionDe(nombre: string): string {
  return (nombre.split('.').pop() ?? '').toLowerCase();
}
function iconoDe(nombre: string) {
  const ext = extensionDe(nombre);
  if (ext === 'pdf') return faFilePdf;
  if (ext === 'xls' || ext === 'xlsx') return faFileExcel;
  if (ext === 'doc' || ext === 'docx') return faFileWord;
  if (ext === 'txt') return faFileLines;
  return faPaperclip;
}

function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

async function cargar(file: File) {
  const ext = extensionDe(file.name);
  if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
    error.value = 'Solo se admiten archivos PDF, Excel, Word o TXT.';
    return;
  }
  error.value = '';
  subiendo.value = true;
  try {
    const dataUrl = await leerComoDataUrl(file);
    const { url } = await subirArchivoCampo(dataUrl, file.name);
    emit('change', url);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo subir el archivo.';
  } finally {
    subiendo.value = false;
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  arrastrando.value = false;
  if (!props.editable || subiendo.value) return;
  const file = e.dataTransfer?.files?.[0];
  if (file) cargar(file);
}

function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) cargar(file);
  input.value = '';
}

function descargar() {
  if (!tieneArchivo.value) return;
  void descargarArchivoUrl(props.value, nombreArchivo.value);
}

function quitar() {
  emit('change', '');
}
</script>

<template>
  <!-- Compacto: una sola línea de píldora + subir, para la celda de una tabla -->
  <div v-if="compacto" class="flex items-center gap-1 min-w-0">
    <button
      v-if="tieneArchivo"
      @click.stop="descargar"
      type="button"
      :title="`Descargar ${nombreArchivo}`"
      class="flex items-center gap-1 min-w-0 px-1.5 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-brand-50 hover:border-brand-200 text-[11px] text-heading transition-colors"
    >
      <FontAwesomeIcon :icon="iconoDe(nombreArchivo)" class="w-2.5 h-2.5 text-brand-600 shrink-0" />
      <span class="truncate max-w-[7rem]">{{ nombreArchivo }}</span>
    </button>
    <button
      v-if="tieneArchivo && editable"
      @click.stop="quitar"
      type="button"
      title="Quitar archivo"
      class="w-4 h-4 rounded flex items-center justify-center text-gray-300 hover:text-red-500 shrink-0"
    >
      <FontAwesomeIcon :icon="faXmark" class="w-2 h-2" />
    </button>
    <button
      v-if="!tieneArchivo && editable"
      @click.stop="fileInput?.click()"
      type="button"
      :disabled="subiendo"
      class="flex items-center gap-1 px-1.5 py-1 rounded border border-dashed border-gray-300 text-[11px] text-muted hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-60"
    >
      <FontAwesomeIcon :icon="subiendo ? faSpinner : faCloudArrowUp" class="w-2.5 h-2.5" :class="{ 'animate-spin': subiendo }" />
      {{ subiendo ? 'Subiendo…' : 'Subir' }}
    </button>
    <input ref="fileInput" @change="onFileInput" type="file" accept=".pdf,.xls,.xlsx,.doc,.docx,.txt" class="hidden" />
  </div>

  <!-- Completo: campo suelto, con zona de carga grande -->
  <div v-else class="mt-1.5 space-y-2">
    <!-- Píldora del archivo actual, clicable para descargar automáticamente (pedido explícito del usuario) -->
    <button
      v-if="tieneArchivo"
      @click="descargar"
      type="button"
      class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-brand-50 hover:border-brand-200 transition-colors text-left"
    >
      <div class="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
        <FontAwesomeIcon :icon="iconoDe(nombreArchivo)" class="w-4 h-4 text-brand-600" />
      </div>
      <span class="min-w-0 flex-1 truncate text-sm font-medium text-heading">{{ nombreArchivo }}</span>
      <FontAwesomeIcon :icon="faDownload" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <span
        v-if="editable"
        @click.stop="quitar"
        role="button"
        title="Quitar archivo"
        class="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 shrink-0"
      >
        <FontAwesomeIcon :icon="faXmark" class="w-3 h-3" />
      </span>
    </button>

    <!-- Zona de carga -->
    <div
      v-if="editable"
      @dragover.prevent="arrastrando = true"
      @dragleave="arrastrando = false"
      @drop="onDrop"
      class="rounded-lg border border-dashed px-3 py-3 text-center transition-colors"
      :class="arrastrando ? 'border-brand-400 bg-brand-50' : 'border-gray-300 bg-white'"
    >
      <div v-if="subiendo" class="flex items-center justify-center gap-2 text-xs text-muted">
        <FontAwesomeIcon :icon="faSpinner" class="w-3 h-3 animate-spin" />
        Subiendo archivo…
      </div>
      <div v-else class="flex items-center justify-center gap-2 text-xs text-muted">
        <FontAwesomeIcon :icon="faPaperclip" class="w-3 h-3 text-gray-400" />
        <span>{{ tieneArchivo ? 'Arrastra otro archivo o' : 'Arrastra un archivo o' }}</span>
        <button
          @click.stop="fileInput?.click()"
          type="button"
          class="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          <FontAwesomeIcon :icon="faCloudArrowUp" class="w-2.5 h-2.5" />
          elige un archivo
        </button>
      </div>
      <p class="mt-1 text-[10px] text-gray-400">PDF, Excel, Word o TXT — hasta 15 MB</p>
      <input ref="fileInput" @change="onFileInput" type="file" accept=".pdf,.xls,.xlsx,.doc,.docx,.txt" class="hidden" />
    </div>

    <p v-if="error" class="text-[11px] text-red-600 flex items-start gap-1">
      <FontAwesomeIcon :icon="faTriangleExclamation" class="w-2.5 h-2.5 shrink-0 mt-0.5" />
      <span class="flex-1">{{ error }}</span>
      <button @click="error = ''" type="button" class="text-red-400 hover:text-red-600">
        <FontAwesomeIcon :icon="faXmark" class="w-2.5 h-2.5" />
      </button>
    </p>
  </div>
</template>
