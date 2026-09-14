<script setup lang="ts">
import { ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronDown, faChevronUp, faXmark, faCircleInfo, sectorIcons } from '@/lib/icons';
import type { TemaEspecialidad, SubtemaEspecialidad } from '@/types';

// Panel derecho "Tu selección" del bloque "2. Temas de especialidad" — un grupo colapsable por tema
// con subtemas (sus subtemas marcados como chips removibles) y una fila simple por tema sin
// subtemas (removible de una). Puramente de presentación: toda la lógica de qué está marcado vive
// en la página, este componente solo dispara los mismos toggle que ya usa la lista de la izquierda
// para que ambos paneles queden siempre sincronizados.
const props = defineProps<{
  grupos: { sector: TemaEspecialidad; subtemas: SubtemaEspecialidad[] }[];
}>();

defineEmits<{
  quitarSector: [sectorId: string];
  quitarSubtema: [subtemaId: string];
}>();

const colapsados = ref<Set<string>>(new Set());
function toggleColapsar(sectorId: string) {
  const set = new Set(colapsados.value);
  if (set.has(sectorId)) set.delete(sectorId);
  else set.add(sectorId);
  colapsados.value = set;
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white">
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <p class="text-sm font-bold text-heading">Tu selección</p>
      <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700">
        {{ grupos.length }} tema{{ grupos.length === 1 ? '' : 's' }}
      </span>
    </div>

    <p v-if="grupos.length === 0" class="px-4 py-6 text-sm text-muted text-center">
      Todavía no seleccionaste ningún tema de especialidad.
    </p>

    <div v-else class="p-3 space-y-3 max-h-[520px] overflow-y-auto">
      <div v-for="grupo in grupos" :key="grupo.sector.id" class="rounded-lg border border-gray-100 overflow-hidden">
        <!-- Sector sin subtemas: fila simple, removible de una -->
        <div v-if="grupo.subtemas.length === 0" class="flex items-center gap-2.5 px-3 py-2.5">
          <div
            class="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            :style="{ backgroundColor: grupo.sector.colorAccent + '18', color: grupo.sector.colorAccent }"
          >
            <FontAwesomeIcon v-if="sectorIcons[grupo.sector.icono]" :icon="sectorIcons[grupo.sector.icono]" class="w-3 h-3" />
          </div>
          <p class="text-sm font-medium text-heading flex-1 min-w-0 truncate">{{ grupo.sector.nombre }}</p>
          <button
            @click="$emit('quitarSector', grupo.sector.id)"
            type="button"
            class="w-6 h-6 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-75 shrink-0"
          >
            <FontAwesomeIcon :icon="faXmark" class="w-3 h-3" />
          </button>
        </div>

        <!-- Sector con subtemas: grupo colapsable + chips removibles -->
        <template v-else>
          <button
            @click="toggleColapsar(grupo.sector.id)"
            type="button"
            class="w-full flex items-center gap-2.5 px-3 py-2.5 bg-gray-50/60 hover:bg-gray-50 transition-colors duration-75"
          >
            <div
              class="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
              :style="{ backgroundColor: grupo.sector.colorAccent + '18', color: grupo.sector.colorAccent }"
            >
              <FontAwesomeIcon v-if="sectorIcons[grupo.sector.icono]" :icon="sectorIcons[grupo.sector.icono]" class="w-3 h-3" />
            </div>
            <div class="flex-1 min-w-0 text-left">
              <p class="text-sm font-semibold text-heading truncate">{{ grupo.sector.nombre }}</p>
              <p class="text-[11px] text-muted">{{ grupo.subtemas.length }} subtema{{ grupo.subtemas.length === 1 ? '' : 's' }}</p>
            </div>
            <button
              @click.stop="$emit('quitarSector', grupo.sector.id)"
              type="button"
              class="w-6 h-6 rounded-md hover:bg-gray-200/70 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-75 shrink-0"
            >
              <FontAwesomeIcon :icon="faXmark" class="w-3 h-3" />
            </button>
            <FontAwesomeIcon
              :icon="colapsados.has(grupo.sector.id) ? faChevronDown : faChevronUp"
              class="w-2.5 h-2.5 text-gray-400 shrink-0"
            />
          </button>

          <div v-if="!colapsados.has(grupo.sector.id)" class="flex flex-wrap gap-1.5 p-3 pt-2.5">
            <span
              v-for="subtema in grupo.subtemas"
              :key="subtema.id"
              class="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-medium"
            >
              {{ subtema.nombre }}
              <button
                @click="$emit('quitarSubtema', subtema.id)"
                type="button"
                class="w-4 h-4 rounded-full hover:bg-brand-100 flex items-center justify-center transition-colors duration-75"
              >
                <FontAwesomeIcon :icon="faXmark" class="w-2 h-2" />
              </button>
            </span>
          </div>
        </template>
      </div>
    </div>

    <div v-if="grupos.length > 0" class="flex items-start gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-xl">
      <FontAwesomeIcon :icon="faCircleInfo" class="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
      <p class="text-[11px] text-muted">Puedes modificar tu selección en cualquier momento.</p>
    </div>
  </div>
</template>
