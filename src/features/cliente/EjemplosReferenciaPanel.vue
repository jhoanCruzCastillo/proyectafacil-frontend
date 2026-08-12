<script setup lang="ts">
import { ref, computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faSearch, faCheck, faCircle, faInfoCircle } from '@/lib/icons';
import type { Ejemplo } from '@/types';

// Versión de solo lectura de ExamplesPanel.vue (el panel de ejemplos del editor de admin) — el
// cliente puede explorar los casos resueltos que preparó el administrador, pero no crearlos,
// editarlos ni eliminarlos: por eso no reutiliza ese componente tal cual, solo su lenguaje visual.
const props = defineProps<{
  ejemplos: Ejemplo[];
  activeEjemplo: Ejemplo | null;
}>();

const emit = defineEmits<{ select: [ejemplo: Ejemplo] }>();

const search = ref('');
const filtered = computed(() =>
  props.ejemplos.filter(
    (ej) => ej.nombre.toLowerCase().includes(search.value.toLowerCase()) || ej.subtitulo.toLowerCase().includes(search.value.toLowerCase()),
  ),
);
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="shrink-0 px-4 pt-4 pb-3">
      <span class="text-xs font-bold uppercase tracking-widest text-brand-600">
        Ejemplos · {{ ejemplos.length }}
      </span>
    </div>

    <div class="shrink-0 px-4 pb-3">
      <div class="relative">
        <FontAwesomeIcon :icon="faSearch" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
        <input
          v-model="search"
          type="text"
          placeholder="Buscar ejemplo..."
          class="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-2 pb-2">
      <button
        v-for="ej in filtered"
        :key="ej.id"
        @click="emit('select', ej)"
        type="button"
        class="w-full flex items-start gap-2.5 px-3 py-2.5 mb-1 rounded-lg text-left transition-colors duration-75"
        :class="activeEjemplo?.id === ej.id ? 'bg-brand-50 border border-brand-200' : 'border border-transparent hover:bg-gray-50'"
      >
        <FontAwesomeIcon :icon="faCircle" class="w-2 h-2 mt-1.5 shrink-0" :class="activeEjemplo?.id === ej.id ? 'text-green-500' : 'text-gray-300'" />
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-heading truncate">{{ ej.nombre }}</div>
          <div class="text-xs text-muted truncate">{{ ej.subtitulo }} · {{ ej.detalle }}</div>
        </div>
        <FontAwesomeIcon v-if="activeEjemplo?.id === ej.id" :icon="faCheck" class="w-3.5 h-3.5 text-brand-600 shrink-0" />
      </button>
      <p v-if="filtered.length === 0" class="px-3 py-6 text-center text-sm text-muted">No hay ejemplos que coincidan.</p>
    </div>

    <div class="shrink-0 border-t border-gray-100 px-4 py-3 flex items-start gap-2 text-[11px] text-muted">
      <FontAwesomeIcon :icon="faInfoCircle" class="w-3.5 h-3.5 text-brand-500 mt-0.5 shrink-0" />
      <span>Casos resueltos que preparó el administrador como guía para llenar tu ficha.</span>
    </div>
  </div>
</template>
