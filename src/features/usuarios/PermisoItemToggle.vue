<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faStar } from '@/lib/icons';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';

defineProps<{
  etiqueta: string;
  descripcion: string;
  icon: IconDefinition;
  iconBgClass: string;
  activo: boolean;
  /** true = está activo y es una excepción fuera del rol base de la persona (o apagado a mano). */
  esExtra?: boolean;
}>();
const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-3">
    <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" :class="iconBgClass">
      <FontAwesomeIcon :icon="icon" class="w-4 h-4" />
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-semibold text-heading flex items-center gap-1.5">
        {{ etiqueta }}
        <FontAwesomeIcon v-if="esExtra && activo" :icon="faStar" class="w-3 h-3 text-amber-500" />
      </p>
      <p class="text-xs text-muted">{{ descripcion }}</p>
    </div>
    <div class="flex flex-col items-end gap-1 shrink-0">
      <button
        type="button"
        role="switch"
        :aria-checked="activo"
        @click="emit('toggle')"
        class="relative w-11 h-6 rounded-full transition-colors duration-100"
        :class="activo ? 'bg-brand-500' : 'bg-gray-300'"
      >
        <span
          class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-100"
          :class="activo ? 'translate-x-[22px]' : 'translate-x-0.5'"
        />
      </button>
      <span v-if="esExtra" class="text-[10px] text-muted">{{ activo ? 'Activado manualmente' : 'Desactivado' }}</span>
    </div>
  </div>
</template>
