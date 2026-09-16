<script setup lang="ts">
import { computed } from 'vue';
import { useActividadQuery } from '@/composables/useActividad';

const dotColors: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-brand-500',
  orange: 'bg-amber-500',
  gray: 'bg-gray-400',
  red: 'bg-red-500',
};

const { data: actividadData } = useActividadQuery();

// Manual de diseño v1.0, Figura 2: "eventos repetidos agrupados con badge '×5'" — colapsa filas
// consecutivas con el mismo mensaje (ej. "Se guardó el sector X" varias veces seguidas) en una
// sola, con un contador real en vez de mostrar la misma línea N veces.
const actividadAgrupada = computed(() => {
  const items = actividadData.value ?? [];
  const grupos: { id: string; mensaje: string; fecha: string; color: string; veces: number }[] = [];
  for (const item of items) {
    const anterior = grupos[grupos.length - 1];
    if (anterior && anterior.mensaje === item.mensaje && anterior.color === item.color) {
      anterior.veces++;
    } else {
      grupos.push({ id: item.id, mensaje: item.mensaje, fecha: item.fecha, color: item.color, veces: 1 });
    }
  }
  return grupos;
});
</script>

<template>
  <div>
    <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-4">Actividad reciente</h3>
    <div class="relative space-y-4">
      <div v-if="actividadAgrupada.length > 1" class="absolute left-[5px] top-2 bottom-2 w-px bg-border-light" />
      <div v-for="item in actividadAgrupada" :key="item.id" class="relative flex items-start gap-3">
        <span class="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ring-2 ring-white" :class="dotColors[item.color]" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-sm text-heading leading-snug">{{ item.mensaje }}</p>
            <span v-if="item.veces > 1" class="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-border-light text-muted">×{{ item.veces }}</span>
          </div>
          <p class="text-xs text-muted mt-0.5">{{ item.fecha }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
