<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faWandMagicSparkles } from '@/lib/icons';

// Igual que VideoSesionCard.vue: extraído de TicketDetalleCompletadoModal.vue para que el cliente
// vea el mismo resumen de IA de su propia videollamada, sin duplicar el maquetado.
defineProps<{ resumenIaTexto?: string | null }>();
</script>

<template>
  <div class="flex flex-col p-4 rounded-xl bg-purple-50 border border-purple-200">
    <div class="flex items-center gap-2 mb-2">
      <div class="w-6 h-6 rounded-md bg-purple-100 text-purple-500 flex items-center justify-center shrink-0">
        <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3 h-3" />
      </div>
      <p class="text-xs font-semibold text-purple-700">Resumen generado por IA</p>
    </div>
    <p v-if="resumenIaTexto" class="text-sm text-heading leading-relaxed whitespace-pre-line">{{ resumenIaTexto }}</p>
    <p v-else class="text-sm text-muted italic my-auto text-center">El resumen todavía no está disponible — se genera automáticamente poco después de terminar la llamada.</p>
  </div>
</template>
