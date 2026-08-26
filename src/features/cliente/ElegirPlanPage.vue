<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faLayerGroup, faCheck } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import { useSessionStore } from '@/stores/session';
import { useCheckoutPlan } from '@/composables/usePagos';
import { useUiStore } from '@/stores/ui';
import { planes } from '@/data/planes';
import type { Plan } from '@/types';

// Página exclusiva para un cliente que se acaba de registrar y todavía no eligió ningún plan
// (Sesion.tienePlan === false — ver el guard en router/index.ts). A propósito NO usa
// useFacturacionQuery/GET facturacion/:id: ese endpoint auto-asigna Plan Nivel 1 + tarjeta de
// mentira la primera vez que se consulta (FacturacionController::crearDefault()), lo que le daría
// un plan "gratis" a cualquiera con solo abrir esta pantalla. Acá no hay plan actual que resaltar
// por definición — todos los planes se muestran como elegibles.
const session = useSessionStore();
const ui = useUiStore();
const checkoutPlan = useCheckoutPlan();

async function elegir(p: Plan) {
  const usuarioId = session.sesion?.usuarioId;
  if (!usuarioId) return;
  try {
    await checkoutPlan.mutateAsync({ usuarioId, planId: p.id });
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo iniciar el pago', 'error');
  }
}

function cargando(p: Plan): boolean {
  return checkoutPlan.isPending.value && checkoutPlan.variables.value?.planId === p.id;
}
</script>

<template>
  <PageShell
    :icon="faLayerGroup"
    title="Elige un plan para continuar"
    description="Tu cuenta ya está activa. Para acceder a formatos, fichas técnicas y asesorías, primero elige el plan que mejor se ajuste a lo que necesitas."
  >
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
      <div
        v-for="p in planes"
        :key="p.id"
        class="flex flex-col rounded-2xl border border-gray-200 p-5"
      >
        <p class="text-xs font-semibold uppercase tracking-widest text-brand-600">Nivel {{ p.numeroNivel }}</p>
        <p class="text-lg font-bold text-heading mb-1">{{ p.nombre }}</p>
        <p class="text-2xl font-bold text-heading">
          ${{ p.precio }}
          <span class="text-xs font-normal text-muted"> · {{ p.periodicidad }}</span>
        </p>
        <ul class="flex-1 space-y-2 my-5">
          <li v-for="(f, i) in p.features" :key="i" class="flex items-start gap-2 text-sm text-gray-600 leading-snug">
            <FontAwesomeIcon :icon="faCheck" class="w-3 h-3 text-brand-500 mt-1 shrink-0" />
            {{ f }}
          </li>
        </ul>
        <button
          @click="elegir(p)"
          :disabled="cargando(p)"
          type="button"
          class="px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors duration-75"
        >
          {{ cargando(p) ? 'Procesando…' : 'Elegir este plan' }}
        </button>
      </div>
    </div>
  </PageShell>
</template>
