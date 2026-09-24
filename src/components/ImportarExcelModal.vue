<script setup lang="ts">
import { ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faFileExcel, faSpinner, faTriangleExclamation, faXmark } from '@/lib/icons';
import type { ResultadoImportacion } from '@/types';

const props = defineProps<{
  isOpen: boolean;
  titulo: string;
  /** Nombre de columna -> qué debe traer, en el orden exacto del Excel. */
  columnas: { nombre: string; detalle: string }[];
  subir: (archivo: File) => Promise<ResultadoImportacion>;
}>();
const emit = defineEmits<{ close: []; importado: [ResultadoImportacion] }>();

const archivo = ref<File | null>(null);
const subiendo = ref(false);
const error = ref('');
const resultado = ref<ResultadoImportacion | null>(null);

function elegirArchivo(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null;
  archivo.value = f;
  error.value = '';
  resultado.value = null;
}

async function subir() {
  if (!archivo.value || subiendo.value) return;
  subiendo.value = true;
  error.value = '';
  try {
    resultado.value = await props.subir(archivo.value);
    emit('importado', resultado.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo importar el archivo.';
  } finally {
    subiendo.value = false;
  }
}

function cerrar() {
  if (subiendo.value) return;
  archivo.value = null;
  error.value = '';
  resultado.value = null;
  emit('close');
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="cerrar">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-lg p-6" @click.stop>
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faFileExcel" class="w-4 h-4" />
              </div>
              <h2 class="text-lg font-bold text-heading">{{ titulo }}</h2>
            </div>
            <button @click="cerrar" type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100 shrink-0">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <template v-if="!resultado">
            <div class="rounded-lg border border-gray-200 p-3 mb-4">
              <p class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Columnas esperadas, en este orden</p>
              <dl class="text-sm space-y-1.5">
                <div v-for="c in columnas" :key="c.nombre" class="flex gap-2">
                  <dt class="font-medium text-heading shrink-0">{{ c.nombre }}</dt>
                  <dd class="text-muted">{{ c.detalle }}</dd>
                </div>
              </dl>
              <p class="text-xs text-muted mt-2">La primera fila debe ser el encabezado (se ignora).</p>
            </div>

            <label class="block border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-brand-400 transition-colors duration-75">
              <input type="file" accept=".xlsx" class="hidden" @change="elegirArchivo" />
              <FontAwesomeIcon :icon="faFileExcel" class="w-6 h-6 text-gray-300 mb-2" />
              <p class="text-sm font-medium text-heading">{{ archivo ? archivo.name : 'Haz clic para elegir un archivo .xlsx' }}</p>
            </label>

            <p v-if="error" class="text-sm text-red-600 mt-3">{{ error }}</p>

            <div class="flex justify-end gap-3 mt-6">
              <button @click="cerrar" type="button" :disabled="subiendo" class="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 disabled:opacity-70">
                Cancelar
              </button>
              <button
                @click="subir"
                type="button"
                :disabled="!archivo || subiendo"
                class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors duration-75 flex items-center gap-2"
              >
                <FontAwesomeIcon v-if="subiendo" :icon="faSpinner" class="w-3.5 h-3.5 animate-spin" />
                {{ subiendo ? 'Importando…' : 'Importar' }}
              </button>
            </div>
          </template>

          <template v-else>
            <p class="text-sm text-heading">
              <span class="font-bold text-emerald-600">{{ resultado.creados }}</span>
              {{ resultado.creados === 1 ? 'registro creado' : 'registros creados' }}.
            </p>
            <div v-if="resultado.omitidos.length > 0" class="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p class="text-xs font-semibold text-amber-700 flex items-center gap-1.5 mb-2">
                <FontAwesomeIcon :icon="faTriangleExclamation" class="w-3 h-3" />
                {{ resultado.omitidos.length }} {{ resultado.omitidos.length === 1 ? 'fila omitida' : 'filas omitidas' }}
              </p>
              <ul class="text-xs text-amber-800 space-y-1 max-h-40 overflow-y-auto">
                <li v-for="o in resultado.omitidos" :key="o.fila">Fila {{ o.fila }}: {{ o.motivo }}</li>
              </ul>
            </div>
            <div class="flex justify-end mt-6">
              <button @click="cerrar" type="button" class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors duration-75">
                Cerrar
              </button>
            </div>
          </template>
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
  transform: scale(0.97) translateY(10px);
}
</style>
