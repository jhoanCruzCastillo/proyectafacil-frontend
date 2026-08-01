<script setup lang="ts">
import { ref, computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faTriangleExclamation, faFileExcel, faFileImport, faSpinner } from '@/lib/icons';
import { leerValoresDeExcel, type ResultadoVolcado } from '@/lib/excelReader';
import type { Ejemplo, Plantilla } from '@/types';

// Volcado de datos desde un Excel ya llenado hacia los valores del ejemplo activo — el inverso de
// "Insertar" (que escribe el ejemplo dentro del Excel). Flujo en dos pasos deliberado: primero se
// lee el archivo y se muestra QUÉ se encontró, y recién con esa información a la vista se pide
// confirmar; así el usuario nunca sobrescribe a ciegas.
const props = defineProps<{
  isOpen: boolean;
  ejemplo: Ejemplo | null;
  plantilla: Plantilla | null;
}>();

const emit = defineEmits<{ close: []; confirmar: [valores: Record<string, string>] }>();

const arrastrando = ref(false);
const analizando = ref(false);
const error = ref('');
const nombreArchivo = ref('');
const resultado = ref<ResultadoVolcado | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const camposASobrescribir = computed(() => {
  if (!resultado.value || !props.ejemplo) return 0;
  const actuales = props.ejemplo.valores ?? {};
  return Object.keys(resultado.value.valores).filter((id) => (actuales[id] ?? '') !== '').length;
});

function reset() {
  arrastrando.value = false;
  analizando.value = false;
  error.value = '';
  nombreArchivo.value = '';
  resultado.value = null;
}

function handleClose() {
  reset();
  emit('close');
}

function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

async function analizar(file: File) {
  if (!props.plantilla) return;
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
    error.value = 'El archivo debe ser un Excel (.xlsx o .xlsm).';
    return;
  }

  error.value = '';
  resultado.value = null;
  nombreArchivo.value = file.name;
  analizando.value = true;
  try {
    const dataUrl = await leerComoDataUrl(file);
    resultado.value = await leerValoresDeExcel(dataUrl, props.plantilla);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo leer el archivo.';
    nombreArchivo.value = '';
  } finally {
    analizando.value = false;
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  arrastrando.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) analizar(file);
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) analizar(file);
  input.value = '';
}

function confirmar() {
  if (!resultado.value) return;
  emit('confirmar', resultado.value.valores);
  reset();
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="handleClose">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto" @click.stop>
          <div class="flex items-start justify-between p-6 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faFileImport" class="w-4 h-4" />
              </div>
              <div>
                <h2 class="text-lg font-bold text-heading">Volcar datos desde Excel</h2>
                <p class="text-sm text-muted">
                  Lee un Excel ya llenado y copia sus valores al ejemplo
                  <strong v-if="ejemplo" class="text-heading">{{ ejemplo.nombre }}</strong>
                </p>
              </div>
            </div>
            <button
              @click="handleClose"
              type="button"
              class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100 shrink-0"
            >
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <div class="px-6 pb-6 space-y-4">
            <!-- Paso 1: elegir archivo -->
            <div v-if="!resultado">
              <input ref="fileInput" type="file" accept=".xlsx,.xlsm" class="hidden" @change="handleFileInput" />
              <button
                @click="fileInput?.click()"
                @dragover.prevent="arrastrando = true"
                @dragleave="arrastrando = false"
                @drop="handleDrop"
                :disabled="analizando"
                type="button"
                class="w-full py-10 rounded-xl border-2 border-dashed text-sm font-medium transition-colors flex flex-col items-center gap-2 disabled:cursor-wait"
                :class="arrastrando ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600'"
              >
                <FontAwesomeIcon :icon="analizando ? faSpinner : faFileExcel" class="w-6 h-6" :class="analizando ? 'animate-spin' : ''" />
                <template v-if="analizando">Leyendo {{ nombreArchivo }}…</template>
                <template v-else-if="arrastrando">Suelta el archivo aquí</template>
                <template v-else>Selecciona o arrastra el Excel (.xlsx / .xlsm)</template>
              </button>
              <div v-if="error" class="mt-3 flex items-start gap-2 text-sm text-red-600">
                <FontAwesomeIcon :icon="faTriangleExclamation" class="w-4 h-4 mt-0.5 shrink-0" />
                <span>{{ error }}</span>
              </div>
            </div>

            <!-- Paso 2: qué se encontró + confirmación -->
            <template v-else>
              <div class="rounded-xl border border-gray-200 overflow-hidden">
                <div class="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-xs text-heading">
                  <FontAwesomeIcon :icon="faFileExcel" class="w-3.5 h-3.5 text-emerald-600" />
                  <span class="font-medium truncate">{{ nombreArchivo }}</span>
                </div>
                <div class="divide-y divide-gray-100 text-sm">
                  <div class="px-4 py-2.5 flex items-center justify-between">
                    <span class="text-muted">Campos con dato en el Excel</span>
                    <span class="font-bold text-emerald-700">{{ resultado.camposLeidos }}</span>
                  </div>
                  <div class="px-4 py-2.5 flex items-center justify-between">
                    <span class="text-muted">Campos vacíos <span class="text-gray-400">(no se tocan)</span></span>
                    <span class="font-medium text-gray-500">{{ resultado.camposVacios }}</span>
                  </div>
                  <div class="px-4 py-2.5 flex items-center justify-between">
                    <span class="text-muted">Tablas <span class="text-gray-400">(fuera de alcance)</span></span>
                    <span class="font-medium text-gray-500">{{ resultado.tablasOmitidas }}</span>
                  </div>
                </div>
              </div>

              <div v-if="resultado.hojasFaltantes.length" class="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl p-4">
                <FontAwesomeIcon :icon="faTriangleExclamation" class="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Este Excel no tiene {{ resultado.hojasFaltantes.length === 1 ? 'la hoja' : 'las hojas' }}
                  <strong>{{ resultado.hojasFaltantes.join(', ') }}</strong> — sus campos se omitirán. ¿Es el archivo correcto?
                </span>
              </div>

              <div v-if="resultado.camposLeidos === 0" class="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl p-4">
                <FontAwesomeIcon :icon="faTriangleExclamation" class="w-4 h-4 mt-0.5 shrink-0" />
                <span>No se encontró ningún dato en las celdas que la plantilla tiene configuradas. No hay nada que volcar.</span>
              </div>
              <div v-else-if="camposASobrescribir > 0" class="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl p-4">
                <FontAwesomeIcon :icon="faTriangleExclamation" class="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>{{ camposASobrescribir }}</strong>
                  {{ camposASobrescribir === 1 ? 'campo que ya tiene valor será reemplazado' : 'campos que ya tienen valor serán reemplazados' }}
                  por el dato del Excel. Los demás campos del ejemplo (incluidas todas las tablas) quedan intactos.
                </span>
              </div>
              <p v-else class="text-sm text-muted px-1">
                Ningún campo actual se pierde — todos los valores del Excel van a campos que hoy están vacíos.
              </p>

              <div class="flex justify-end gap-3 pt-2">
                <button
                  @click="reset"
                  type="button"
                  class="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75"
                >
                  Elegir otro archivo
                </button>
                <button
                  @click="confirmar"
                  :disabled="resultado.camposLeidos === 0"
                  type="button"
                  class="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center gap-2"
                >
                  <FontAwesomeIcon :icon="faFileImport" class="w-3.5 h-3.5" />
                  Volcar {{ resultado.camposLeidos }} {{ resultado.camposLeidos === 1 ? 'campo' : 'campos' }}
                </button>
              </div>
            </template>
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
  transform: scale(0.97) translateY(10px);
}
</style>
