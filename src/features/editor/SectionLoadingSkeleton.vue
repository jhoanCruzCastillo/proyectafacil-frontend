<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faSpinner } from '@/lib/icons';

// Placeholder mientras se monta la sección real — evita que el remontaje de SectionContent (decenas
// de FieldCard, cada uno consultando su celda en el Excel vivo) se vea como una pantalla congelada.
// Ver useTransicionSeccion: el "cargando" se sostiene el tiempo justo para que el navegador pinte
// esto antes de arrancar ese trabajo síncrono.
defineProps<{
  /** Cantidad de campos de la sección — ya se conoce sin montarla, así que se muestra de una */
  cantidadCampos?: number;
}>();
</script>

<template>
  <div class="mb-10" role="status" aria-label="Cargando sección">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-2 text-sm font-semibold text-brand-600">
        <FontAwesomeIcon :icon="faSpinner" class="w-4 h-4 animate-spin" />
        Cargando sección...
      </div>
      <span v-if="cantidadCampos !== undefined" class="text-xs text-muted">{{ cantidadCampos }} campos</span>
    </div>
    <div class="space-y-3 animate-pulse">
      <div v-for="i in 5" :key="i" class="rounded-xl border border-gray-100 p-4 flex items-start gap-3">
        <div class="w-8 h-8 rounded-lg bg-gray-100 shrink-0" />
        <div class="flex-1 min-w-0 space-y-2">
          <div class="h-3.5 bg-gray-100 rounded w-2/3" />
          <div class="h-2.5 bg-gray-100 rounded w-1/3" />
          <div class="h-9 bg-gray-50 rounded-lg mt-3" />
        </div>
        <div class="w-6 h-6 rounded bg-gray-100 shrink-0" />
      </div>
    </div>
  </div>
</template>
