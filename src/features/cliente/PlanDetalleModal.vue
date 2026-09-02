<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faCheck, faLayerGroup, faHeadset, faUsers, faCalendarDays } from '@/lib/icons';
import PlanIcono from './PlanIcono.vue';
import type { Plan } from '@/types';

// Puramente informativo — pedido explícito del usuario, con referencia de diseño (cabecera con
// degradado + ícono del plan, ficha de "Qué incluye"/"Detalles" en dos columnas, CTA al pie).
// Solo usa datos reales del Plan (features/límites ya existentes en data/planes.ts) — nada
// inventado que no tenga un campo real detrás.
const props = defineProps<{
  isOpen: boolean;
  plan: Plan | null;
  subtitulo: string;
  esActual: boolean;
  esRecomendado: boolean;
  cargando: boolean;
}>();
const emit = defineEmits<{ close: []; elegir: [Plan] }>();

const GRADIENTE_POR_NIVEL: Record<number, string> = {
  0: 'from-gray-600 to-gray-800',
  1: 'from-brand-500 to-brand-700',
  2: 'from-purple-500 to-purple-700',
};

function elegir() {
  if (props.plan) emit('elegir', props.plan);
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen && plan" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[88vh] overflow-y-auto" @click.stop>
          <div class="relative p-6 bg-gradient-to-br text-white" :class="GRADIENTE_POR_NIVEL[plan.numeroNivel] ?? GRADIENTE_POR_NIVEL[0]">
            <span
              v-if="esRecomendado"
              class="absolute top-5 right-14 px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wide"
            >
              Más elegido
            </span>
            <button
              @click="emit('close')"
              type="button"
              class="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors duration-100"
            >
              <FontAwesomeIcon :icon="faXmark" />
            </button>

            <div class="flex items-center gap-4 pr-10">
              <div class="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <PlanIcono :numero-nivel="plan.numeroNivel" class="w-8 h-8" />
              </div>
              <div class="min-w-0">
                <p class="text-[11px] font-semibold uppercase tracking-widest text-white/70">Plan de membresía</p>
                <h2 class="text-2xl font-bold leading-tight">{{ plan.nombre }}</h2>
                <p class="text-[0.8rem] text-white/70 mt-0.5">{{ subtitulo }}</p>
              </div>
            </div>
          </div>

          <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p class="text-3xl font-bold text-heading">
                S/ {{ plan.precio }}
                <span class="text-sm font-normal text-muted">{{ plan.periodicidad === 'Único' ? '· pago único' : '/ mes' }}</span>
              </p>

              <h3 class="text-sm font-bold text-heading mt-5 mb-3">¿Qué incluye este plan?</h3>
              <ul class="space-y-2.5">
                <li v-for="(f, i) in plan.features" :key="i" class="flex items-start gap-2 text-[0.8rem] text-gray-600 leading-snug">
                  <FontAwesomeIcon :icon="faCheck" class="w-3 h-3 text-brand-500 mt-1 shrink-0" />
                  {{ f }}
                </li>
              </ul>
            </div>

            <div>
              <h3 class="text-sm font-bold text-heading mb-3">Detalles del plan</h3>
              <div class="rounded-lg border border-gray-200 divide-y divide-gray-100 text-[0.8rem]">
                <div class="p-3 flex items-center gap-2.5">
                  <FontAwesomeIcon :icon="faLayerGroup" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span class="text-muted">Plantillas simultáneas</span>
                  <span class="ml-auto font-medium text-heading">{{ plan.limiteFichasBase }}</span>
                </div>
                <div class="p-3 flex items-center gap-2.5">
                  <FontAwesomeIcon :icon="faHeadset" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span class="text-muted">Consultas de asesoría incluidas</span>
                  <span class="ml-auto font-medium text-heading">{{ plan.limiteConsultasBase }}</span>
                </div>
                <div class="p-3 flex items-center gap-2.5">
                  <FontAwesomeIcon :icon="faUsers" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span class="text-muted">Usuarios incluidos</span>
                  <span class="ml-auto font-medium text-heading">{{ plan.limiteUsuariosBase }}</span>
                </div>
                <div class="p-3 flex items-center gap-2.5">
                  <FontAwesomeIcon :icon="faCalendarDays" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span class="text-muted">Facturación</span>
                  <span class="ml-auto font-medium text-heading">{{ plan.periodicidad === 'Único' ? 'Pago único' : 'Mensual' }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="px-6 pb-6 pt-4 border-t border-gray-100 flex justify-end">
            <button
              v-if="esActual"
              type="button"
              disabled
              class="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-400 text-[0.8rem] font-semibold cursor-not-allowed flex items-center gap-2"
            >
              <FontAwesomeIcon :icon="faCheck" class="w-3.5 h-3.5" />
              Tu plan actual
            </button>
            <button
              v-else
              @click="elegir"
              :disabled="cargando"
              type="button"
              class="px-5 py-2.5 rounded-lg text-white text-[0.8rem] font-semibold disabled:opacity-60 transition-colors duration-75"
              :class="esRecomendado ? 'bg-brand-600 hover:bg-brand-700' : 'bg-gray-900 hover:bg-gray-800'"
            >
              {{ cargando ? 'Procesando…' : 'Elegir este plan' }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.pop-enter-active,
.pop-leave-active {
  transition: all 0.12s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.97) translateY(10px);
}
</style>
