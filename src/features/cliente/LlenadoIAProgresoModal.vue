<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faWandMagicSparkles, faCircleCheck, faTriangleExclamation, faSpinner } from '@/lib/icons';
import { tiempoRelativo } from '@/lib/tiempoRelativo';
import type { TrabajoLlenadoIA } from '@/api/contracts/llenadoIAAsync';

const props = defineProps<{
  isOpen: boolean;
  trabajo: TrabajoLlenadoIA | null;
}>();

const emit = defineEmits<{ close: []; cancelar: [] }>();

const puedeCancel = computed(() => props.trabajo?.estado === 'pendiente' || props.trabajo?.estado === 'procesando');

// El backend no siempre sabe el total de antemano (llenarFicha() recién arma el lote completo al
// procesar) — sin camposTotales se muestra una barra "indeterminada" en vez de un % inventado.
const porcentaje = computed(() => {
  const t = props.trabajo;
  if (!t || !t.camposTotales) return null;
  return Math.min(100, Math.round((t.camposCompletados / t.camposTotales) * 100));
});

const mensajeEstado = computed(() => {
  const t = props.trabajo;
  if (!t) return '';
  if (t.estado === 'pendiente') return 'En cola — se procesará en los próximos minutos.';
  if (t.estado === 'procesando') return t.progresoTexto || 'Procesando…';
  if (t.estado === 'completado') return `Listo — ${t.camposCompletados} campos completados.`;
  if (t.estado === 'error') return t.error || 'Terminó con un error.';
  return '';
});
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-md p-6" @click.stop>
          <div class="flex items-start gap-4">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              :class="trabajo?.estado === 'error' ? 'bg-red-100 text-red-600' : trabajo?.estado === 'completado' ? 'bg-green-100 text-green-600' : 'bg-violet-100 text-violet-600'"
            >
              <FontAwesomeIcon
                :icon="trabajo?.estado === 'error' ? faTriangleExclamation : trabajo?.estado === 'completado' ? faCircleCheck : faWandMagicSparkles"
                class="w-4 h-4"
              />
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-lg font-bold text-heading mb-1">Llenado con IA</h2>
              <p v-if="trabajo" class="text-sm text-muted leading-relaxed">{{ mensajeEstado }}</p>
              <p v-if="trabajo" class="text-xs text-muted/80 mt-1">Iniciado {{ tiempoRelativo(trabajo.creadoEn) }}</p>
              <div v-if="trabajo" class="mt-2 flex flex-wrap gap-1.5">
                <span
                  v-if="!trabajo.secciones || trabajo.secciones.length === 0"
                  class="text-[11px] font-medium text-violet-700 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5"
                >
                  Toda la ficha
                </span>
                <span
                  v-for="nombre in trabajo.secciones"
                  :key="nombre"
                  class="text-[11px] font-medium text-violet-700 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5"
                >
                  {{ nombre }}
                </span>
              </div>
            </div>
          </div>

          <div v-if="trabajo && (trabajo.estado === 'pendiente' || trabajo.estado === 'procesando')" class="mt-6">
            <div v-if="porcentaje !== null" class="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div class="h-full bg-violet-600 rounded-full transition-[width] duration-300 ease-out" :style="{ width: `${porcentaje}%` }" />
            </div>
            <!-- Sin total conocido todavía: barra indeterminada (mismo patrón visual que un spinner,
                 pero como franja) en vez de mostrar un % inventado. -->
            <div v-else class="h-2 rounded-full bg-gray-100 overflow-hidden relative">
              <div class="h-full w-1/3 bg-violet-600 rounded-full pf-indeterminada" />
            </div>
            <div class="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
              <span class="truncate flex items-center gap-1.5">
                <FontAwesomeIcon :icon="faSpinner" class="w-3 h-3 animate-spin" />
                {{ trabajo.camposCompletados > 0 ? `${trabajo.camposCompletados} campos completados` : 'Preparando…' }}
              </span>
              <span v-if="porcentaje !== null" class="shrink-0 font-medium tabular-nums">{{ porcentaje }}%</span>
            </div>
          </div>

          <p class="mt-5 text-xs text-muted bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5">
            Puedes seguir navegando, cerrar esta ficha o incluso cerrar sesión — el llenado sigue corriendo en el servidor.
            Te avisaremos por correo y en la campanita de notificaciones cuando termine.
          </p>

          <div class="flex justify-end gap-3 mt-6">
            <button
              v-if="puedeCancel"
              @click="emit('cancelar')"
              type="button"
              class="px-5 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors duration-75"
            >
              Cancelar llenado
            </button>
            <button
              @click="emit('close')"
              type="button"
              class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors duration-75"
            >
              Cerrar
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
@keyframes pf-indeterminada {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
.pf-indeterminada {
  animation: pf-indeterminada 1.2s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .pf-indeterminada { animation-duration: 3s; }
}
</style>
