<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faCircleQuestion, faWandMagicSparkles, faSpinner } from '@/lib/icons';

// Único punto de entrada a la IA desde una tarjeta de campo. Antes convivían dos cosas distintas en
// la fila de acciones: un botón de texto ("Mejorar con IA" / "Llenar con IA") y un "?" morado que
// abría el chat. Eran dos afordancias para lo mismo, y la descripción que el admin escribe por campo
// —el mecanismo con el que se documenta una ficha (ver docs/llenado-automatico-ia.md §8.1)— no se
// veía en ningún lado del lado del cliente: se usaba solo para armar el prompt.
//
// Ahora el "?" abre esto: la explicación del campo y, debajo, la acción de IA. El usuario lee para
// qué es el campo ANTES de decidir si se lo pide a la IA, y la descripción por fin le sirve a alguien
// más que al modelo.
const props = defineProps<{
  isOpen: boolean;
  /** Etiqueta del campo, como título del modal. */
  etiqueta: string;
  /** "Descripción / ayuda" cargada en la estructura. Vacía/ausente = no se documentó ese campo. */
  descripcion?: string;
  /** 'llenar' = el campo está vacío; 'mejorar' = ya tiene valor. Solo cambia el texto del botón. */
  modo: 'llenar' | 'mejorar';
  /** De dónde salió el valor actual, si lo puso la IA y citó una fuente. Antes esto vivía en un
   *  segundo "?" al lado del primero; se trajo acá para dejar un solo botón por campo. */
  fuente?: string;
  /** Advertencias del último llenado con IA de una tabla (ej. UBIGEO sin resolver). Misma razón. */
  advertencias?: string[];
  /** false = el plan del cliente no incluye IA; el botón queda deshabilitado con el motivo. */
  permiteIA?: boolean;
  /** true mientras la petición de IA de este campo está en vuelo. */
  cargando?: boolean;
}>();

const emit = defineEmits<{ close: []; 'llenar-ia': [] }>();

const parrafos = computed(() =>
  (props.descripcion ?? '')
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean),
);
const tieneDescripcion = computed(() => parrafos.value.length > 0);
const textoBoton = computed(() => (props.modo === 'mejorar' ? 'Mejorar con IA' : 'Llenar con IA'));
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-lg p-6" @click.stop>
          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faCircleQuestion" class="w-4 h-4" />
              </div>
              <h2 class="text-lg font-bold text-heading">{{ etiqueta }}</h2>
            </div>
            <button
              @click="emit('close')"
              class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100 shrink-0"
            >
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <div class="rounded-xl bg-sky-50/70 border border-sky-100 p-4 max-h-[45vh] overflow-y-auto">
            <div v-if="tieneDescripcion" class="text-sm text-heading leading-relaxed space-y-3">
              <p v-for="(p, i) in parrafos" :key="i">{{ p }}</p>
            </div>
            <!-- Se dice que falta, en vez de esconder el bloque: un campo sin documentar es algo que
                 el admin puede corregir en el editor de plantillas, y ocultarlo lo vuelve invisible. -->
            <p v-else class="text-sm text-muted italic">Sin descripción cargada.</p>
          </div>

          <!-- Lo que antes mostraba el segundo "?" de la tarjeta. Va después de la descripción
               porque es sobre el valor que hay AHORA, no sobre qué va en el campo. -->
          <div v-if="advertencias && advertencias.length > 0" class="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3">
            <p class="text-[10px] font-bold uppercase tracking-wide text-amber-600 mb-1">Para revisar</p>
            <ul class="text-xs text-amber-900 leading-snug space-y-1 list-disc list-inside">
              <li v-for="(a, i) in advertencias" :key="i">{{ a }}</li>
            </ul>
          </div>
          <div v-if="fuente" class="mt-3 rounded-xl bg-gray-50 border border-gray-200 p-3">
            <p class="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Origen del dato</p>
            <p class="text-xs text-heading leading-snug">{{ fuente }}</p>
          </div>

          <div class="mt-4 flex items-center gap-3 rounded-xl bg-violet-50 border border-violet-100 p-3">
            <div class="w-9 h-9 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
              <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-4 h-4" />
            </div>
            <p class="text-xs text-muted leading-snug flex-1">
              Puedes pedirle a la IA que complete este campo a partir de los documentos del proyecto.
            </p>
            <button
              type="button"
              @click="emit('llenar-ia')"
              :disabled="permiteIA === false || cargando"
              :title="permiteIA === false ? 'Disponible desde Nivel 1 — actualiza tu plan' : undefined"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <FontAwesomeIcon :icon="cargando ? faSpinner : faWandMagicSparkles" class="w-3.5 h-3.5" :class="cargando ? 'animate-spin' : ''" />
              {{ textoBoton }}
            </button>
          </div>

          <div class="mt-4 flex justify-end">
            <button
              type="button"
              @click="emit('close')"
              class="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-muted hover:bg-gray-50 transition-colors duration-100"
            >
              Cerrar
            </button>
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
