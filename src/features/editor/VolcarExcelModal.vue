<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faTriangleExclamation, faFileExcel, faFileImport, faSpinner, faTable, faAlignLeft, faImage } from '@/lib/icons';
import { leerValoresDeExcel, type ResultadoVolcado } from '@/lib/excelReader';
import { subirImagen } from '@/api/imagenes';
import type { Ejemplo, Plantilla } from '@/types';

// Volcado de datos desde un Excel ya llenado hacia los valores del ejemplo activo — el inverso de
// "Insertar" (que escribe el ejemplo dentro del Excel). Flujo en dos pasos deliberado: primero se
// elige QUÉ volcar (tipos de dato + secciones) y el archivo; el análisis muestra qué se encontró, y
// recién con esa información a la vista se confirma — nunca se sobrescribe a ciegas.
const props = defineProps<{
  isOpen: boolean;
  ejemplo: Ejemplo | null;
  plantilla: Plantilla | null;
  /** Valores vigentes del ejemplo en el editor (incluye ediciones sin guardar) — base del conteo
   * de sobrescritura y de la fusión celda a celda en tablas */
  valoresActuales?: Record<string, string>;
}>();

const emit = defineEmits<{ close: []; confirmar: [valores: Record<string, string>] }>();

// --- Opciones de volcado ---
const incluirCamposSimples = ref(true);
const incluirTablas = ref(true);
const incluirImagenes = ref(true);
const seccionesElegidas = ref<Set<string>>(new Set());

watch(
  () => [props.isOpen, props.plantilla] as const,
  ([open, plantilla]) => {
    if (open && plantilla) seccionesElegidas.value = new Set(plantilla.secciones.map((s) => s.id));
  },
  { immediate: true },
);

const todasElegidas = computed(() => (props.plantilla?.secciones.length ?? 0) === seccionesElegidas.value.size);

function toggleSeccion(id: string) {
  const next = new Set(seccionesElegidas.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  seccionesElegidas.value = next;
}

function toggleTodas() {
  seccionesElegidas.value = todasElegidas.value ? new Set() : new Set((props.plantilla?.secciones ?? []).map((s) => s.id));
}

const nadaQueLeer = computed(
  () => (!incluirCamposSimples.value && !incluirTablas.value && !incluirImagenes.value) || seccionesElegidas.value.size === 0,
);

// --- Análisis del archivo ---
const arrastrando = ref(false);
const analizando = ref(false);
const error = ref('');
const nombreArchivo = ref('');
const resultado = ref<ResultadoVolcado | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const totalAVolcar = computed(() => (resultado.value ? resultado.value.camposLeidos + resultado.value.tablasLeidas : 0));

const camposASobrescribir = computed(() => {
  if (!resultado.value) return 0;
  const actuales = props.valoresActuales ?? props.ejemplo?.valores ?? {};
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
  if (!props.plantilla || nadaQueLeer.value) return;
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
    resultado.value = await leerValoresDeExcel(dataUrl, props.plantilla, {
      camposSimples: incluirCamposSimples.value,
      tablas: incluirTablas.value,
      imagenes: incluirImagenes.value,
      seccionesIds: seccionesElegidas.value,
      valoresActuales: props.valoresActuales ?? props.ejemplo?.valores ?? {},
      // El binario incrustado se sube a Cloudinary y en el JSON queda su URL, nunca la imagen.
      // Si el backend no puede con el formato (EMF sin conversor) devuelve null y el volcado la
      // reporta como omitida en vez de abortar el resto.
      subirImagen: async (img, nombre) => {
        try {
          let bin = '';
          for (let i = 0; i < img.bytes.length; i += 8192) bin += String.fromCharCode(...img.bytes.subarray(i, i + 8192));
          const { url } = await subirImagen(`data:application/octet-stream;base64,${btoa(bin)}`, nombre, img.formato);
          return url;
        } catch {
          return null;
        }
      },
    });
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
            <!-- Paso 1: qué volcar + archivo -->
            <template v-if="!resultado">
              <div class="rounded-xl border border-gray-200 p-4 space-y-3">
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Qué volcar</p>
                <label class="flex items-start gap-2.5 cursor-pointer">
                  <input v-model="incluirCamposSimples" type="checkbox" class="mt-0.5 w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/30" />
                  <span class="flex-1">
                    <span class="text-sm font-medium text-heading flex items-center gap-1.5">
                      <FontAwesomeIcon :icon="faAlignLeft" class="w-3 h-3 text-gray-400" />
                      Campos simples
                    </span>
                    <span class="block text-xs text-muted">Texto, números, fechas, listas…</span>
                  </span>
                </label>
                <label class="flex items-start gap-2.5 cursor-pointer">
                  <input v-model="incluirTablas" type="checkbox" class="mt-0.5 w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/30" />
                  <span class="flex-1">
                    <span class="text-sm font-medium text-heading flex items-center gap-1.5">
                      <FontAwesomeIcon :icon="faTable" class="w-3 h-3 text-gray-400" />
                      Tablas
                    </span>
                    <span class="block text-xs text-muted">
                      Planas, agrupadas, jerárquicas y por períodos. Se leen las filas que la
                      estructura reserva; si la tabla creció en el Excel, esas filas de más no entran.
                    </span>
                  </span>
                </label>
                <label class="flex items-start gap-2.5 cursor-pointer">
                  <input v-model="incluirImagenes" type="checkbox" class="mt-0.5 w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/30" />
                  <span class="flex-1">
                    <span class="text-sm font-medium text-heading flex items-center gap-1.5">
                      <FontAwesomeIcon :icon="faImage" class="w-3 h-3 text-gray-400" />
                      Imágenes
                    </span>
                    <span class="block text-xs text-muted">
                      Se extraen del Excel, se suben y en el ejemplo queda su enlace. Los formatos
                      no web (EMF de los mapas oficiales) se convierten en el servidor; si no se
                      puede, se informa cuáles quedaron fuera.
                    </span>
                  </span>
                </label>
              </div>

              <div class="rounded-xl border border-gray-200 p-4">
                <div class="flex items-center justify-between mb-2.5">
                  <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Secciones · {{ seccionesElegidas.size }}/{{ plantilla?.secciones.length ?? 0 }}
                  </p>
                  <button @click="toggleTodas" type="button" class="text-[11px] font-medium text-emerald-600 hover:text-emerald-800">
                    {{ todasElegidas ? 'Ninguna' : 'Todas' }}
                  </button>
                </div>
                <div class="max-h-44 overflow-y-auto space-y-1 pr-1">
                  <label
                    v-for="s in plantilla?.secciones ?? []"
                    :key="s.id"
                    class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors duration-75"
                    :class="seccionesElegidas.has(s.id) ? 'bg-emerald-50/60' : 'hover:bg-gray-50'"
                  >
                    <input
                      :checked="seccionesElegidas.has(s.id)"
                      @change="toggleSeccion(s.id)"
                      type="checkbox"
                      class="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/30"
                    />
                    <span class="w-6 h-6 rounded-md bg-gray-100 text-gray-500 text-[11px] font-bold flex items-center justify-center shrink-0">{{ s.numero }}</span>
                    <span class="text-sm text-heading truncate">{{ s.nombre }}</span>
                  </label>
                </div>
              </div>

              <div>
                <input ref="fileInput" type="file" accept=".xlsx,.xlsm" class="hidden" @change="handleFileInput" />
                <button
                  @click="fileInput?.click()"
                  @dragover.prevent="arrastrando = true"
                  @dragleave="arrastrando = false"
                  @drop="handleDrop"
                  :disabled="analizando || nadaQueLeer"
                  type="button"
                  class="w-full py-8 rounded-xl border-2 border-dashed text-sm font-medium transition-colors flex flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  :class="arrastrando ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600'"
                >
                  <FontAwesomeIcon :icon="analizando ? faSpinner : faFileExcel" class="w-6 h-6" :class="analizando ? 'animate-spin' : ''" />
                  <template v-if="analizando">Leyendo {{ nombreArchivo }}…</template>
                  <template v-else-if="nadaQueLeer">Elige al menos un tipo de dato y una sección</template>
                  <template v-else-if="arrastrando">Suelta el archivo aquí</template>
                  <template v-else>Selecciona o arrastra el Excel (.xlsx / .xlsm)</template>
                </button>
                <div v-if="error" class="mt-3 flex items-start gap-2 text-sm text-red-600">
                  <FontAwesomeIcon :icon="faTriangleExclamation" class="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{{ error }}</span>
                </div>
              </div>
            </template>

            <!-- Paso 2: qué se encontró + confirmación -->
            <template v-else>
              <div class="rounded-xl border border-gray-200 overflow-hidden">
                <div class="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-xs text-heading">
                  <FontAwesomeIcon :icon="faFileExcel" class="w-3.5 h-3.5 text-emerald-600" />
                  <span class="font-medium truncate">{{ nombreArchivo }}</span>
                  <span class="ml-auto text-muted shrink-0">{{ seccionesElegidas.size }} secciones</span>
                </div>
                <div class="divide-y divide-gray-100 text-sm">
                  <div v-if="incluirCamposSimples" class="px-4 py-2.5 flex items-center justify-between">
                    <span class="text-muted">Campos simples con dato</span>
                    <span class="font-bold text-emerald-700">{{ resultado.camposLeidos }}</span>
                  </div>
                  <div v-if="incluirCamposSimples" class="px-4 py-2.5 flex items-center justify-between">
                    <span class="text-muted">Campos vacíos <span class="text-gray-400">(no se tocan)</span></span>
                    <span class="font-medium text-gray-500">{{ resultado.camposVacios }}</span>
                  </div>
                  <div v-if="incluirTablas" class="px-4 py-2.5 flex items-center justify-between">
                    <span class="text-muted">Tablas con datos</span>
                    <span class="font-bold text-emerald-700">
                      {{ resultado.tablasLeidas }}
                      <span class="font-normal text-muted">· {{ resultado.filasTablaLeidas }} filas</span>
                    </span>
                  </div>
                  <div v-if="incluirTablas && resultado.filasExtraDetectadas > 0" class="px-4 py-2.5 flex items-center justify-between">
                    <span class="text-muted">Filas insertadas detectadas</span>
                    <span class="font-medium text-amber-600">+{{ resultado.filasExtraDetectadas }}</span>
                  </div>
                  <div v-if="incluirImagenes" class="px-4 py-2.5 flex items-center justify-between">
                    <span class="text-muted">Imágenes subidas</span>
                    <span class="font-bold text-emerald-700">{{ resultado.imagenesLeidas }}</span>
                  </div>
                  <div v-if="resultado.imagenesOmitidas.length > 0" class="px-4 py-2.5">
                    <div class="flex items-center justify-between">
                      <span class="text-muted">Imágenes no convertibles</span>
                      <span class="font-medium text-amber-600">{{ resultado.imagenesOmitidas.length }}</span>
                    </div>
                    <p class="text-[11px] text-muted mt-1">{{ resultado.imagenesOmitidas.join(", ") }}</p>
                  </div>
                  <div v-if="resultado.tablasOmitidas > 0" class="px-4 py-2.5 flex items-center justify-between">
                    <span class="text-muted">Tablas de otros subtipos <span class="text-gray-400">(fuera de alcance)</span></span>
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

              <div v-if="totalAVolcar === 0" class="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl p-4">
                <FontAwesomeIcon :icon="faTriangleExclamation" class="w-4 h-4 mt-0.5 shrink-0" />
                <span>No se encontró ningún dato en las celdas que la plantilla tiene configuradas. No hay nada que volcar.</span>
              </div>
              <div v-else-if="camposASobrescribir > 0" class="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl p-4">
                <FontAwesomeIcon :icon="faTriangleExclamation" class="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>{{ camposASobrescribir }}</strong>
                  {{ camposASobrescribir === 1 ? 'campo que ya tiene valor será actualizado' : 'campos que ya tienen valor serán actualizados' }}
                  con el dato del Excel (en tablas, celda por celda — lo vacío del Excel no borra nada). El resto queda intacto.
                </span>
              </div>
              <p v-else class="text-sm text-muted px-1">
                Ningún valor actual se pierde — todo lo leído va a campos que hoy están vacíos.
              </p>

              <div class="flex justify-end gap-3 pt-2">
                <button
                  @click="reset"
                  type="button"
                  class="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75"
                >
                  Volver
                </button>
                <button
                  @click="confirmar"
                  :disabled="totalAVolcar === 0"
                  type="button"
                  class="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center gap-2"
                >
                  <FontAwesomeIcon :icon="faFileImport" class="w-3.5 h-3.5" />
                  Volcar {{ resultado.camposLeidos }} {{ resultado.camposLeidos === 1 ? 'campo' : 'campos' }}<template v-if="resultado.tablasLeidas > 0">
                    + {{ resultado.tablasLeidas }} {{ resultado.tablasLeidas === 1 ? 'tabla' : 'tablas' }}</template>
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
