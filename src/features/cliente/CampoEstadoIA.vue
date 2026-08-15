<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faCircleCheck, faWandMagicSparkles, faCircleQuestion, faTriangleExclamation,
  faPlus, faCheck, faChevronDown,
} from '@/lib/icons';
import type { EstadoCampoIA } from '@/types';

defineProps<{
  estado: EstadoCampoIA;
  /** false = solo lectura (sin botón de acción) */
  editable?: boolean;
}>();

const emit = defineEmits<{
  confirmar: [];
  'agregar-valor': [];
}>();

/** Píldoras sólidas (mock de resultados IA): fondo lleno + texto blanco + chevron. */
const BADGE: Record<EstadoCampoIA, { label: string; clase: string; icon: typeof faCircleCheck }> = {
  extraido: {
    label: 'Extraído',
    clase: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25',
    icon: faCircleCheck,
  },
  inferido: {
    label: 'Inferido',
    clase: 'bg-sky-500 text-white shadow-sm shadow-sky-500/25',
    icon: faWandMagicSparkles,
  },
  requiere_confirmacion: {
    label: 'Requiere confirmación',
    clase: 'bg-amber-500 text-white shadow-sm shadow-amber-500/25',
    icon: faCircleQuestion,
  },
  no_encontrado: {
    label: 'No encontrado',
    clase: 'bg-rose-500 text-white shadow-sm shadow-rose-500/25',
    icon: faTriangleExclamation,
  },
};
</script>

<template>
  <div class="flex items-center gap-2 shrink-0" @click.stop>
    <span
      class="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
      :class="BADGE[estado].clase"
    >
      <FontAwesomeIcon :icon="BADGE[estado].icon" class="w-3 h-3" />
      {{ BADGE[estado].label }}
      <FontAwesomeIcon :icon="faChevronDown" class="w-2.5 h-2.5 opacity-80" />
    </span>

    <template v-if="editable !== false">
      <button
        v-if="estado === 'requiere_confirmacion'"
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
        @click="emit('confirmar')"
      >
        <FontAwesomeIcon :icon="faCheck" class="w-3 h-3" />
        Confirmar
      </button>
      <button
        v-else-if="estado === 'no_encontrado'"
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-white text-[11px] font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
        @click="emit('agregar-valor')"
      >
        <FontAwesomeIcon :icon="faPlus" class="w-3 h-3" />
        Agregar valor
      </button>
    </template>
  </div>
</template>
