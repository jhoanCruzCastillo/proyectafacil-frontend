<script setup lang="ts">
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faArrowLeft, faSave, faDownload, faEye, faSpinner, faCircleCheck, faTriangleExclamation, faClockRotateLeft, faFileLines, faLightbulb, faWandMagicSparkles, instrumentoLabelsPlural } from '@/lib/icons';
import type { Ejemplo, Plantilla, TipoInstrumento } from '@/types';
import type { ProgresoFicha } from '@/lib/valorValidation';

const RUTA_POR_INSTRUMENTO: Record<TipoInstrumento, string> = {
  formato: 'formatos',
  ficha_tecnica: 'fichas-tecnicas',
  ioarr: 'ioarr-cliente',
  perfil: 'perfiles',
};

withDefaults(
  defineProps<{
    plantilla: Plantilla;
    ejemplo: Ejemplo;
    activeTab: 'mi-ficha' | 'ejemplos';
    /** Cantidad de campos obligatorios sin llenar o con formato inválido */
    erroresCount?: number;
    progreso?: ProgresoFicha;
    /** true = plan de entrenamiento vencido — se oculta Guardar */
    soloLectura?: boolean;
    /** true = muestra el botón "Historial" (solo Nivel 2) */
    showHistorial?: boolean;
    /** Tras llenado IA: cambia la etiqueta del botón IA a "Ver resumen" */
    enRevisionIA?: boolean;
    /** Parpadeo inicial de "Ver resumen" */
    resaltarVerResumen?: boolean;
    /** Parpadeo de "Guardar" tras un llenado con IA — el sistema ya confirmó los borradores solo,
     * falta persistirlos. Deja de parpadear al hacer clic en Guardar. */
    resaltarGuardar?: boolean;
    /** true mientras Descargar/Vista previa están guardando o insertando en el Excel de fondo —
     * deshabilita ambos íconos para evitar un segundo clic a mitad del proceso. */
    cargandoAccionArchivo?: boolean;
  }>(),
  { enRevisionIA: false, resaltarVerResumen: false, resaltarGuardar: false, cargandoAccionArchivo: false },
);

const emit = defineEmits<{
  'change-tab': ['mi-ficha' | 'ejemplos'];
  historial: [];
  save: [];
  download: [];
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
        <span
          v-if="progreso && progreso.total > 0"
          class="text-xs font-medium text-white/60 shrink-0"
          :title="`${progreso.llenos} de ${progreso.total} campos llenados`"
        >
          {{ progreso.porcentaje }}% llenado
        </span>
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
          type="button"
          :title="enRevisionIA ? 'Ver resumen del llenado con IA' : 'Fuente de la verdad / Contexto IA'"
          class="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border border-violet-400/30 text-violet-100 bg-gradient-to-r from-violet-500/30 to-fuchsia-500/25 hover:from-violet-500/40 hover:to-fuchsia-500/35 transition-colors"
          :class="resaltarVerResumen ? 'pf-blink-ver-resumen' : ''"
          @click="emit('fuente-verdad')"
        >
          <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3.5 h-3.5" />
          {{ enRevisionIA ? 'Ver resumen' : 'Contexto IA' }}
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
          :disabled="activeTab !== 'mi-ficha' || cargandoAccionArchivo"
          type="button"
          title="Descargar"
          class="w-9 h-9 rounded-full border border-white/15 text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <FontAwesomeIcon :icon="cargandoAccionArchivo ? faSpinner : faDownload" class="w-3.5 h-3.5" :class="cargandoAccionArchivo ? 'animate-spin' : ''" />
        </button>
        <button
          @click="emit('preview')"
          :disabled="activeTab !== 'mi-ficha' || cargandoAccionArchivo"
          type="button"
          title="Vista previa"
          class="w-9 h-9 rounded-full border border-white/15 text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <FontAwesomeIcon :icon="cargandoAccionArchivo ? faSpinner : faEye" class="w-3.5 h-3.5" :class="cargandoAccionArchivo ? 'animate-spin' : ''" />
        </button>
        <button
          v-if="!soloLectura"
          @click="emit('save')"
          :disabled="activeTab !== 'mi-ficha'"
          type="button"
          class="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-600"
          :class="resaltarGuardar ? 'pf-blink-guardar' : ''"
        >
          <FontAwesomeIcon :icon="faSave" class="w-3.5 h-3.5" />
          Guardar
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pf-blink-ver-resumen {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(167, 139, 250, 0.55);
    filter: brightness(1);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(167, 139, 250, 0);
    filter: brightness(1.25);
  }
}
.pf-blink-ver-resumen {
  animation: pf-blink-ver-resumen 0.85s ease-in-out 5;
}
@keyframes pf-blink-guardar {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.55);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(74, 222, 128, 0);
  }
}
.pf-blink-guardar {
  /* A diferencia de "Ver resumen" (5 parpadeos y se aquieta), este sigue parpadeando sin límite
     hasta que el usuario hace clic en Guardar — hay cambios reales sin persistir todavía. Verde
     (brand-400, #4ade80) en vez del violeta de "Contexto IA"/"Ver resumen" — Guardar ya es verde
     de fondo, así que el parpadeo refuerza ese mismo color en vez de contrastar con otro distinto. */
  animation: pf-blink-guardar 0.85s ease-in-out infinite;
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.7);
}
</style>
