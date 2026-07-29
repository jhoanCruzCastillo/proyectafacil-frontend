<script setup lang="ts">
import { computed, type MaybeRefOrGetter } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faFileInvoice, faArrowUpRightFromSquare } from '@/lib/icons';
import { useFacturacionQuery } from '@/composables/useFacturacion';
import { planes } from '@/data/planes';

const props = defineProps<{ usuarioId: MaybeRefOrGetter<string> }>();
const { data: facturacion } = useFacturacionQuery(props.usuarioId);

const plan = computed(() => planes.find((p) => p.id === facturacion.value?.planId));
</script>

<template>
  <div v-if="plan" class="flex items-center gap-3 rounded-lg bg-sky-50 border border-sky-100 px-4 py-3">
    <div class="w-9 h-9 rounded-lg bg-white text-sky-600 flex items-center justify-center shrink-0">
      <FontAwesomeIcon :icon="faFileInvoice" class="w-4 h-4" />
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-sky-700/70">Plan actual</p>
      <p class="text-sm font-bold text-heading">Nivel {{ plan.numeroNivel }} - {{ plan.nombre }}</p>
      <p class="text-xs text-muted">Este plan determina los límites y beneficios del usuario.</p>
    </div>
    <span class="flex items-center gap-1.5 text-xs font-medium text-sky-700 shrink-0" title="Aún no hay una vista de facturación por cliente">
      Ver en Facturación
      <FontAwesomeIcon :icon="faArrowUpRightFromSquare" class="w-3 h-3" />
    </span>
  </div>
</template>
