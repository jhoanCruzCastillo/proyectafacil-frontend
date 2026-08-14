<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faEye, faSave, faArrowLeft, faFileCode, faFileExport, faFileImport, faSpinner, faWandMagicSparkles, faBolt, faCheck } from '@/lib/icons';
import VersionTabs from '@/components/VersionTabs.vue';
import { useSessionStore } from '@/stores/session';
import { puedeAccederGestionUsuarios } from '@/lib/permisos';
import type { EstadoAutoguardado } from '@/composables/useAutoguardado';
import type { ModoEdicionEditor } from '@/composables/usePlantillaEditor';
import type { VersionTab, Plantilla } from '@/types';

const props = defineProps<{
  plantilla: Plantilla;
  sectorId: string;
  plantillaId: string;
  activeTab: VersionTab;
  /** true = se está viendo el panel de Contextos IA en vez del editor */
  contextosIA?: boolean;
  /** Sin Excel asignado no hay nada que volcar a la estructura */
  tieneExcelAsignado?: boolean;
  /** Estado del autoguardado — se enseña en pequeño, no como toast: a esta frecuencia molestaría */
  estadoGuardado?: EstadoAutoguardado;
  /** live = cálculo al editar; confirmar = borrador hasta Confirmar en cada campo */
  modoEdicion?: ModoEdicionEditor;
}>();

const emit = defineEmits<{
  'change-tab': [VersionTab];
  save: [];
  'view-json': [];
  'preview-excel': [];
  'insert-excel': [];
  'volcar-estructura': [];
  'toggle-contextos-ia': [];
  'update:modo-edicion': [ModoEdicionEditor];
}>();

const session = useSessionStore();
const esSuperusuario = computed(() => session.sesion?.rol === 'superusuario');
// El contexto que consume la IA lo redacta quien administra el catálogo, no cualquiera que edite
// una ficha — mismo criterio que la gestión de usuarios (superusuario + administrador).
const puedeEditarContextos = computed(() => !!session.sesion && puedeAccederGestionUsuarios(session.sesion.rol));
const showInsert = computed(() => props.activeTab === 'ejemplos');

// 'inactivo' no se enseña: al abrir la ficha no hay nada que contar todavía.
const textoGuardado = computed(() => {
  switch (props.estadoGuardado) {
    case 'pendiente': return 'Cambios sin guardar';
    case 'guardando': return 'Guardando…';
    case 'guardado': return 'Guardado';
    case 'error': return 'No se pudo guardar';
    default: return '';
  }
});
const colorGuardado = computed(() => (props.estadoGuardado === 'error' ? 'text-red-300' : 'text-white/45'));
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
        <span v-if="textoGuardado" class="text-xs shrink-0 flex items-center gap-1.5" :class="colorGuardado">
          <FontAwesomeIcon v-if="estadoGuardado === 'guardando'" :icon="faSpinner" class="w-3 h-3 animate-spin" />
          {{ textoGuardado }}
        </span>
        <div class="flex rounded-lg border border-white/15 overflow-hidden">
          <button
            v-if="puedeEditarContextos"
            type="button"
            class="px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors"
            :class="contextosIA
              ? 'bg-violet-600 text-white'
              : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white'"
            @click="emit('toggle-contextos-ia')"
          >
            <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3.5 h-3.5" />
            Contexto IA
          </button>
          <VersionTabs
            :active-tab="contextosIA ? null : activeTab"
            disable-proyecto
            dark
            @change="emit('change-tab', $event)"
          />
        </div>
        <div
          v-if="!contextosIA"
          class="flex rounded-lg border border-white/15 overflow-hidden"
          title="Live: el Excel vivo se actualiza al editar. Confirmar: los cambios quedan en borrador hasta pulsar Confirmar en cada campo."
        >
          <button
            type="button"
            class="px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors"
            :class="(modoEdicion ?? 'live') === 'live'
              ? 'bg-brand-600 text-white'
              : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white'"
            @click="emit('update:modo-edicion', 'live')"
          >
            <FontAwesomeIcon :icon="faBolt" class="w-3 h-3" />
            Live
          </button>
          <button
            type="button"
            class="px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors"
            :class="modoEdicion === 'confirmar'
              ? 'bg-brand-600 text-white'
              : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white'"
            @click="emit('update:modo-edicion', 'confirmar')"
          >
            <FontAwesomeIcon :icon="faCheck" class="w-3 h-3" />
            Confirmar
          </button>
        </div>
        <button
          v-if="esSuperusuario && !contextosIA"
          @click="emit('view-json')"
          type="button"
          class="px-4 py-2 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2"
        >
          <FontAwesomeIcon :icon="faFileCode" class="w-3.5 h-3.5" />
          Ver JSON
        </button>
        <!-- Volcar existía solo en Ejemplos (desde la tarjeta del ejemplo). En Estructura el origen
             no se elige: siempre es el Excel asignado, así que vive aquí arriba. -->
        <button
          v-if="!showInsert && !contextosIA"
          @click="emit('volcar-estructura')"
          :disabled="!tieneExcelAsignado"
          type="button"
          :title="tieneExcelAsignado ? 'Volcar los datos del Excel asignado a los valores por defecto' : 'Asigna un Excel a la ficha para poder volcar sus datos'"
          class="px-4 py-2 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <FontAwesomeIcon :icon="faFileImport" class="w-3.5 h-3.5" />
          Volcar
        </button>
        <button
          v-if="showInsert && !contextosIA"
          @click="emit('insert-excel')"
          type="button"
          class="px-4 py-2 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2"
        >
          <FontAwesomeIcon :icon="faFileExport" class="w-3.5 h-3.5" />
          Insertar
        </button>
        <button
          v-if="!showInsert && !contextosIA"
          @click="emit('preview-excel')"
          type="button"
          class="px-4 py-2 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2"
        >
          <FontAwesomeIcon :icon="faEye" class="w-3.5 h-3.5" />
          Vista previa
        </button>
        <button
          v-if="!contextosIA"
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
