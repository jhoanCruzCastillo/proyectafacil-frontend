<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faLock, faSearch, faPlus, faXmark, faArrowRight } from '@/lib/icons';
import { useGuardarContextoPaso, useEliminarContextoPaso } from '@/composables/useContextosIA';
import { useUiStore } from '@/stores/ui';
import type { ContextosIAPlantilla } from '@/types';

// Vista de "Estructura": exterioriza a través de una UI qué insumo puntual consume cada paso del
// armado del prompt de sistema. El ORDEN/FLUJO de los 8 pasos sigue fijo en
// LlenadoIAController::construirSistema()/construirSistemaTabla() — eso NO cambia acá. Lo único que
// se vuelve configurable es QUÉ insumo llena cada uno de los pasos 1/2/4/5 (ver PASOS_ASIGNABLES en
// el backend); si el admin no asigna nada, el backend cae solo al comportamiento de siempre (buscar
// por nombre reservado / traer todos los generales), así que esta pantalla puede empezar vacía sin
// romper ningún llenado real.
const props = defineProps<{ plantillaId: string; contextos: ContextosIAPlantilla }>();
const emit = defineEmits<{ irAGuias: [] }>();

type EstadoPaso = 'editable' | 'codigo' | 'fuente' | 'preview';
interface PasoDef { n: number; titulo: string; desc: string; estado: EstadoPaso }

const PASOS: PasoDef[] = [
  { n: 1, titulo: 'Rol del asistente', desc: 'Quién es la IA — el encuadre inicial, va siempre primero en el prompt.', estado: 'editable' },
  { n: 2, titulo: 'Prompt del sistema', desc: 'Cómo debe comportarse la IA en general, para cualquier ficha de este formato.', estado: 'editable' },
  { n: 3, titulo: 'Contrato de salida (JSON)', desc: 'La forma exacta del JSON que la IA debe responder en cada llamada.', estado: 'codigo' },
  { n: 4, titulo: 'Reglas de llenado automático', desc: 'Qué campos NO se llenan con IA y otras reglas de comportamiento del llenado.', estado: 'editable' },
  { n: 5, titulo: 'Contexto general de la ficha', desc: 'De qué trata esta ficha — terminología, alcance, guía de llenado campo por campo.', estado: 'editable' },
  { n: 6, titulo: 'Fuente de la verdad', desc: 'Los documentos y el texto que el propio cliente carga en la ficha que se está llenando.', estado: 'fuente' },
  { n: 7, titulo: 'Guía de esta sección', desc: 'Instrucciones puntuales para la sección que se está llenando en este momento.', estado: 'preview' },
  { n: 8, titulo: 'Reglas globales de la sección', desc: 'Reglas globales que el admin asoció a la sección en curso.', estado: 'preview' },
];
const MENSAJE_ESTADO: Record<Exclude<EstadoPaso, 'editable'>, string> = {
  codigo: 'Este paso es el contrato de salida JSON: está fijo en el código porque el resto del sistema depende de esa forma exacta. No se puede ni se debe editar ni asignar un insumo aquí.',
  fuente: 'Este paso es lo que el propio cliente envía — los documentos y el texto que carga en "Fuente de la verdad" de cada ficha real. No es un insumo que el admin redacte ni seleccione desde aquí.',
  preview: 'Este paso se edita desde el pilar "Guías por sección". Aquí solo puedes ver su rol en el armado — no se selecciona ningún insumo desde esta pantalla.',
};

const pasoActivoN = ref(1);
const pasoActivo = computed(() => PASOS.find((p) => p.n === pasoActivoN.value)!);
const esAsignable = computed(() => pasoActivo.value.estado === 'editable');

const asignacionesPaso = computed(() => props.contextos.pasos.filter((a) => a.paso === pasoActivoN.value));
// Cuando el paso no tiene ninguna asignación explícita, esto es lo que el sistema usa en cada
// llamada real (ver pasosFallback() en el backend — mismo criterio que rolAsistente()/
// promptDelSistemaDe()/reglasLlenado() de LlenadoIAController). Sin esto, un paso sin tocar se veía
// como "vacío" cuando en realidad SÍ tiene contenido real llenándolo.
const fallbackPaso = computed(() => props.contextos.pasosFallback.filter((f) => f.paso === pasoActivoN.value));

const busqueda = ref('');
const catalogo = computed(() => [
  ...props.contextos.generales.map((g) => ({ tipo: 'general' as const, insumoId: g.id, nombre: g.nombre })),
  ...props.contextos.globales.map((g) => ({ tipo: 'global' as const, insumoId: g.id, nombre: g.nombre })),
]);
const catalogoFiltrado = computed(() => {
  const yaAsignados = new Set(asignacionesPaso.value.map((a) => `${a.tipo}:${a.insumoId}`));
  const q = busqueda.value.trim().toLowerCase();
  return catalogo.value
    .filter((i) => !yaAsignados.has(`${i.tipo}:${i.insumoId}`))
    .filter((i) => !q || i.nombre.toLowerCase().includes(q));
});

const ui = useUiStore();
const guardarPaso = useGuardarContextoPaso();
const eliminarPaso = useEliminarContextoPaso();

async function agregar(tipo: 'general' | 'global', insumoId: string) {
  try {
    await guardarPaso.mutateAsync({ plantillaId: props.plantillaId, paso: pasoActivoN.value, tipo, insumoId });
  } catch {
    ui.toast('No se pudo asignar el insumo', 'error');
  }
}

async function quitar(asignacionId: string) {
  try {
    await eliminarPaso.mutateAsync({ plantillaId: props.plantillaId, asignacionId });
  } catch {
    ui.toast('No se pudo quitar el insumo', 'error');
  }
}
</script>

<template>
  <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[220px_1fr_300px] overflow-hidden">
    <!-- Columna 1: pasos -->
    <aside class="border-r border-gray-100 bg-white overflow-y-auto p-2 space-y-1">
      <button
        v-for="p in PASOS"
        :key="p.n"
        type="button"
        class="w-full text-left rounded-lg px-3 py-2.5 transition-colors flex items-start gap-2"
        :class="pasoActivoN === p.n ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-gray-50 border border-transparent'"
        @click="pasoActivoN = p.n"
      >
        <span
          class="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
          :class="p.estado === 'editable' ? 'bg-violet-100 text-violet-700' : 'bg-gray-200 text-muted'"
        >
          <FontAwesomeIcon v-if="p.estado !== 'editable'" :icon="faLock" class="w-2.5 h-2.5" />
          <template v-else>{{ p.n }}</template>
        </span>
        <span class="text-xs font-medium text-heading leading-snug">Paso {{ p.n }} — {{ p.titulo }}</span>
      </button>
    </aside>

    <!-- Columna 2: insumos del paso seleccionado -->
    <div class="flex flex-col min-h-0 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100 bg-white shrink-0">
        <h3 class="text-sm font-bold text-heading">
          Paso {{ pasoActivo.n }} — {{ pasoActivo.titulo }}
          <span v-if="esAsignable && asignacionesPaso.length > 0" class="ml-1 font-normal text-muted">
            · {{ asignacionesPaso.length }} {{ asignacionesPaso.length === 1 ? 'insumo asignado' : 'insumos asignados' }}
          </span>
          <span v-else-if="esAsignable" class="ml-1 font-normal text-amber-700">
            · usando el de por defecto
          </span>
        </h3>
        <p class="text-[11px] text-muted mt-1 leading-relaxed">{{ pasoActivo.desc }}</p>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <div v-if="!esAsignable" class="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-3">
          <p class="text-xs text-muted leading-relaxed flex items-start gap-2">
            <FontAwesomeIcon :icon="faLock" class="w-3 h-3 mt-0.5 shrink-0" />
            {{ MENSAJE_ESTADO[pasoActivo.estado as Exclude<EstadoPaso, 'editable'>] }}
          </p>
          <button
            v-if="pasoActivo.estado === 'preview'"
            type="button"
            class="text-xs font-semibold text-violet-700 hover:text-violet-800 flex items-center gap-1.5"
            @click="emit('irAGuias')"
          >
            Ir a Guías por sección
            <FontAwesomeIcon :icon="faArrowRight" class="w-3 h-3" />
          </button>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="a in asignacionesPaso"
            :key="a.id"
            class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5"
          >
            <div class="min-w-0">
              <div class="text-xs font-medium text-heading truncate">{{ a.nombre }}</div>
              <span
                class="inline-block mt-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                :class="a.tipo === 'general' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'"
              >
                {{ a.tipo === 'general' ? 'De esta ficha' : 'Global' }}
              </span>
            </div>
            <button
              type="button"
              class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Quitar de este paso"
              @click="quitar(a.id)"
            >
              <FontAwesomeIcon :icon="faXmark" class="w-3.5 h-3.5" />
            </button>
          </div>
          <div v-if="asignacionesPaso.length === 0" class="space-y-2">
            <p class="text-[11px] font-semibold text-muted uppercase tracking-wide px-1">
              Usando por defecto (sin asignación explícita)
            </p>
            <div
              v-for="f in fallbackPaso"
              :key="`${f.tipo}:${f.insumoId}`"
              class="flex items-center justify-between gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5"
            >
              <div class="min-w-0">
                <div class="text-xs font-medium text-heading truncate">{{ f.nombre }}</div>
                <span
                  class="inline-block mt-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                  :class="f.tipo === 'general' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'"
                >
                  {{ f.tipo === 'general' ? 'De esta ficha' : 'Global' }}
                </span>
              </div>
            </div>
            <p v-if="fallbackPaso.length > 0" class="text-xs text-muted px-1 py-1">
              Para tomar control, agrega este mismo insumo (u otro) desde la columna de la derecha.
            </p>
            <p v-else class="text-xs text-amber-700 px-1 py-1">
              No hay ningún insumo de respaldo configurado — este paso quedará vacío en el prompt real
              hasta que asignes uno desde la derecha.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Columna 3: catálogo de insumos para asignar -->
    <aside class="border-l border-gray-100 bg-white flex flex-col min-h-0">
      <div class="p-3 border-b border-gray-100">
        <div class="relative">
          <FontAwesomeIcon :icon="faSearch" class="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            v-model="busqueda"
            type="search"
            placeholder="Buscar insumo…"
            :disabled="!esAsignable"
            class="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-violet-400 disabled:bg-gray-50"
          />
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <p v-if="!esAsignable" class="text-xs text-muted px-3 py-2">
          Este paso no admite insumos — selecciona uno de los pasos habilitados a la izquierda.
        </p>
        <template v-else>
          <button
            v-for="i in catalogoFiltrado"
            :key="`${i.tipo}:${i.insumoId}`"
            type="button"
            class="w-full text-left rounded-lg px-3 py-2 hover:bg-violet-50 transition-colors flex items-center justify-between gap-2"
            @click="agregar(i.tipo, i.insumoId)"
          >
            <span class="min-w-0">
              <span class="block text-xs font-medium text-heading truncate">{{ i.nombre }}</span>
              <span class="text-[9px] font-semibold uppercase tracking-wide" :class="i.tipo === 'general' ? 'text-slate-500' : 'text-amber-700'">
                {{ i.tipo === 'general' ? 'De esta ficha' : 'Global' }}
              </span>
            </span>
            <FontAwesomeIcon :icon="faPlus" class="w-3 h-3 text-violet-600 shrink-0" />
          </button>
          <p v-if="catalogoFiltrado.length === 0" class="text-xs text-muted px-3 py-2">
            No hay insumos que coincidan (o ya están todos asignados a este paso).
          </p>
        </template>
      </div>
    </aside>
  </div>
</template>
