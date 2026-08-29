<script setup lang="ts">
import { ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCrown, faBriefcase, faCheck, faStar } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import { useSessionStore } from '@/stores/session';
import { useCheckoutPlan } from '@/composables/usePagos';
import { useUiStore } from '@/stores/ui';
import { planes } from '@/data/planes';
import type { Plan } from '@/types';

// Página exclusiva para un cliente que todavía no eligió ningún plan (Sesion.tienePlan === false
// — ver el guard en router/index.ts, que fuerza esta pantalla sin importar a dónde intentó
// navegar). A propósito NO usa useFacturacionQuery/GET facturacion/:id: ese endpoint auto-asigna
// Plan Nivel 1 + tarjeta de mentira la primera vez que se consulta
// (FacturacionController::crearDefault()), lo que le daría un plan "gratis" a cualquiera con solo
// abrir esta pantalla. Acá no hay plan actual que resaltar por definición — todos se muestran como
// elegibles.
const session = useSessionStore();
const ui = useUiStore();
const checkoutPlan = useCheckoutPlan();

const tab = ref<'membresia' | 'adicionales'>('membresia');

// Sin este mapeo el "plan más recomendado" quedaría hardcodeado por posición en vez de por dato —
// se resalta el nivel intermedio (Profesional), igual criterio que cualquier tabla de precios.
function esRecomendado(p: Plan): boolean {
  return p.numeroNivel === 1;
}

function subtitulo(p: Plan): string {
  if (p.numeroNivel === 0) return 'Para practicar antes de tu proyecto real';
  if (p.numeroNivel === 1) return 'Para tu proyecto de inversión real';
  return 'Para equipos con varios proyectos a la vez';
}

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
    :icon="faCrown"
    title="Planes y servicios"
    description="Todavía no tienes ningún plan activo. Elige el que se ajuste a tu proyecto para desbloquear formatos, fichas técnicas y asesorías en vivo."
  >
    <div class="flex items-center gap-6 border-b border-gray-100 mb-8">
      <button
        @click="tab = 'membresia'"
        type="button"
        class="flex items-center gap-2 px-1 pb-3 border-b-2 text-sm font-semibold transition-colors duration-100"
        :class="tab === 'membresia' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'"
      >
        <FontAwesomeIcon :icon="faCrown" class="w-3.5 h-3.5" />
        Planes de membresía
      </button>
      <button
        @click="tab = 'adicionales'"
        type="button"
        class="flex items-center gap-2 px-1 pb-3 border-b-2 text-sm font-semibold transition-colors duration-100"
        :class="tab === 'adicionales' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'"
      >
        <FontAwesomeIcon :icon="faBriefcase" class="w-3.5 h-3.5" />
        Servicios adicionales
      </button>
    </div>

    <div v-if="tab === 'membresia'">
      <h2 class="text-lg font-bold text-heading mb-1">Elige tu plan ideal</h2>
      <p class="text-sm text-muted mb-6">Accede a más plantillas, asesorías y herramientas según el plan que elijas.</p>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div
          v-for="p in planes"
          :key="p.id"
          class="relative flex flex-col rounded-2xl border p-6"
          :class="esRecomendado(p) ? 'border-brand-300 shadow-lg shadow-brand-100/60' : 'border-gray-200'"
        >
          <span
            v-if="esRecomendado(p)"
            class="absolute -top-3 right-6 px-3 py-1 rounded-full bg-brand-600 text-white text-[10px] font-bold uppercase tracking-wide"
          >
            Más elegido
          </span>

          <div
            class="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
            :class="esRecomendado(p) ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500'"
          >
            <FontAwesomeIcon :icon="faStar" class="w-5 h-5" />
          </div>

          <p class="text-xs font-semibold uppercase tracking-widest text-brand-600">Nivel {{ p.numeroNivel }}</p>
          <p class="text-lg font-bold text-heading">{{ p.nombre }}</p>
          <p class="text-xs text-muted mb-4">{{ subtitulo(p) }}</p>

          <p class="text-3xl font-bold text-heading">
            ${{ p.precio }}
            <span class="text-sm font-normal text-muted"> {{ p.periodicidad === 'Único' ? '· pago único' : '/ mes' }}</span>
          </p>

          <ul class="flex-1 space-y-2.5 my-6">
            <li v-for="(f, i) in p.features" :key="i" class="flex items-start gap-2 text-sm text-gray-600 leading-snug">
              <FontAwesomeIcon :icon="faCheck" class="w-3 h-3 text-brand-500 mt-1 shrink-0" />
              {{ f }}
            </li>
          </ul>

          <button
            @click="elegir(p)"
            :disabled="cargando(p)"
            type="button"
            class="px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors duration-75"
            :class="esRecomendado(p) ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-gray-900 text-white hover:bg-gray-800'"
          >
            {{ cargando(p) ? 'Procesando…' : 'Elegir este plan' }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center text-center py-16 text-muted">
      <div class="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mb-4">
        <FontAwesomeIcon :icon="faBriefcase" class="w-5 h-5" />
      </div>
      <p class="text-sm font-medium text-heading">Servicios adicionales</p>
      <p class="text-xs text-muted mt-1 max-w-xs">Muy pronto vas a poder contratar consultoría 1 a 1 y otros servicios adicionales desde aquí.</p>
    </div>
  </PageShell>
</template>
