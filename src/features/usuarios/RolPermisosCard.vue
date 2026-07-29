<script setup lang="ts">
import { ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck, faChevronDown, faLock } from '@/lib/icons';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import type { PermisoId } from '@/types';

const props = defineProps<{
  titulo: string;
  descripcion?: string;
  icon: IconDefinition;
  borderClass: string;
  iconBgClass: string;
  tituloClass: string;
  checkClass: string;
  items: { id: PermisoId; etiqueta: string }[];
  modelValue: PermisoId[];
  locked?: boolean;
  lockedNote?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [PermisoId[]] }>();

const expandido = ref(true);

function toggle(id: PermisoId) {
  if (props.locked) return;
  const activo = props.modelValue.includes(id);
  emit('update:modelValue', activo ? props.modelValue.filter((p) => p !== id) : [...props.modelValue, id]);
}
</script>

<template>
  <div class="rounded-xl border p-5" :class="borderClass">
    <button type="button" @click="expandido = !expandido" class="w-full flex items-center gap-3 text-left">
      <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" :class="iconBgClass">
        <FontAwesomeIcon :icon="icon" class="w-4 h-4" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm" :class="tituloClass">{{ titulo }}</p>
        <p v-if="descripcion" class="text-xs text-muted">{{ descripcion }}</p>
      </div>
      <FontAwesomeIcon
        :icon="faChevronDown"
        class="w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-150"
        :class="expandido ? 'rotate-180' : ''"
      />
    </button>

    <div v-if="expandido" class="mt-4">
      <div v-if="locked" class="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-white/60 border border-amber-200/70 text-sm text-amber-800">
        <FontAwesomeIcon :icon="faLock" class="w-3.5 h-3.5 shrink-0" />
        {{ lockedNote }}
      </div>
      <div v-else class="flex flex-wrap gap-x-6 gap-y-3">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          @click="toggle(item.id)"
          class="flex items-center gap-2 text-sm font-medium text-heading"
        >
          <span
            class="w-5 h-5 rounded flex items-center justify-center border transition-colors duration-75 shrink-0"
            :class="modelValue.includes(item.id) ? checkClass : 'border-gray-300 bg-white'"
          >
            <FontAwesomeIcon v-if="modelValue.includes(item.id)" :icon="faCheck" class="w-3 h-3 text-white" />
          </span>
          {{ item.etiqueta }}
        </button>
      </div>
      <slot name="footer" />
    </div>
  </div>
</template>
