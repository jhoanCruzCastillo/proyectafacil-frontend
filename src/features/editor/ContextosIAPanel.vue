<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faHeading, faBold, faItalic, faListUl, faListOl, faCode, faQuoteLeft, faLink,
  faEye, faSave, faTrash, faPlus, faCheck, sectorIcons, faWandMagicSparkles,
} from '@/lib/icons';
import ContextosIASidebar from './ContextosIASidebar.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import { useContextosIAQuery, useGuardarContextoSeccion, useEliminarContextoSeccion } from '@/composables/useContextosIA';
import { useUiStore } from '@/stores/ui';
import { tiempoRelativo } from '@/lib/tiempoRelativo';
import type { Plantilla } from '@/types';

const props = defineProps<{ plantilla: Plantilla; plantillaId: string }>();

const ui = useUiStore();
const { data: contextos, isLoading } = useContextosIAQuery(() => props.plantillaId);
const guardar = useGuardarContextoSeccion();
const eliminar = useEliminarContextoSeccion();

const secciones = computed(() => props.plantilla.secciones);
const seccionActivaId = ref<string | null>(secciones.value[0]?.id ?? null);
const seccionActiva = computed(() => secciones.value.find((s) => s.id === seccionActivaId.value) ?? null);
const globales = computed(() => contextos.value?.globales ?? []);

/** Contexto guardado de la sección abierta, si existe. */
const guardado = computed(() => contextos.value?.secciones.find((c) => c.seccionId === seccionActivaId.value) ?? null);

// Borrador local: se rehidrata al cambiar de sección o cuando llegan los datos del servidor.
const markdown = ref('');
const asociados = ref<Set<string>>(new Set());
function cargarBorrador() {
  markdown.value = guardado.value?.markdown ?? '';
  asociados.value = new Set(guardado.value?.globales ?? []);
}
watch([seccionActivaId, guardado], cargarBorrador, { immediate: true });

const huboCambios = computed(() => {
  if (markdown.value !== (guardado.value?.markdown ?? '')) return true;
  const previos = new Set(guardado.value?.globales ?? []);
  if (previos.size !== asociados.value.size) return true;
  return [...asociados.value].some((id) => !previos.has(id));
});

function toggleAsociado(id: string) {
  const set = new Set(asociados.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  asociados.value = set;
}

const totalCampos = computed(() => seccionActiva.value?.subsecciones.reduce((n, sub) => n + sub.campos.length, 0) ?? 0);

async function handleGuardar() {
  if (!seccionActivaId.value) return;
  await guardar.mutateAsync({
    plantillaId: props.plantillaId,
    seccionId: seccionActivaId.value,
    markdown: markdown.value,
    globales: [...asociados.value],
  });
  ui.toast('Contexto guardado');
}

const showEliminar = ref(false);
async function handleEliminar() {
  if (!seccionActivaId.value) return;
  await eliminar.mutateAsync({ plantillaId: props.plantillaId, seccionId: seccionActivaId.value });
  showEliminar.value = false;
  ui.toast('Contexto eliminado');
}

const showPreview = ref(false);

const HERRAMIENTAS = [
  { icon: faHeading, label: 'Título', envoltura: '## ' },
  { icon: faBold, label: 'Negrita', envoltura: '**' },
  { icon: faItalic, label: 'Cursiva', envoltura: '*' },
  { icon: faListUl, label: 'Lista', envoltura: '- ' },
  { icon: faListOl, label: 'Lista numerada', envoltura: '1. ' },
  { icon: faCode, label: 'Código', envoltura: '`' },
  { icon: faQuoteLeft, label: 'Cita', envoltura: '> ' },
  { icon: faLink, label: 'Enlace', envoltura: '[]()' },
];

/** Inserta la marca de markdown al final; suficiente para una ayuda de redacción. */
function insertar(marca: string) {
  markdown.value += (markdown.value.endsWith('\n') || markdown.value === '' ? '' : '\n') + marca;
}
</script>

<template>
  <div class="flex flex-1 overflow-hidden bg-surface">
    <ContextosIASidebar
      :secciones="secciones"
      :seccion-activa-id="seccionActivaId"
      :globales="globales"
      @select-seccion="seccionActivaId = $event"
    />

    <div class="flex-1 overflow-y-auto p-6">
      <p v-if="isLoading" class="text-sm text-muted">Cargando contextos…</p>
      <div v-else class="grid grid-cols-1 xl:grid-cols-[minmax(280px,340px)_1fr] gap-5 items-start">
        <div class="space-y-5">
          <div class="rounded-xl border border-gray-200 bg-white p-5">
            <p class="text-sm font-bold text-heading mb-4">Información de la sección</p>

            <label class="block text-xs font-medium text-heading mb-1.5">Sección</label>
            <div class="flex items-center gap-2 mb-4">
              <span class="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">
                {{ secciones.findIndex((s) => s.id === seccionActivaId) + 1 }}
              </span>
              <input
                :value="seccionActiva?.nombre ?? ''"
                readonly
                type="text"
                class="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-heading focus:outline-none"
              />
            </div>

            <label class="block text-xs font-medium text-heading mb-1.5">Descripción</label>
            <p class="text-sm text-muted leading-snug mb-4">{{ seccionActiva?.descripcion || 'Sin descripción.' }}</p>

            <label class="block text-xs font-medium text-heading mb-1.5">Campos</label>
            <span class="inline-flex px-2.5 py-1 rounded-lg bg-gray-100 text-xs font-medium text-gray-600">{{ totalCampos }} campos</span>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-5">
            <p class="text-sm font-bold text-heading">Contextos globales asociados</p>
            <p class="text-xs text-muted leading-snug mt-1 mb-3">
              Selecciona los contextos globales que la IA podrá consultar si lo necesita.
            </p>
            <div class="space-y-2">
              <button
                v-for="g in globales"
                :key="g.id"
                @click="toggleAsociado(g.id)"
                type="button"
                class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors duration-75"
                :class="asociados.has(g.id) ? 'border-brand-300 bg-brand-50/50' : 'border-gray-200 hover:bg-gray-50'"
              >
                <span
                  class="w-4 h-4 rounded flex items-center justify-center shrink-0 border"
                  :class="asociados.has(g.id) ? 'bg-brand-600 border-brand-600' : 'border-gray-300 bg-white'"
                >
                  <FontAwesomeIcon v-if="asociados.has(g.id)" :icon="faCheck" class="w-2 h-2 text-white" />
                </span>
                <FontAwesomeIcon :icon="sectorIcons[g.icono ?? ''] ?? faWandMagicSparkles" class="w-3 h-3 text-gray-400 shrink-0" />
                <span class="flex-1 min-w-0 truncate text-sm text-heading">{{ g.nombre }}</span>
              </button>
              <p v-if="globales.length === 0" class="text-xs text-muted py-2 text-center">Todavía no hay contextos globales.</p>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-gray-200 bg-white p-5">
          <div class="flex items-start justify-between gap-3 mb-1">
            <p class="text-sm font-bold text-heading">Instrucciones / contexto para la IA (Markdown)</p>
            <button
              @click="showPreview = !showPreview"
              type="button"
              class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors duration-75 flex items-center gap-1.5 shrink-0"
              :class="showPreview ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
            >
              <FontAwesomeIcon :icon="faEye" class="w-3 h-3" />
              Vista previa
            </button>
          </div>
          <p class="text-xs text-muted mb-3">
            Escribe las instrucciones, reglas, recomendaciones y cualquier información relevante que la IA debe considerar.
          </p>

          <div class="rounded-lg border border-gray-200 overflow-hidden">
            <div v-if="!showPreview" class="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50/60">
              <button
                v-for="h in HERRAMIENTAS"
                :key="h.label"
                @click="insertar(h.envoltura)"
                :title="h.label"
                type="button"
                class="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:bg-gray-200/70 hover:text-gray-700 transition-colors duration-75"
              >
                <FontAwesomeIcon :icon="h.icon" class="w-3 h-3" />
              </button>
            </div>
            <textarea
              v-if="!showPreview"
              v-model="markdown"
              spellcheck="false"
              placeholder="## Objetivo&#10;Describe qué debe lograr la IA en esta sección..."
              class="block w-full min-h-[420px] px-4 py-3 text-sm text-heading leading-relaxed focus:outline-none resize-none font-mono"
            />
            <pre v-else class="block w-full min-h-[420px] px-4 py-3 text-sm text-heading leading-relaxed whitespace-pre-wrap">{{ markdown || 'Sin contenido.' }}</pre>
          </div>
          <p class="text-right text-[11px] text-muted mt-1.5">{{ markdown.length }} caracteres</p>

          <div class="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
            <button
              @click="showEliminar = true"
              :disabled="!guardado"
              type="button"
              class="px-4 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-75 flex items-center gap-2"
            >
              <FontAwesomeIcon :icon="faTrash" class="w-3.5 h-3.5" />
              Eliminar contexto
            </button>
            <div class="flex items-center gap-3">
              <span v-if="guardado?.actualizadoEn" class="text-xs text-muted">
                Última actualización: {{ tiempoRelativo(guardado.actualizadoEn) }}
              </span>
              <span v-else class="text-xs text-muted">Sin guardar todavía</span>
              <button
                @click="handleGuardar"
                :disabled="!huboCambios || guardar.isPending.value"
                type="button"
                class="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors duration-75 flex items-center gap-2"
              >
                <FontAwesomeIcon :icon="faSave" class="w-3.5 h-3.5" />
                {{ guardar.isPending.value ? 'Guardando…' : 'Guardar cambios' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmModal
      :is-open="showEliminar"
      title="Eliminar contexto"
      :message="`Se borrará el contexto de IA de la sección «${seccionActiva?.nombre ?? ''}». Esta acción no se puede deshacer.`"
      confirm-label="Eliminar"
      @confirm="handleEliminar"
      @close="showEliminar = false"
    />
  </div>
</template>
