<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faStar } from '@/lib/icons';
import PermisoItemToggle from './PermisoItemToggle.vue';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import type { PermisoId } from '@/types';

export interface ItemCategoriaPermiso {
  id: PermisoId;
  etiqueta: string;
  descripcion: string;
  icon: IconDefinition;
  activo: boolean;
}

defineProps<{
  titulo: string;
  descripcion: string;
  icon: IconDefinition;
  esExtra: boolean;
  borderClass: string;
  iconBgClass: string;
  tituloClass: string;
  itemIconBgClass: string;
  items: ItemCategoriaPermiso[];
}>();
const emit = defineEmits<{ toggle: [PermisoId] }>();
</script>

<template>
  <div class="rounded-xl border overflow-hidden" :class="borderClass">
    <div class="flex items-start gap-3 px-4 py-3.5">
      <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" :class="iconBgClass">
        <FontAwesomeIcon :icon="icon" class="w-4 h-4" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm flex items-center gap-2" :class="tituloClass">
          {{ titulo }}
          <span v-if="esExtra" class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            <FontAwesomeIcon :icon="faStar" class="w-2.5 h-2.5" />
            Permiso extra, fuera de su rol base
          </span>
        </p>
        <p class="text-xs text-muted">{{ descripcion }}</p>
      </div>
    </div>
    <div class="bg-white divide-y divide-gray-100 border-t" :class="borderClass">
      <PermisoItemToggle
        v-for="item in items"
        :key="item.id"
        :etiqueta="item.etiqueta"
        :descripcion="item.descripcion"
        :icon="item.icon"
        :icon-bg-class="itemIconBgClass"
        :activo="item.activo"
        :es-extra="esExtra"
        @toggle="emit('toggle', item.id)"
      />
    </div>
  </div>
</template>
