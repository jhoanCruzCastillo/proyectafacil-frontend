<script setup lang="ts">
// Desplegable cuyas opciones se leen del Excel, no de la estructura JSON. Es un combobox y no un
// <select>: el valor sigue siendo texto libre —el usuario puede escribir algo que no esté en la
// lista— pero se avisa cuando no coincide, porque un valor fuera de lista rompe las fórmulas
// dependientes del Excel (INDIRECT sobre el valor de la celda).
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronDown, faCheck, faTriangleExclamation } from '@/lib/icons';

const props = withDefaults(defineProps<{ value: string; opciones: string[]; editable?: boolean }>(), {
  editable: true,
});
const emit = defineEmits<{ change: [value: string] }>();

// Con listas largas (UBIGEO trae 1874 entradas) no se pintan todas: se filtra por lo escrito y se
// corta, con un aviso de cuántas quedan fuera.
const MAX_VISIBLES = 60;

const abierto = ref(false);
const filtro = ref('');
const resaltado = ref(-1);
const raiz = ref<HTMLElement | null>(null);
const campo = ref<HTMLInputElement | null>(null);

function normalizar(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

const filtradas = computed(() => {
  const q = normalizar(filtro.value);
  return q === '' ? props.opciones : props.opciones.filter((o) => normalizar(o).includes(q));
});
const visibles = computed(() => filtradas.value.slice(0, MAX_VISIBLES));
const ocultas = computed(() => filtradas.value.length - visibles.value.length);

// Se compara con tolerancia a mayúsculas y tildes para no marcar en rojo un "SI" que en realidad
// corresponde a "Sí" — pero al elegir se guarda SIEMPRE el texto exacto de la opción del Excel.
const fueraDeLista = computed(
  () => props.value.trim() !== '' && !props.opciones.some((o) => normalizar(o) === normalizar(props.value)),
);
const coincidenciaExacta = computed(() => props.opciones.find((o) => normalizar(o) === normalizar(props.value)));

async function abrir() {
  if (!props.editable || abierto.value) return;
  abierto.value = true;
  filtro.value = '';
  resaltado.value = Math.max(visibles.value.indexOf(props.value), 0);
  await nextTick();
  campo.value?.focus();
}

function cerrar() {
  abierto.value = false;
  resaltado.value = -1;
}

function elegir(opcion: string) {
  emit('change', opcion);
  cerrar();
}

function mover(delta: number) {
  if (visibles.value.length === 0) return;
  const n = visibles.value.length;
  resaltado.value = (resaltado.value + delta + n) % n;
}

function onEnter() {
  const opcion = visibles.value[resaltado.value];
  if (opcion !== undefined) elegir(opcion);
  else cerrar();
}

// Cierre al hacer clic fuera. Se escucha en la fase de CAPTURA porque las tarjetas de campo tienen
// sus propios @click.stop y, en burbujeo, el evento nunca llegaría al documento.
function onDocClick(e: MouseEvent) {
  if (abierto.value && !raiz.value?.contains(e.target as Node)) cerrar();
}
onMounted(() => document.addEventListener('click', onDocClick, true));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick, true));

function alternar() {
  if (abierto.value) cerrar();
  else abrir();
}
</script>

<template>
  <div ref="raiz" class="relative">
    <button
      @click.stop="alternar"
      :disabled="!editable"
      type="button"
      class="w-full mt-1 px-2 py-1.5 rounded border bg-white text-sm text-left flex items-center gap-2 transition-colors disabled:cursor-default"
      :class="fueraDeLista
        ? 'border-amber-400 text-heading'
        : 'border-brand-200 text-heading hover:border-brand-400'"
    >
      <span v-if="value" class="flex-1 truncate">{{ value }}</span>
      <span v-else class="flex-1 text-gray-400">Elige una opción del Excel...</span>
      <FontAwesomeIcon
        v-if="editable"
        :icon="faChevronDown"
        class="w-2.5 h-2.5 text-gray-400 shrink-0 transition-transform"
        :class="abierto ? 'rotate-180' : ''"
      />
    </button>

    <p v-if="fueraDeLista" class="mt-1 text-[11px] text-amber-700 flex items-start gap-1">
      <FontAwesomeIcon :icon="faTriangleExclamation" class="w-2.5 h-2.5 shrink-0 mt-0.5" />
      <span>Este valor no está entre las opciones del Excel. Se escribirá igual, pero puede romper los campos que dependen de él.</span>
    </p>

    <div
      v-if="abierto"
      class="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden"
      @click.stop
    >
      <input
        ref="campo"
        v-model="filtro"
        @keydown.down.prevent="mover(1)"
        @keydown.up.prevent="mover(-1)"
        @keydown.enter.prevent="onEnter"
        @keydown.esc.prevent="cerrar"
        type="text"
        placeholder="Buscar..."
        class="w-full px-2.5 py-1.5 border-b border-gray-100 text-sm text-heading focus:outline-none"
      />
      <ul class="max-h-56 overflow-y-auto py-1">
        <li v-if="visibles.length === 0" class="px-2.5 py-2 text-xs text-muted italic">Sin coincidencias</li>
        <li
          v-for="(opcion, i) in visibles"
          :key="opcion + i"
          @click="elegir(opcion)"
          @mouseenter="resaltado = i"
          class="px-2.5 py-1.5 text-sm cursor-pointer flex items-center gap-2"
          :class="i === resaltado ? 'bg-brand-50 text-brand-800' : 'text-heading'"
        >
          <FontAwesomeIcon
            :icon="faCheck"
            class="w-2.5 h-2.5 shrink-0"
            :class="opcion === coincidenciaExacta ? 'text-brand-600' : 'opacity-0'"
          />
          <span class="truncate">{{ opcion }}</span>
        </li>
      </ul>
      <p v-if="ocultas > 0" class="px-2.5 py-1.5 border-t border-gray-100 text-[11px] text-muted">
        y {{ ocultas }} más — escribe para filtrar
      </p>
    </div>
  </div>
</template>
