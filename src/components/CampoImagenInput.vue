<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faImage, faSpinner, faTriangleExclamation, faXmark, faCloudArrowUp } from '@/lib/icons';
import { subirImagen } from '@/api/imagenes';

// Editor de un campo tipo `imagen`. El dato que viaja en el JSON es SIEMPRE una URL, nunca el
// binario: subir la imagen a Cloudinary y guardar su enlace mantiene el documento liviano (una
// sola de estas imágenes pesa ~300 KB) y permite que el Excel la recupere después.
//
// Dos formas de llenarlo, y las dos acaban en lo mismo: pegar una URL a mano, o arrastrar/elegir
// un archivo, que se sube y devuelve su URL.
const props = withDefaults(defineProps<{ value: string; editable?: boolean }>(), { editable: true });
const emit = defineEmits<{ change: [value: string] }>();

const subiendo = ref(false);
const error = ref('');
const arrastrando = ref(false);
const fallo = ref(false); // la URL existe pero el navegador no pudo pintarla
const fileInput = ref<HTMLInputElement | null>(null);

const tieneUrl = computed(() => props.value.trim() !== '');

function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

async function cargar(file: File) {
  if (!file.type.startsWith('image/')) {
    error.value = 'El archivo debe ser una imagen.';
    return;
  }
  error.value = '';
  subiendo.value = true;
  try {
    const dataUrl = await leerComoDataUrl(file);
    const formato = (file.name.split('.').pop() ?? '').toLowerCase();
    const { url } = await subirImagen(dataUrl, file.name, formato);
    fallo.value = false;
    emit('change', url);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo subir la imagen.';
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

function onUrlInput(v: string) {
  fallo.value = false;
  emit('change', v);
}
</script>

<template>
  <div class="mt-1.5 space-y-2">
    <!-- La URL sigue visible y editable: es el dato real del JSON, y a veces se pega a mano -->
    <input
      :value="value"
      @input="onUrlInput(($event.target as HTMLInputElement).value)"
      :readonly="!editable"
      type="text"
      placeholder="https://… o arrastra una imagen aquí abajo"
      class="w-full px-2 py-1.5 rounded border bg-white text-sm text-heading focus:outline-none focus:ring-2 border-brand-200 focus:ring-brand-500/30 focus:border-brand-500"
    />

    <!-- Vista previa de lo que hay en esa URL -->
    <div v-if="tieneUrl" class="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
      <img
        v-if="!fallo"
        :src="value"
        alt="Vista previa"
        class="block max-h-64 w-auto mx-auto"
        @error="fallo = true"
        @load="fallo = false"
      />
      <div v-else class="flex items-center gap-2 px-3 py-4 text-xs text-amber-700">
        <FontAwesomeIcon :icon="faTriangleExclamation" class="w-3 h-3 shrink-0" />
        No se pudo cargar la imagen desde esa URL. Puede que el enlace ya no exista, o que el
        formato no sea uno que el navegador sepa mostrar.
      </div>
    </div>

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
        Subiendo imagen…
      </div>
      <div v-else class="flex items-center justify-center gap-2 text-xs text-muted">
        <FontAwesomeIcon :icon="faImage" class="w-3 h-3 text-gray-400" />
        <span>Arrastra una imagen o</span>
        <button
          @click.stop="fileInput?.click()"
          type="button"
          class="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          <FontAwesomeIcon :icon="faCloudArrowUp" class="w-2.5 h-2.5" />
          elige un archivo
        </button>
      </div>
      <input ref="fileInput" @change="onFileInput" type="file" accept="image/*" class="hidden" />
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
