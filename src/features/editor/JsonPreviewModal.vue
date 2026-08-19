<script setup lang="ts">
import { ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faFileCode, faCopy, faCheck, faDownload, faSave, faTriangleExclamation } from '@/lib/icons';

const props = defineProps<{
  isOpen: boolean;
  title: string;
  json: string;
  /** true = el JSON se puede editar y guardar (solo "Editar JSON" en tab Ejemplos) */
  editable?: boolean;
  /** Mensaje de validación de la última "Guardar" fallida (JSON inválido, clave faltante, etc.) */
  error?: string;
}>();

const emit = defineEmits<{ close: []; save: [json: string] }>();

const copied = ref(false);
const editableText = ref(props.json);

// Se reinicia cada vez que se abre para un campo distinto (o el mismo, tras un guardado exitoso
// que cierra y reabre con el valor ya persistido) — sin esto, el textarea arrastraría el texto del
// campo anterior.
watch(
  () => [props.isOpen, props.json],
  () => { editableText.value = props.json; },
);

function contenidoActual(): string {
  return props.editable ? editableText.value : props.json;
}

async function handleCopy() {
  await navigator.clipboard.writeText(contenidoActual());
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 1500);
}

function handleGuardar() {
  emit('save', editableText.value);
}

// El título llega como "CÓDIGO — Estructura" o "CÓDIGO — Ejemplo: Nombre"; se convierte en un
// nombre de archivo seguro (sin acentos ni caracteres que Windows rechaza en rutas).
function nombreArchivo(): string {
  const base = props.title
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${base || 'documento'}.json`;
}

function handleDownload() {
  const blob = new Blob([props.json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-[90vw] h-[85vh] flex flex-col overflow-hidden" @click.stop>
          <div class="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faFileCode" class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <h2 class="text-base font-bold text-heading truncate">{{ title }}</h2>
                <p class="text-xs text-muted">{{ editable ? 'Edición manual del JSON — solo admin' : 'Documento JSON generado — esquema oficial' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                @click="handleDownload"
                type="button"
                title="Descargar como archivo .json"
                class="px-4 py-2 rounded-lg border border-gray-200 text-heading text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors duration-75 flex items-center gap-2"
              >
                <FontAwesomeIcon :icon="faDownload" class="w-3.5 h-3.5" />
                Descargar
              </button>
              <button
                @click="handleCopy"
                type="button"
                class="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors duration-75 flex items-center gap-2"
              >
                <FontAwesomeIcon :icon="copied ? faCheck : faCopy" class="w-3.5 h-3.5" />
                {{ copied ? 'Copiado' : 'Copiar' }}
              </button>
              <button
                v-if="editable"
                @click="handleGuardar"
                type="button"
                class="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors duration-75 flex items-center gap-2"
              >
                <FontAwesomeIcon :icon="faSave" class="w-3.5 h-3.5" />
                Guardar
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

          <div v-if="editable && error" class="shrink-0 mx-4 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <FontAwesomeIcon :icon="faTriangleExclamation" class="w-3.5 h-3.5 shrink-0" />
            {{ error }}
          </div>

          <div class="flex-1 overflow-auto bg-gray-50 p-4">
            <textarea
              v-if="editable"
              v-model="editableText"
              spellcheck="false"
              class="w-full h-full min-h-[50vh] text-xs font-mono text-heading bg-white rounded-lg border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
            />
            <pre v-else class="text-xs font-mono text-heading whitespace-pre-wrap break-words">{{ json }}</pre>
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
