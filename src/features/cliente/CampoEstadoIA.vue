<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faCircleCheck, faWandMagicSparkles, faCircleQuestion, faCircleXmark,
  faEye, faPlus, faCheck,
} from '@/lib/icons';
import type { EstadoCampoIA } from '@/types';

defineProps<{
  estado: EstadoCampoIA;
  /** false = solo lectura (sin botón de acción) */
  editable?: boolean;
}>();

const emit = defineEmits<{
  'ver-detalle': [];
  confirmar: [];
  'agregar-valor': [];
}>();

const BADGE: Record<EstadoCampoIA, { label: string; clase: string; icon: typeof faCircleCheck }> = {
  extraido: {
    label: 'Extraído',
    clase: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    icon: faCircleCheck,
  },
  inferido: {
    label: 'Inferido',
    clase: 'bg-amber-50 text-amber-700 border-amber-100',
    icon: faWandMagicSparkles,
  },
  requiere_confirmacion: {
    label: 'Requiere confirmación',
    clase: 'bg-sky-50 text-sky-700 border-sky-100',
    icon: faCircleQuestion,
  },
  no_encontrado: {
    label: 'No encontrado',
    clase: 'bg-rose-50 text-rose-700 border-rose-100',
    icon: faCircleXmark,
  },
};
</script>

<template>
  <div class="flex items-center gap-2 shrink-0" @click.stop>
    <span
      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap"
      :class="BADGE[estado].clase"
    >
      <FontAwesomeIcon :icon="BADGE[estado].icon" class="w-3 h-3" />
      {{ BADGE[estado].label }}
    </span>

    <template v-if="editable !== false">
      <button
        v-if="estado === 'extraido' || estado === 'inferido'"
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-heading hover:bg-gray-50 transition-colors"
        @click="emit('ver-detalle')"
      >
        <FontAwesomeIcon :icon="faEye" class="w-3 h-3 text-gray-500" />
        Ver detalle
      </button>
      <button
        v-else-if="estado === 'requiere_confirmacion'"
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 transition-colors"
        @click="emit('confirmar')"
      >
        <FontAwesomeIcon :icon="faCheck" class="w-3 h-3" />
        Confirmar
      </button>
      <button
        v-else
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-heading hover:bg-gray-50 transition-colors"
        @click="emit('agregar-valor')"
      >
        <FontAwesomeIcon :icon="faPlus" class="w-3 h-3 text-gray-500" />
        Agregar valor
      </button>
    </template>
  </div>
</template>
