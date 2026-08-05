<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faEye, faSave, faArrowLeft, faFileCode, faFileExport, faWandMagicSparkles } from '@/lib/icons';
import VersionTabs from '@/components/VersionTabs.vue';
import { useSessionStore } from '@/stores/session';
import { puedeAccederGestionUsuarios } from '@/lib/permisos';
import type { VersionTab, Plantilla } from '@/types';

const props = defineProps<{
  plantilla: Plantilla;
  sectorId: string;
  plantillaId: string;
  activeTab: VersionTab;
  /** true = se está viendo el panel de Contextos IA en vez del editor */
  contextosIA?: boolean;
}>();

const emit = defineEmits<{ 'change-tab': [VersionTab]; save: []; 'view-json': []; 'preview-excel': []; 'insert-excel': []; 'toggle-contextos-ia': [] }>();

const session = useSessionStore();
const esSuperusuario = computed(() => session.sesion?.rol === 'superusuario');
// El contexto que consume la IA lo redacta quien administra el catálogo, no cualquiera que edite
// una ficha — mismo criterio que la gestión de usuarios (superusuario + administrador).
const puedeEditarContextos = computed(() => !!session.sesion && puedeAccederGestionUsuarios(session.sesion.rol));
const showInsert = computed(() => props.activeTab === 'ejemplos');
</script>

<template>
  <div class="relative shrink-0 border-b border-white/10 bg-sidebar bg-[url('/bg-cont.webp')] bg-cover bg-center bg-no-repeat px-6 py-3 overflow-hidden">
    <div class="absolute inset-0 bg-black/55 pointer-events-none" />
    <div class="relative flex items-center justify-between">
      <div class="flex items-center gap-3">
        <RouterLink
          :to="`/sectores/${sectorId}`"
          class="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          title="Volver"
        >
          <FontAwesomeIcon :icon="faArrowLeft" class="w-4 h-4" />
        </RouterLink>
        <span class="inline-flex items-center justify-center w-auto min-w-10 px-2 h-8 rounded-md border border-brand-400/40 text-brand-300 text-sm font-bold bg-brand-500/15">
          {{ plantilla.codigo }}
        </span>
        <h1 class="text-lg font-bold text-white truncate max-w-xs">{{ plantilla.nombre }}</h1>
        <span class="text-xs text-white/50">{{ plantilla.cantidadSecciones }} secciones</span>
      </div>
      <div class="flex items-center gap-3">
        <VersionTabs :active-tab="activeTab" disable-proyecto dark @change="emit('change-tab', $event)" />
        <button
          v-if="puedeEditarContextos"
          @click="emit('toggle-contextos-ia')"
          type="button"
          class="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border transition-colors bg-gradient-to-r from-violet-500/30 to-fuchsia-500/25 hover:from-violet-500/40 hover:to-fuchsia-500/35"
          :class="contextosIA ? 'border-violet-300/60 text-white shadow-[0_0_0_1px_rgba(167,139,250,0.35)]' : 'border-violet-400/30 text-violet-100'"
        >
          <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3.5 h-3.5" />
          Contextos IA
        </button>
        <button
          v-if="esSuperusuario"
          @click="emit('view-json')"
          type="button"
          class="px-4 py-2 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2"
        >
          <FontAwesomeIcon :icon="faFileCode" class="w-3.5 h-3.5" />
          Ver JSON
        </button>
        <button
          v-if="showInsert"
          @click="emit('insert-excel')"
          type="button"
          class="px-4 py-2 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2"
        >
          <FontAwesomeIcon :icon="faFileExport" class="w-3.5 h-3.5" />
          Insertar
        </button>
        <button
          v-else
          @click="emit('preview-excel')"
          type="button"
          class="px-4 py-2 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2"
        >
          <FontAwesomeIcon :icon="faEye" class="w-3.5 h-3.5" />
          Vista previa
        </button>
        <button
          @click="emit('save')"
          type="button"
          class="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors flex items-center gap-2"
        >
          <FontAwesomeIcon :icon="faSave" class="w-3.5 h-3.5" />
          Guardar
        </button>
      </div>
    </div>
  </div>
</template>
