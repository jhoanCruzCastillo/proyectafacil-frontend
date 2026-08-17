<script setup lang="ts">
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faArrowLeft, faSave, faDownload, faFileExport, faEye, faCircleCheck, faTriangleExclamation, faClockRotateLeft, faFileLines, faLightbulb, faWandMagicSparkles, instrumentoLabelsPlural } from '@/lib/icons';
import type { Ejemplo, Plantilla, TipoInstrumento } from '@/types';
import type { ProgresoFicha } from '@/lib/valorValidation';

const RUTA_POR_INSTRUMENTO: Record<TipoInstrumento, string> = {
  formato: 'formatos',
  ficha_tecnica: 'fichas-tecnicas',
  ioarr: 'ioarr-cliente',
  perfil: 'perfiles',
};

defineProps<{
  plantilla: Plantilla;
  ejemplo: Ejemplo;
  activeTab: 'mi-ficha' | 'ejemplos';
  /** Cantidad de campos obligatorios sin llenar o con formato inválido */
  erroresCount?: number;
  progreso?: ProgresoFicha;
  /** true = plan de entrenamiento vencido — se ocultan las acciones de edición (Guardar/Insertar) */
  soloLectura?: boolean;
  /** true = muestra el botón "Historial" (solo Nivel 2) */
  showHistorial?: boolean;
}>();

const emit = defineEmits<{
  'change-tab': ['mi-ficha' | 'ejemplos'];
  historial: [];
  save: [];
  download: [];
  insert: [];
  preview: [];
  'fuente-verdad': [];
}>();

const router = useRouter();

const tabs: { key: 'mi-ficha' | 'ejemplos'; label: string; icon: typeof faFileLines }[] = [
  { key: 'mi-ficha', label: 'Mi ficha', icon: faFileLines },
  { key: 'ejemplos', label: 'Ejemplos', icon: faLightbulb },
];
</script>

<template>
  <div class="relative shrink-0 border-b border-white/10 bg-sidebar bg-[url('/bg-cont.webp')] bg-cover bg-center bg-no-repeat px-6 py-3 overflow-hidden">
    <div class="absolute inset-0 bg-black/55 pointer-events-none" />
    <div class="relative flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          @click="router.push({ name: RUTA_POR_INSTRUMENTO[plantilla.instrumento] })"
          type="button"
          :title="`Volver a Mis ${instrumentoLabelsPlural[plantilla.instrumento]}`"
          class="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors"
        >
          <FontAwesomeIcon :icon="faArrowLeft" class="w-4 h-4" />
        </button>
        <span class="inline-flex items-center justify-center w-auto min-w-10 px-2 h-8 rounded-md border border-brand-400/40 text-brand-300 text-sm font-bold bg-brand-500/15">
          {{ plantilla.codigo }}
        </span>
        <div class="max-w-xs">
          <h1 class="text-lg font-bold text-white truncate">{{ ejemplo.nombre }}</h1>
          <p class="text-xs text-white/50 truncate">{{ plantilla.nombre }}</p>
        </div>
        <div v-if="progreso && progreso.total > 0" class="w-28 shrink-0" :title="`${progreso.llenos} de ${progreso.total} campos llenados`">
          <div class="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div class="h-full bg-brand-500 rounded-full" :style="{ width: `${progreso.porcentaje}%` }" />
          </div>
          <p class="text-[10px] text-white/50 mt-0.5">{{ progreso.porcentaje }}% llenado</p>
        </div>
        <span v-if="(erroresCount ?? 0) > 0" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-400/15 text-amber-300 border border-amber-400/30 shrink-0">
          <FontAwesomeIcon :icon="faTriangleExclamation" class="w-3 h-3" />
          {{ erroresCount }} pendiente{{ (erroresCount ?? 0) > 1 ? 's' : '' }}
        </span>
        <span v-else class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-400/15 text-green-300 border border-green-400/30 shrink-0">
          <FontAwesomeIcon :icon="faCircleCheck" class="w-3 h-3" />
          Todo listo
        </span>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <button
          @click="emit('fuente-verdad')"
          type="button"
          class="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border border-violet-400/30 text-violet-100 bg-gradient-to-r from-violet-500/30 to-fuchsia-500/25 hover:from-violet-500/40 hover:to-fuchsia-500/35 transition-colors"
        >
          <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3.5 h-3.5" />
          Contexto IA
        </button>
        <div class="flex rounded-lg border border-white/15 overflow-hidden">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            @click="emit('change-tab', tab.key)"
            type="button"
            class="px-5 py-2 text-sm font-medium transition-colors flex items-center gap-2"
            :class="activeTab === tab.key ? 'bg-brand-600 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white bg-transparent'"
          >
            <FontAwesomeIcon :icon="tab.icon" class="w-3.5 h-3.5" />
            {{ tab.label }}
          </button>
        </div>
        <button
          v-if="showHistorial && activeTab === 'mi-ficha'"
          @click="emit('historial')"
          type="button"
          class="px-4 py-2 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2"
        >
          <FontAwesomeIcon :icon="faClockRotateLeft" class="w-3.5 h-3.5" />
          Historial
        </button>
        <button
          @click="emit('download')"
          :disabled="activeTab !== 'mi-ficha'"
          type="button"
          class="px-4 py-2 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <FontAwesomeIcon :icon="faDownload" class="w-3.5 h-3.5" />
          Descargar
        </button>
        <button
          v-if="!soloLectura"
          @click="emit('insert')"
          :disabled="activeTab !== 'mi-ficha'"
          type="button"
          class="px-4 py-2 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <FontAwesomeIcon :icon="faFileExport" class="w-3.5 h-3.5" />
          Insertar
        </button>
        <button
          @click="emit('preview')"
          :disabled="activeTab !== 'mi-ficha'"
          type="button"
          class="px-4 py-2 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <FontAwesomeIcon :icon="faEye" class="w-3.5 h-3.5" />
          Vista previa
        </button>
        <button
          v-if="!soloLectura"
          @click="emit('save')"
          :disabled="activeTab !== 'mi-ficha'"
          type="button"
          class="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-600"
        >
          <FontAwesomeIcon :icon="faSave" class="w-3.5 h-3.5" />
          Guardar
        </button>
      </div>
    </div>
  </div>
</template>
