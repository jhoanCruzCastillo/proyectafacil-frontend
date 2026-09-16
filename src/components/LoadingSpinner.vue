<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faSpinner } from '@/lib/icons';

withDefaults(defineProps<{
  /** Clases extra del contenedor (p. ej. py-10, flex-1). */
  wrapperClass?: string;
  /** Tamaño del icono — default w-6 h-6. */
  sizeClass?: string;
}>(), {
  sizeClass: 'w-6 h-6',
});
</script>

<template>
  <div
    class="flex items-center justify-center text-muted"
    :class="wrapperClass"
    role="status"
    aria-label="Cargando"
  >
    <FontAwesomeIcon :icon="faSpinner" class="animate-spin text-brand-600" :class="sizeClass" />
  </div>
</template>
