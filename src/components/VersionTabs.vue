<script setup lang="ts">
import { computed } from 'vue';
import type { VersionTab } from '@/types';

const props = defineProps<{
  activeTab: VersionTab | null;
  /** Oculta el tab Proyecto (admin: no se usa; el cliente tiene su propia barra con «Mi ficha»). */
  disableProyecto?: boolean;
  /** true = variante para cabeceras oscuras (fondo transparente en vez de blanco) — ver EditorTopBar.vue */
  dark?: boolean;
}>();
const emit = defineEmits<{ change: [VersionTab] }>();

const tabs = computed(() => {
  const all: { key: VersionTab; label: string }[] = [
    { key: 'estructura', label: 'Estructura' },
    { key: 'ejemplos', label: 'Ejemplos' },
    { key: 'proyecto', label: 'Proyecto' },
  ];
  return props.disableProyecto ? all.filter((t) => t.key !== 'proyecto') : all;
});
</script>

<template>
  <div class="flex overflow-hidden" :class="dark ? '' : 'rounded-lg border border-gray-200'">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      @click="emit('change', tab.key)"
      type="button"
      class="px-5 py-2 text-sm font-medium transition-colors flex items-center gap-1.5"
      :class="
        activeTab === tab.key
          ? 'bg-brand-600 text-white'
          : dark ? 'text-white/70 hover:bg-white/10 hover:text-white bg-transparent' : 'text-gray-600 hover:bg-gray-50 bg-white'
      "
    >
      {{ tab.label }}
    </button>
  </div>
</template>
