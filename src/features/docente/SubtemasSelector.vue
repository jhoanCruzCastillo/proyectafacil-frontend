<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck, sectorIcons } from '@/lib/icons';
import type { Sector, SubtemaEspecialidad } from '@/types';

// Segundo nivel de "Temas de especialidad": los subtemas se agrupan bajo el sector al que
// pertenecen, y solo se muestran los grupos de sectores que el asesor ya marcó arriba.
const props = defineProps<{
  /** Solo los sectores seleccionados, en el orden del catálogo. */
  sectores: Sector[];
  /** Catálogo completo de subtemas (de todos los sectores). */
  subtemas: SubtemaEspecialidad[];
  seleccionados: Set<string>;
}>();

defineEmits<{ toggle: [subtemaId: string] }>();

const porSector = computed(() => {
  const mapa = new Map<string, SubtemaEspecialidad[]>();
  for (const s of props.subtemas) {
    const lista = mapa.get(s.sectorId);
    if (lista) lista.push(s);
    else mapa.set(s.sectorId, [s]);
  }
  return mapa;
});

const grupos = computed(() =>
  props.sectores
    .map((sector) => ({ sector, subtemas: porSector.value.get(sector.id) ?? [] }))
    .filter((g) => g.subtemas.length > 0),
);
</script>

<template>
  <p v-if="sectores.length === 0" class="text-sm text-muted">
    Primero elige al menos un sector arriba para poder afinar sus subtemas.
  </p>
  <p v-else-if="grupos.length === 0" class="text-sm text-muted">
    Los sectores que elegiste todavía no tienen subtemas registrados.
  </p>

  <div v-else class="space-y-6">
    <div v-for="grupo in grupos" :key="grupo.sector.id">
      <div class="flex items-center gap-2.5 mb-3">
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          :style="{ backgroundColor: grupo.sector.colorAccent + '18', color: grupo.sector.colorAccent }"
        >
          <FontAwesomeIcon v-if="sectorIcons[grupo.sector.icono]" :icon="sectorIcons[grupo.sector.icono]" class="w-4 h-4" />
        </div>
        <p class="text-sm font-semibold text-heading">
          {{ grupo.sector.nombre }}
          <span class="font-normal text-muted">({{ grupo.sector.codigo }})</span>
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="subtema in grupo.subtemas"
          :key="subtema.id"
          type="button"
          @click="$emit('toggle', subtema.id)"
          class="px-3 py-1.5 rounded-full border text-xs font-medium transition-colors duration-75 flex items-center gap-1.5"
          :class="seleccionados.has(subtema.id)
            ? 'bg-brand-600 border-brand-600 text-white hover:bg-brand-700'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'"
        >
          <FontAwesomeIcon
            :icon="faCheck"
            class="w-2.5 h-2.5 shrink-0"
            :class="seleccionados.has(subtema.id) ? 'text-white' : 'text-gray-300'"
          />
          {{ subtema.nombre }}
        </button>
      </div>
    </div>
  </div>
</template>
