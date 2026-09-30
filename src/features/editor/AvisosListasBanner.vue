<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faTriangleExclamation, faArrowRight, faXmark } from '@/lib/icons';
import type { AvisoLista } from '@/lib/excelWriter';

// Reemplaza el toast de texto plano ("4 valores no están entre las opciones de su desplegable en
// el Excel: 01.09.7, 01.09.9…") por un banner que se queda en pantalla — un toast se autodescarta a
// los 2.5s, muy poco tiempo para leer varios identificadores y luego ir a buscarlos a mano en el
// árbol de secciones. Pedido explícito del usuario (2026-09-30), con el mismo espíritu del banner
// de "N errores de validación" que ya existe para otros flujos de la app: un chip por problema que
// salta directo al campo, más un botón para ir avanzando uno por uno.
const props = defineProps<{ avisos: AvisoLista[] }>();
const emit = defineEmits<{ ir: [aviso: AvisoLista]; cerrar: [] }>();

const titulo = computed(() => {
  const n = props.avisos.length;
  return n === 1
    ? 'Un valor no está entre las opciones de su desplegable en el Excel'
    : `${n} valores no están entre las opciones de su desplegable en el Excel`;
});

// "Siguiente aviso" avanza un índice propio (los avisos no se marcan "visto" al revisarlos — nada
// los quita de la lista — así que hace falta este contador aparte para saber por dónde íbamos).
// Se reinicia si la lista de avisos cambia (nueva inserción), para no arrancar a mitad de una lista
// distinta a la que el usuario venía recorriendo.
const indiceSiguiente = ref(0);
watch(() => props.avisos, () => { indiceSiguiente.value = 0; });

function irSiguiente() {
  if (props.avisos.length === 0) return;
  emit('ir', props.avisos[indiceSiguiente.value]);
  indiceSiguiente.value = (indiceSiguiente.value + 1) % props.avisos.length;
}
</script>

<template>
  <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
    <div class="flex items-start gap-2">
      <FontAwesomeIcon :icon="faTriangleExclamation" class="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-red-700">{{ titulo }}</p>
        <p class="text-xs text-red-600 mt-0.5">El valor se insertó igual, pero puede romper las fórmulas que dependen de esa celda. Revisa cada campo:</p>
        <div class="flex flex-wrap items-center gap-1.5 mt-2">
          <button
            v-for="aviso in avisos"
            :key="aviso.campo + aviso.celda"
            type="button"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-red-200 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors duration-75"
            :title="`Valor actual: &quot;${aviso.valor}&quot;`"
            @click="emit('ir', aviso)"
          >
            {{ aviso.campo }}
            <FontAwesomeIcon :icon="faArrowRight" class="w-2.5 h-2.5" />
          </button>
          <button
            v-if="avisos.length > 1"
            type="button"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-red-700 hover:bg-red-100 transition-colors duration-75"
            @click="irSiguiente"
          >
            Siguiente aviso
            <FontAwesomeIcon :icon="faArrowRight" class="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
      <button
        type="button"
        class="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors duration-75"
        title="Descartar"
        @click="emit('cerrar')"
      >
        <FontAwesomeIcon :icon="faXmark" class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>
