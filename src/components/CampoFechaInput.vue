<script setup lang="ts">
/**
 * Input de fecha con calendario nativo del navegador (`<input type="date">`), en vez del texto
 * plano que había antes — encontrado en vivo: fechas propuestas por la IA en "DD/MM/YYYY" (formato
 * peruano) se guardan igual como texto (ver excelWriter.ts/coerceValor, que ya sabe leer ese
 * formato), pero el input nativo de fecha solo entiende ISO "YYYY-MM-DD" — este componente hace la
 * conversión de ida y vuelta para no romper esa convención de almacenamiento.
 */
import { computed } from 'vue';
import { aFechaISO, fechaISOaDDMMYYYY } from '@/lib/conversionesExcel';

const props = withDefaults(
  defineProps<{
    value: string;
    editable?: boolean;
    error?: boolean;
  }>(),
  { editable: true, error: false },
);

const emit = defineEmits<{ change: [value: string] }>();

// Si el texto guardado no es una fecha reconocible (vacío, o algo que la IA/el usuario dejó a
// medias), el input nativo simplemente se ve vacío — no revienta ni fuerza un valor inventado.
const valorISO = computed(() => aFechaISO(props.value || '', false) ?? '');

function onInput(e: Event) {
  const iso = (e.target as HTMLInputElement).value;
  emit('change', iso ? fechaISOaDDMMYYYY(iso) : '');
}
</script>

<template>
  <input
    :value="valorISO"
    @input="onInput"
    :disabled="!editable"
    type="date"
    class="w-full mt-1 px-2 py-1.5 rounded border bg-white text-sm text-heading focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-muted"
    :class="error ? 'border-red-400 focus:ring-red-300 focus:border-red-400' : 'border-brand-200 focus:ring-brand-500/30 focus:border-brand-500'"
  />
</template>
