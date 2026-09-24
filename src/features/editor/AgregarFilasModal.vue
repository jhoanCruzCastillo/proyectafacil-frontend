<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faPlus } from '@/lib/icons';

/**
 * Alta masiva de filas para una tabla de filas dinamicas.
 *
 * Existe porque modelar una tabla del Excel oficial puede significar 200+ filas, y el boton
 * "Agregar fila" del panel central agrega de a una. Aqui solo se pide la cantidad; las filas
 * se crean vacias y se agregan al final, igual que haria ese boton repetido N veces.
 */
const props = defineProps<{
  isOpen: boolean;
  /** Filas que la tabla tiene AHORA (las del valor del campo, no `filas_base`) */
  filasActuales: number;
}>();

const emit = defineEmits<{ close: []; agregar: [cantidad: number] }>();

/** Tope deliberado: mas que esto es casi seguro un dedazo, y la tabla se vuelve impracticable. */
const MAX = 500;

const cantidad = ref(1);

// Cada apertura arranca limpia: si no, el modal reabre con el numero de la vez anterior.
watch(
  () => props.isOpen,
  (abierto) => {
    if (abierto) cantidad.value = 1;
  },
);

const valida = computed(() => Number.isFinite(cantidad.value) && cantidad.value >= 1 && cantidad.value <= MAX);
const total = computed(() => props.filasActuales + (valida.value ? cantidad.value : 0));

function onInput(e: Event) {
  const n = Number((e.target as HTMLInputElement).value);
  cantidad.value = Number.isFinite(n) ? Math.min(Math.max(1, Math.trunc(n)), MAX) : 1;
}

function aceptar() {
  if (!valida.value) return;
  emit('agregar', cantidad.value);
  emit('close');
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-xs" @click.stop>
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <FontAwesomeIcon :icon="faPlus" class="w-3.5 h-3.5 text-brand-600" />
              <h2 class="text-sm font-bold text-heading">Agregar filas</h2>
            </div>
            <button
              @click="emit('close')"
              type="button"
              class="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100"
            >
              <FontAwesomeIcon :icon="faXmark" class="w-3.5 h-3.5" />
            </button>
          </div>

          <div class="p-5 space-y-3">
            <p class="text-xs text-muted">
              Cuántas filas vacías agregar al final de la tabla. No cambia
              <strong class="text-heading">Filas base</strong>, que se declara aparte.
            </p>

            <div>
              <label class="block text-[10px] font-medium text-muted mb-1">Filas a agregar</label>
              <input
                :value="cantidad"
                @input="onInput"
                @keyup.enter="aceptar"
                type="number"
                min="1"
                :max="MAX"
                autofocus
                class="w-full px-3 py-2 rounded-lg border border-brand-200 bg-brand-50/40 text-sm font-semibold text-heading focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <p class="text-[10px] text-muted mt-1">Máximo {{ MAX }} por vez</p>
            </div>

            <div class="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
              <p class="text-[11px] text-heading">
                Ahora <strong>{{ filasActuales }}</strong> fila{{ filasActuales === 1 ? '' : 's' }} →
                después <strong>{{ total }}</strong> fila{{ total === 1 ? '' : 's' }}
              </p>
            </div>

            <div class="flex items-center gap-2 pt-1">
              <button
                @click="emit('close')"
                type="button"
                class="flex-1 py-2 rounded-lg border border-gray-200 text-xs font-medium text-muted hover:bg-gray-50 transition-colors duration-100"
              >
                Cancelar
              </button>
              <button
                @click="aceptar"
                :disabled="!valida"
                type="button"
                class="flex-1 py-2 rounded-lg bg-brand-500 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-100"
              >
                Aceptar
              </button>
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
  transform: scale(0.97) translateY(10px);
}
</style>
