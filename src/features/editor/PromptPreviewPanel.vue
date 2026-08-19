<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faSearch, faTable, faTriangleExclamation } from '@/lib/icons';
import { usePrevisualizarPromptQuery } from '@/composables/usePrevisualizarPrompt';
import PromptPreviewBlock from './PromptPreviewBlock.vue';
import type { Plantilla } from '@/types';

const props = defineProps<{ plantilla: Plantilla; plantillaId: string }>();

const secciones = computed(() => props.plantilla.secciones);
const seccionActivaId = ref<string | null>(secciones.value[0]?.id ?? null);
const filtroSeccion = ref('');
const seccionesFiltradas = computed(() => {
  const q = filtroSeccion.value.trim().toLowerCase();
  if (!q) return secciones.value;
  return secciones.value.filter((s) => s.nombre.toLowerCase().includes(q));
});

const { data: preview, isLoading, isFetching, error } = usePrevisualizarPromptQuery(() => props.plantillaId, seccionActivaId);

/** 'seccion' = prompt de los campos de texto; o el identificador de una tabla de esta sección. */
const vista = ref<string>('seccion');
watch(seccionActivaId, () => { vista.value = 'seccion'; });

const bloqueActivo = computed(() => {
  if (!preview.value) return null;
  if (vista.value === 'seccion') {
    return { titulo: 'Campos de texto de esta sección', ...preview.value.seccion };
  }
  const t = preview.value.tablas.find((x) => x.identificador === vista.value);
  return t ? { titulo: `Tabla ${t.identificador} — ${t.etiqueta}`, ...t } : null;
});
</script>

<template>
  <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] overflow-hidden">
    <aside class="border-r border-gray-100 bg-white flex flex-col min-h-0">
      <div class="p-3 border-b border-gray-100">
        <div class="relative">
          <FontAwesomeIcon :icon="faSearch" class="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            v-model="filtroSeccion"
            type="search"
            placeholder="Buscar sección…"
            class="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-violet-400"
          />
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <button
          v-for="s in seccionesFiltradas"
          :key="s.id"
          type="button"
          class="w-full text-left rounded-lg px-3 py-2.5 transition-colors"
          :class="seccionActivaId === s.id ? 'bg-violet-50 border border-violet-200' : 'hover:bg-gray-50 border border-transparent'"
          @click="seccionActivaId = s.id"
        >
          <div class="text-[11px] font-semibold text-muted">
            SECCIÓN N°{{ String(secciones.findIndex((x) => x.id === s.id) + 1).padStart(2, '0') }}
          </div>
          <div class="text-xs font-medium text-heading leading-snug line-clamp-2">{{ s.nombre }}</div>
        </button>
      </div>
    </aside>

    <div class="flex flex-col min-h-0 overflow-hidden">
      <div v-if="isLoading" class="flex-1 flex items-center justify-center text-muted text-sm">Armando el prompt…</div>
      <div v-else-if="error" class="flex-1 flex items-center justify-center text-red-600 text-sm">No se pudo armar el prompt de esta sección.</div>
      <template v-else-if="preview">
        <div class="px-5 py-3 border-b border-gray-100 bg-white shrink-0 space-y-3">
          <div class="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
              :class="vista === 'seccion' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-muted hover:bg-gray-200'"
              @click="vista = 'seccion'"
            >
              Campos de texto ({{ preview.seccion.camposIncluidos }})
            </button>
            <button
              v-for="t in preview.tablas"
              :key="t.identificador"
              type="button"
              class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5"
              :class="vista === t.identificador ? 'bg-violet-600 text-white' : 'bg-gray-100 text-muted hover:bg-gray-200'"
              @click="vista = t.identificador"
            >
              <FontAwesomeIcon :icon="faTable" class="w-2.5 h-2.5" />
              {{ t.identificador }}
            </button>
          </div>
          <div v-if="!preview.fuenteVerdadEsReal" class="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
            <FontAwesomeIcon :icon="faTriangleExclamation" class="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              No hay ningún ejemplo de referencia con fuente de la verdad cargada — el bloque "Fuente de la verdad" de abajo
              muestra un texto de relleno. Marca un ejemplo con fuente de la verdad como "ejemplo de referencia" (tab Ejemplos)
              para ver el prompt tal como le llegaría al modelo en un caso real.
            </span>
          </div>
        </div>

        <div v-if="bloqueActivo" class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4" :class="{ 'opacity-60': isFetching }">
          <PromptPreviewBlock
            titulo="Sistema — bloque cacheable"
            nota='De aquí sale: "Reglas de llenado automático con IA" + los 5 documentos de Contexto general + la Fuente de la verdad. Se edita en los tabs 1 y 2 de arriba (y en Contextos globales). Es idéntico para toda la ficha — Anthropic lo cachea entre llamadas.'
            :texto="bloqueActivo.sistemaCacheable"
          />
          <PromptPreviewBlock
            v-if="bloqueActivo.sistemaVariable"
            titulo="Sistema — bloque variable (esta sección)"
            nota="De aquí sale: la guía de esta sección específica. Se edita en el tab 3, Guías por sección."
            :texto="bloqueActivo.sistemaVariable"
          />
          <PromptPreviewBlock
            titulo="Mensaje de usuario"
            nota='Se arma solo a partir de la Estructura JSON (tab 4): etiquetas, tipos, opciones y la "nota" de cada campo/columna — no hay ningún texto editable aparte para esto.'
            :texto="bloqueActivo.usuario"
          />
        </div>
      </template>
    </div>
  </div>
</template>
