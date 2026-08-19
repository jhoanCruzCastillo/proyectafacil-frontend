<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faXmark, faWandMagicSparkles, faCircleCheck, faSpinner, faClock,
  faInfoCircle, faChevronRight, faTriangleExclamation,
} from '@/lib/icons';

export type EstadoSeccionProgreso = 'completada' | 'procesando' | 'pendiente' | 'error';

export interface SeccionProgresoIA {
  id: string;
  nombre: string;
  estado: EstadoSeccionProgreso;
  campos?: number;
  llenados?: number;
  /** Solo nombres/etiquetas de campos con valor propuesto (sin el dato). */
  camposLlenadosNombres?: string[];
}

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    secciones: SeccionProgresoIA[];
    /** idle no debería abrirse; procesando | completado | error */
    fase: 'procesando' | 'completado' | 'error';
    mensajeError?: string | null;
    /** true = barra visual en la última sección, aún esperando el POST del backend */
    esperandoServidor?: boolean;
    /** 'tablas' = esta corrida es la segunda fase (tablas de las secciones que se acaban de llenar,
     * no secciones nuevas) — cambia los textos para que no parezca que aparecieron más secciones de
     * las que el usuario eligió. Encontrado en vivo: con 'secciones' fijo, alguien que eligió 2
     * secciones veía "4" ítems en esta lista (las 4 tablas de esas 2 secciones) sin ninguna pista de
     * qué eran. */
    modo?: 'secciones' | 'tablas';
  }>(),
  { modo: 'secciones' },
);

const emit = defineEmits<{ close: []; 'ver-resultados': []; cancelar: [] }>();

const expandidaId = ref<string | null>(null);

const total = computed(() => props.secciones.length);
const completadas = computed(() => props.secciones.filter((s) => s.estado === 'completada').length);
const porcentaje = computed(() => {
  if (total.value === 0) return 0;
  if (props.fase === 'completado') return 100;
  // La sección en curso cuenta la mitad para que la barra se mueva antes de cerrar.
  const parcial = props.secciones.some((s) => s.estado === 'procesando') ? 0.5 : 0;
  return Math.min(99, Math.round(((completadas.value + parcial) / total.value) * 100));
});

const tiempoEstimado = computed(() => {
  if (props.fase !== 'procesando') return null;
  const restantes = props.secciones.filter((s) => s.estado === 'pendiente' || s.estado === 'procesando').length;
  if (restantes <= 1) return 'Casi listo…';
  if (restantes <= 2) return 'Menos de 1 minuto';
  if (restantes <= 6) return '1 - 3 minutos más';
  if (restantes <= 12) return '3 - 6 minutos más';
  return 'Varios minutos más';
});

const tituloEstado = computed(() => {
  if (props.fase === 'error') return 'El procesamiento se interrumpió';
  if (props.fase === 'completado') return 'Procesamiento finalizado';
  return props.modo === 'tablas'
    ? 'Ya se llenaron los textos — ahora la IA propone valores para las tablas de esas secciones.'
    : 'La IA está analizando tus documentos, sección por sección.';
});

const tituloLista = computed(() => (props.modo === 'tablas' ? 'Progreso por tabla' : 'Progreso por sección'));

function toggleExpand(id: string) {
  expandidaId.value = expandidaId.value === id ? null : id;
}

function etiquetaEstado(estado: EstadoSeccionProgreso, _esUltima: boolean): string {
  if (estado === 'completada') return 'Completada';
  if (estado === 'procesando') return 'Procesando…';
  if (estado === 'error') return 'Con error';
  return 'Pendiente';
}

function numeroSeccion(idx: number): string {
  return String(idx + 1).padStart(2, '0');
}
</script>

<template>
  <Transition name="fade">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click="emit('close')"
    >
      <Transition name="pop" appear>
        <div
          class="bg-white rounded-2xl shadow-modal w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
          @click.stop
        >
          <div class="flex items-start justify-between p-6 pb-4">
            <div class="flex items-start gap-3 min-w-0">
              <div class="w-10 h-10 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <h2 class="text-lg font-bold text-heading flex items-center gap-2 flex-wrap">
                  Procesamiento con IA
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-200 text-violet-700 tracking-wide">BETA</span>
                </h2>
                <p class="text-sm text-muted mt-0.5">{{ tituloEstado }}</p>
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

          <div class="px-6 pb-4 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div>
              <div class="flex items-center gap-3">
                <div class="flex-1 h-2.5 rounded-full bg-violet-100 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-violet-600 transition-[width] duration-500 ease-out"
                    :style="{ width: `${porcentaje}%` }"
                  />
                </div>
                <span class="text-sm font-semibold text-heading tabular-nums shrink-0">{{ porcentaje }}% completado</span>
              </div>
              <p v-if="tiempoEstimado" class="text-xs text-muted mt-1.5">Tiempo estimado: {{ tiempoEstimado }}</p>
              <p v-else-if="fase === 'completado'" class="text-xs text-emerald-600 mt-1.5">
                {{ completadas }} de {{ total }} {{ modo === 'tablas' ? 'tablas procesadas' : 'secciones procesadas' }}
              </p>
              <p v-else-if="fase === 'error' && mensajeError" class="text-xs text-red-600 mt-1.5">{{ mensajeError }}</p>
            </div>

            <div>
              <p class="text-sm font-bold text-heading mb-2">{{ tituloLista }}</p>
              <div class="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                <div v-for="(s, idx) in secciones" :key="s.id">
                  <button
                    type="button"
                    class="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-gray-50/80 transition-colors"
                    @click="toggleExpand(s.id)"
                  >
                    <span
                      class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                      :class="s.estado === 'completada'
                        ? 'bg-emerald-100 text-emerald-700'
                        : s.estado === 'procesando'
                          ? 'bg-violet-100 text-violet-700'
                          : s.estado === 'error'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-500'"
                    >
                      {{ numeroSeccion(idx) }}
                    </span>
                    <span class="flex-1 min-w-0 text-sm font-medium text-heading truncate">{{ s.nombre }}</span>
                    <span
                      class="inline-flex items-center gap-1.5 text-xs font-medium shrink-0"
                      :class="s.estado === 'completada'
                        ? 'text-emerald-600'
                        : s.estado === 'procesando'
                          ? 'text-violet-600'
                          : s.estado === 'error'
                            ? 'text-red-600'
                            : 'text-gray-400'"
                    >
                      <FontAwesomeIcon
                        v-if="s.estado === 'completada'"
                        :icon="faCircleCheck"
                        class="w-3.5 h-3.5"
                      />
                      <FontAwesomeIcon
                        v-else-if="s.estado === 'procesando'"
                        :icon="faSpinner"
                        class="w-3.5 h-3.5 animate-spin"
                      />
                      <FontAwesomeIcon
                        v-else-if="s.estado === 'error'"
                        :icon="faTriangleExclamation"
                        class="w-3.5 h-3.5"
                      />
                      <FontAwesomeIcon
                        v-else
                        :icon="faClock"
                        class="w-3.5 h-3.5"
                      />
                      {{ etiquetaEstado(s.estado, idx === secciones.length - 1) }}
                    </span>
                    <FontAwesomeIcon
                      :icon="faChevronRight"
                      class="w-3 h-3 text-gray-300 transition-transform"
                      :class="expandidaId === s.id ? 'rotate-90' : ''"
                    />
                  </button>
                  <div
                    v-if="expandidaId === s.id || (s.estado === 'completada' && s.camposLlenadosNombres)"
                    class="px-3.5 pb-3 pl-[3.25rem] text-xs"
                  >
                    <template v-if="s.estado === 'completada' && s.camposLlenadosNombres">
                      <p class="font-semibold text-muted mb-1.5">
                        Campos llenados
                        <span class="font-normal">({{ s.camposLlenadosNombres.length }})</span>
                      </p>
                      <ul v-if="s.camposLlenadosNombres.length > 0" class="space-y-1">
                        <li
                          v-for="nombre in s.camposLlenadosNombres"
                          :key="nombre"
                          class="text-heading flex items-start gap-1.5"
                        >
                          <span class="text-emerald-500 mt-0.5 shrink-0">•</span>
                          <span>{{ nombre }}</span>
                        </li>
                      </ul>
                      <p v-else class="text-muted">Ningún campo con valor propuesto en esta sección.</p>
                    </template>
                    <template v-else-if="s.estado === 'completada'">
                      <p class="text-muted">Los nombres de los campos llenados aparecerán al terminar el análisis.</p>
                    </template>
                    <template v-else-if="s.estado === 'procesando'">
                      <p class="text-muted">{{ modo === 'tablas' ? 'Proponiendo valores para esta tabla…' : 'Analizando documentos y aplicando la guía de esta sección…' }}</p>
                    </template>
                    <template v-else-if="s.estado === 'error'">
                      <p class="text-muted">{{ modo === 'tablas' ? 'No se pudo completar esta tabla. Puedes reintentarla desde su propio botón "Llenar con IA".' : 'No se pudo completar esta sección. Revisa la fuente de la verdad e inténtalo de nuevo.' }}</p>
                    </template>
                    <template v-else>
                      <p class="text-muted">{{ modo === 'tablas' ? 'En cola. Se procesará cuando termine la tabla anterior.' : 'En cola. Se procesará cuando termine la sección anterior.' }}</p>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <div
              class="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
              :class="fase === 'procesando'
                ? 'bg-violet-50 border border-violet-100 text-violet-700'
                : fase === 'error'
                  ? 'bg-red-50 border border-red-100 text-red-700'
                  : 'bg-emerald-50 border border-emerald-100 text-emerald-700'"
            >
              <FontAwesomeIcon :icon="faInfoCircle" class="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span v-if="fase === 'procesando'">
                Puedes cerrar este modal; te notificaremos cuando el procesamiento finalice. Vuelve a abrirlo con
                <strong>Contexto IA</strong>.
              </span>
              <span v-else-if="fase === 'error'">
                Puedes cerrar y reabrir este aviso con <strong>Contexto IA</strong>, o volver a intentar desde la fuente de la verdad.
                Si hay campos sugeridos, ábrelos con <strong>Ver resumen</strong>.
              </span>
              <span v-else>
                El llenado terminó. Revisa el resumen de campos o continúa editando en la ficha.
              </span>
            </div>
          </div>

          <div class="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              class="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              @click="emit('close')"
            >
              Cerrar
            </button>
            <template v-if="fase === 'procesando'">
              <button
                type="button"
                class="px-5 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
                @click="emit('cancelar')"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled
                class="px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium opacity-80 cursor-not-allowed flex items-center gap-2"
              >
                <FontAwesomeIcon :icon="faSpinner" class="w-3.5 h-3.5 animate-spin" />
                Procesando…
              </button>
            </template>
            <button
              v-else-if="fase === 'completado' || (fase === 'error' && completadas > 0)"
              type="button"
              class="px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
              @click="emit('ver-resultados')"
            >
              Ver resultados
            </button>
            <button
              v-else
              type="button"
              class="px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
              @click="emit('close')"
            >
              Entendido
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
