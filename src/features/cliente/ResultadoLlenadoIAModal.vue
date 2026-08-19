<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faXmark, faWandMagicSparkles, faCircleCheck, faTriangleExclamation,
  faCircleInfo, faEye, faChevronDown, faCircle, faTable,
} from '@/lib/icons';
import { fieldTypeIcons } from '@/lib/icons';
import { etiquetaTipoCorta, formatoConfianza } from '@/lib/resultadoLlenadoIA';
import type { CampoResultadoLlenadoIA, CategoriaResultadoCampoIA, ResumenResultadoLlenadoIA } from '@/types';

const props = defineProps<{
  isOpen: boolean;
  resumen: ResumenResultadoLlenadoIA | null;
}>();

const emit = defineEmits<{
  close: [];
  /** Cierra el modal para revisar campos en el editor (no termina la sesión IA). */
  revisar: [];
}>();

/** Filas visibles al abrir; el resto se revela con “Ver N campos más…”. */
const LIMITE_INICIAL = 8;
const expandido = ref(false);

watch(() => props.isOpen, (open) => {
  if (open) expandido.value = false;
});

const campos = computed(() => props.resumen?.campos ?? []);
const visibles = computed(() => (expandido.value ? campos.value : campos.value.slice(0, LIMITE_INICIAL)));
const ocultos = computed(() => Math.max(0, campos.value.length - LIMITE_INICIAL));

function claseValor(cat: CategoriaResultadoCampoIA): string {
  switch (cat) {
    case 'alta_confianza':
      return 'bg-emerald-50 border-emerald-200 text-emerald-900';
    case 'revision':
      return 'bg-amber-50 border-amber-200 text-amber-900';
    case 'ya_existian':
      return 'bg-sky-50 border-sky-200 text-sky-900';
    case 'sin_informacion':
      return 'bg-rose-50/60 border-rose-100 text-rose-400';
    default:
      return 'bg-gray-50 border-gray-200 text-gray-700';
  }
}

function claseConfianza(campo: CampoResultadoLlenadoIA): string {
  if (campo.categoria === 'sin_informacion') return 'text-rose-500';
  if (campo.categoria === 'ya_existian') return 'text-sky-600';
  if (campo.categoria === 'revision') return 'text-amber-600';
  if (campo.confianza == null) return 'text-emerald-600';
  if (campo.confianza >= 0.8) return 'text-emerald-600';
  if (campo.confianza >= 0.5) return 'text-amber-600';
  return 'text-rose-500';
}

function textoValor(campo: CampoResultadoLlenadoIA): string {
  if (campo.categoria === 'sin_informacion') return 'Sin información';
  return campo.valorPropuesto?.trim() || '—';
}
</script>

<template>
  <Transition name="fade">
    <div
      v-if="isOpen && resumen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click="emit('close')"
    >
      <Transition name="pop" appear>
        <div
          class="bg-white rounded-2xl shadow-modal w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
          @click.stop
        >
          <div class="flex items-start justify-between p-6 pb-4 shrink-0">
            <div class="flex items-start gap-3 min-w-0">
              <div class="w-10 h-10 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <h2 class="text-lg font-bold text-heading flex items-center gap-2 flex-wrap">
                  Campos sugeridos por la IA
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-200 text-violet-700 tracking-wide">BETA</span>
                </h2>
                <p class="text-sm text-muted mt-0.5">
                  La IA completó automáticamente estos campos con información extraída de tus documentos.
                </p>
                <p v-if="resumen.costoTotalUsd" class="text-[11px] text-muted mt-1 font-mono">
                  Costo estimado de esta sección: ${{ resumen.costoTotalUsd.toFixed(5) }}
                </p>
              </div>
            </div>
            <button
              type="button"
              class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              @click="emit('close')"
            >
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <div class="px-6 pb-4 space-y-5 overflow-y-auto flex-1 min-h-0">
            <div
              v-if="resumen.camposTablaOmitidos > 0"
              class="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 flex items-start gap-2.5"
            >
              <span class="w-8 h-8 rounded-lg bg-slate-200/80 text-slate-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faTable" class="w-3.5 h-3.5" />
              </span>
              <p class="text-sm text-heading leading-snug">
                <span class="font-bold">{{ resumen.camposTablaOmitidos }}</span>
                <span class="text-muted">
                  {{ resumen.camposTablaOmitidos === 1 ? ' campo tabla no se llena' : ' campos tabla no se llenan' }}
                  automáticamente todavía — complétalos a mano o pídele ayuda puntual al asesor de IA.
                </span>
              </p>
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div class="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-3 flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon :icon="faCircleCheck" class="w-3.5 h-3.5" />
                </span>
                <p class="text-sm text-heading leading-snug">
                  <span class="font-bold">{{ resumen.altaConfianza }}</span>
                  <span class="text-muted"> Listos para aplicar</span>
                </p>
              </div>
              <div class="rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-3 flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon :icon="faTriangleExclamation" class="w-3.5 h-3.5" />
                </span>
                <p class="text-sm text-heading leading-snug">
                  <span class="font-bold">{{ resumen.requierenRevision }}</span>
                  <span class="text-muted"> Requieren revisión</span>
                </p>
              </div>
              <div class="rounded-xl border border-sky-100 bg-sky-50/70 px-3.5 py-3 flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon :icon="faCircleInfo" class="w-3.5 h-3.5" />
                </span>
                <p class="text-sm text-heading leading-snug">
                  <span class="font-bold">{{ resumen.yaExistian }}</span>
                  <span class="text-muted"> Ya existían</span>
                </p>
              </div>
              <div class="rounded-xl border border-gray-200 bg-gray-50/80 px-3.5 py-3 flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-lg bg-gray-200/80 text-gray-500 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon :icon="faEye" class="w-3.5 h-3.5" />
                </span>
                <p class="text-sm text-heading leading-snug">
                  <span class="font-bold">{{ resumen.sinInformacion }}</span>
                  <span class="text-muted"> No detectados</span>
                </p>
              </div>
            </div>

            <div class="rounded-xl border border-gray-200 overflow-hidden">
              <div class="hidden sm:grid grid-cols-[minmax(0,1.35fr)_minmax(0,1.45fr)_100px] gap-3 px-3.5 py-2.5 bg-gray-50 text-[11px] font-semibold text-muted border-b border-gray-100">
                <span>Campo</span>
                <span>Valor sugerido por la IA</span>
                <span class="text-center">Confianza</span>
              </div>

              <div
                v-for="c in visibles"
                :key="c.id"
                class="grid grid-cols-1 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1.45fr)_100px] gap-2 sm:gap-3 px-3.5 py-3 border-b border-gray-50 last:border-0 items-center"
              >
                <div class="flex items-start gap-2.5 min-w-0">
                  <span class="mt-0.5 w-7 h-7 rounded-md bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon :icon="fieldTypeIcons[c.tipo]" class="w-3 h-3" />
                  </span>
                  <div class="min-w-0">
                    <p class="text-[11px] text-muted leading-none">
                      <span class="font-mono">{{ c.id }}</span>
                      <span class="mx-1">·</span>
                      <span>{{ etiquetaTipoCorta(c.tipo) }}</span>
                    </p>
                    <p class="text-sm text-heading mt-1 truncate" :title="c.etiqueta">{{ c.etiqueta }}</p>
                  </div>
                </div>

                <div
                  class="rounded-lg border px-3 py-2 text-sm truncate"
                  :class="claseValor(c.categoria)"
                  :title="textoValor(c)"
                >
                  {{ textoValor(c) }}
                </div>

                <div class="flex items-center sm:justify-center gap-1.5 text-sm font-semibold" :class="claseConfianza(c)">
                  <FontAwesomeIcon :icon="faCircle" class="w-2 h-2" />
                  <span>{{ formatoConfianza(c.confianza) }}</span>
                </div>
              </div>
            </div>

            <button
              v-if="ocultos > 0"
              type="button"
              class="text-sm font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1.5"
              @click="expandido = !expandido"
            >
              {{ expandido ? 'Ver menos' : `Ver ${ocultos} campos más detectados` }}
              <FontAwesomeIcon
                :icon="faChevronDown"
                class="w-3 h-3 transition-transform"
                :class="expandido ? 'rotate-180' : ''"
              />
            </button>
          </div>

          <div class="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              class="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              @click="emit('close')"
            >
              Cerrar
            </button>
            <button
              type="button"
              class="px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
              @click="emit('revisar')"
            >
              Revisar
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
