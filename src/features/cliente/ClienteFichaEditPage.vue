<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faGraduationCap, faChevronLeft, faChevronRight } from '@/lib/icons';
import ResizeHandle from '@/components/ResizeHandle.vue';
import SectionIndex from '@/features/editor/SectionIndex.vue';
import SectionContent from '@/features/editor/SectionContent.vue';
import ExcelPreviewModal from '@/features/editor/ExcelPreviewModal.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import ClienteFichaTopBar from './ClienteFichaTopBar.vue';
import EjemplosReferenciaPanel from './EjemplosReferenciaPanel.vue';
import FuenteVerdadModal from './FuenteVerdadModal.vue';
import ProcesamientoIAModal from './ProcesamientoIAModal.vue';
import ResultadoLlenadoIAModal from './ResultadoLlenadoIAModal.vue';
import AsesorIAChat from './AsesorIAChat.vue';
import AsesoriaHumanaFAB from './AsesoriaHumanaFAB.vue';
import HistorialFichaModal from './HistorialFichaModal.vue';
import { useClienteFichaEditor } from '@/composables/useClienteFichaEditor';
import { useLlenadoIAProgreso } from '@/composables/useLlenadoIAProgreso';

const route = useRoute();
const ejemploId = computed(() => route.params.ejemploId as string);

const {
  ejemplo, plantilla, archivoEjemplo, esNivel0, diasRestantes,
  soloLectura, permiteMejoraIA, muestraHistorial, showHistorial, showFuenteVerdad,
  esPropietario, ejemplosReferencia, referenciaId, referenciaEjemplo,
  editedValores, leftWidth, activeTab, examplesWidth, showPreview, showInsertConfirm, isInserting, insertProgress, insertProgressLabel,
  errores, erroresCount, progreso, erroresPorSeccion,
  secciones, safeIdx, seccionActiva, isFirst, isLast,
  handleLeftResize, handleExamplesResize, handleSectionSelect, goToPrevSection, goToNextSection, handleValueChange,
  handleSave, handleDownload, handleInsert,
} = useClienteFichaEditor(ejemploId);

const {
  showProgreso: showProcesamientoIA,
  showResultado: showResultadoLlenadoIA,
  fase: faseLlenadoIA,
  secciones: seccionesProgresoIA,
  mensajeError: mensajeErrorLlenadoIA,
  resumenResultado,
  estadosCamposIA,
  esperandoServidor: esperandoServidorLlenadoIA,
  iniciar: iniciarLlenadoIAJob,
  abrirSiHaySesion,
  cerrarProgreso: cerrarProcesamientoIA,
  verResultados: verResultadosLlenadoIA,
  cerrarResultado: cerrarResultadoLlenadoIA,
  terminarProceso: terminarProcesoLlenadoIA,
  confirmarCampoIA,
  alEditarCampoIA,
} = useLlenadoIAProgreso(plantilla, ejemploId);

function abrirContextoIA() {
  if (abrirSiHaySesion()) return;
  showFuenteVerdad.value = true;
}

function iniciarLlenadoIA(payload?: { seccionIds?: string[] }) {
  void iniciarLlenadoIAJob(ejemploId.value, payload?.seccionIds);
}

function onValueChange(campoIdentificador: string, value: string) {
  handleValueChange(campoIdentificador, value);
  alEditarCampoIA(campoIdentificador, value);
}
</script>

<template>
  <div v-if="!ejemplo || !esPropietario" class="p-8 flex flex-col items-center justify-center text-center h-full">
    <p class="text-sm font-medium text-heading">Ficha no encontrada</p>
    <p class="text-xs text-muted mt-1">Puede que haya sido eliminada o que el enlace no sea válido</p>
  </div>
  <div v-else-if="!plantilla" class="p-8 flex flex-col items-center justify-center text-center h-full">
    <p class="text-sm font-medium text-heading">La plantilla de esta ficha ya no está disponible</p>
    <p class="text-xs text-muted mt-1">Contacta al administrador para más información</p>
  </div>

  <div v-else class="flex flex-col h-screen">
    <ClienteFichaTopBar
      :plantilla="plantilla"
      :ejemplo="ejemplo"
      :active-tab="activeTab"
      :errores-count="erroresCount"
      :progreso="progreso"
      :solo-lectura="soloLectura"
      :show-historial="muestraHistorial"
      @change-tab="activeTab = $event"
      @historial="showHistorial = true"
      @fuente-verdad="abrirContextoIA"
      @save="handleSave"
      @download="handleDownload"
      @insert="showInsertConfirm = true"
      @preview="showPreview = true"
    />

    <div v-if="esNivel0" class="shrink-0 border-b px-6 py-2 flex items-center gap-2 text-xs" :class="soloLectura ? 'bg-red-50 border-red-100 text-red-700' : 'bg-blue-50/60 border-gray-100 text-blue-700'">
      <FontAwesomeIcon :icon="faGraduationCap" class="w-3.5 h-3.5 shrink-0" />
      <template v-if="soloLectura">Tu plan de entrenamiento venció — este ejercicio quedó en modo solo lectura.</template>
      <template v-else>Ejercicio de práctica — Plan Pedagógico · {{ diasRestantes }} día{{ diasRestantes === 1 ? '' : 's' }} restantes</template>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <template v-if="activeTab === 'ejemplos'">
        <div class="shrink-0 bg-white overflow-hidden border-r border-gray-100" :style="{ width: `${examplesWidth}px` }">
          <EjemplosReferenciaPanel
            :ejemplos="ejemplosReferencia"
            :active-ejemplo="referenciaEjemplo ?? null"
            @select="(ej) => (referenciaId = ej.id)"
          />
        </div>
        <ResizeHandle @resize="handleExamplesResize" />
      </template>

      <div class="shrink-0 bg-white p-4 overflow-y-auto" :style="{ width: `${leftWidth}px` }">
        <SectionIndex
          :secciones="secciones"
          :active-seccion-id="seccionActiva?.id ?? null"
          :errores-por-seccion="activeTab === 'mi-ficha' ? erroresPorSeccion : undefined"
          @select="handleSectionSelect"
        />
      </div>

      <ResizeHandle @resize="handleLeftResize" />

      <div class="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto bg-white p-6">
          <SectionContent
            v-if="seccionActiva"
            :key="`${seccionActiva.id}-${activeTab}`"
            :seccion="seccionActiva"
            show-example-values
            :example-valores="activeTab === 'mi-ficha' ? editedValores : referenciaEjemplo?.valores"
            :values-editable="activeTab === 'mi-ficha' && !soloLectura"
            :errores-validacion="activeTab === 'mi-ficha' ? errores : undefined"
            :referencia-valores="activeTab === 'mi-ficha' ? referenciaEjemplo?.valores : undefined"
            :permite-mejora-i-a="activeTab === 'mi-ficha' && permiteMejoraIA"
            :estados-i-a="activeTab === 'mi-ficha' ? estadosCamposIA : undefined"
            @update-example-value="(_campoId, identificador, value) => onValueChange(identificador, value)"
            @confirmar-ia="confirmarCampoIA"
          />
        </div>

        <div class="shrink-0 border-t border-gray-100 bg-white px-6 py-3 flex items-center justify-between">
          <button
            @click="goToPrevSection"
            :disabled="isFirst"
            type="button"
            class="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FontAwesomeIcon :icon="faChevronLeft" class="w-3.5 h-3.5" />
            Anterior
          </button>
          <span class="text-sm text-muted">
            Sección <span class="font-semibold text-heading">{{ safeIdx + 1 }}</span> de {{ secciones.length }}
          </span>
          <button
            @click="goToNextSection"
            :disabled="isLast"
            type="button"
            class="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente
            <FontAwesomeIcon :icon="faChevronRight" class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <AsesorIAChat :plantilla="plantilla" :seccion-activa-id="seccionActiva?.id ?? null" :permitido="permiteMejoraIA" />
    <AsesoriaHumanaFAB :ejemplo-id="ejemploId" />

    <ConfirmModal
      :is-open="showInsertConfirm"
      title="Insertar valores en el Excel"
      :message="erroresCount > 0
        ? `Todavía tienes ${erroresCount} campo${erroresCount > 1 ? 's' : ''} pendiente${erroresCount > 1 ? 's' : ''} o con errores. Se sobreescribirán todos los datos actuales del Excel de &quot;${ejemplo.nombre}&quot; con lo que llenaste hasta ahora. Esta acción no se puede deshacer.`
        : `Se sobreescribirán todos los datos actuales del Excel de &quot;${ejemplo.nombre}&quot; con lo que llenaste. Esta acción no se puede deshacer.`"
      confirm-label="Insertar"
      :progress="isInserting ? insertProgress : null"
      :progress-label="isInserting ? insertProgressLabel : null"
      @confirm="handleInsert"
      @close="showInsertConfirm = false"
    />

    <ExcelPreviewModal
      :is-open="showPreview"
      :file-url="archivoEjemplo?.dataUrl ?? null"
      :file-name="archivoEjemplo?.nombre"
      :title="`${plantilla.codigo} — ${ejemplo.nombre}`"
      @close="showPreview = false"
    />

    <HistorialFichaModal :is-open="showHistorial" :ejemplo-id="ejemplo.id" @close="showHistorial = false" />

    <FuenteVerdadModal
      :is-open="showFuenteVerdad"
      :ejemplo-id="ejemplo.id"
      :secciones="plantilla.secciones"
      @close="showFuenteVerdad = false"
      @iniciar-llenado="iniciarLlenadoIA"
    />
  </div>

  <!-- Fuera del v-else del editor: sobreviven un refetch de ejemplo y no cortan la transición al informe. -->
  <ProcesamientoIAModal
    v-if="faseLlenadoIA === 'procesando' || faseLlenadoIA === 'error' || (faseLlenadoIA === 'completado' && showProcesamientoIA)"
    :is-open="showProcesamientoIA"
    :secciones="seccionesProgresoIA"
    :fase="faseLlenadoIA === 'error' ? 'error' : faseLlenadoIA === 'procesando' ? 'procesando' : 'completado'"
    :mensaje-error="mensajeErrorLlenadoIA"
    :esperando-servidor="esperandoServidorLlenadoIA"
    @close="cerrarProcesamientoIA()"
    @ver-resultados="verResultadosLlenadoIA()"
  />

  <ResultadoLlenadoIAModal
    :is-open="showResultadoLlenadoIA"
    :resumen="resumenResultado"
    @close="cerrarResultadoLlenadoIA()"
    @terminar="terminarProcesoLlenadoIA()"
  />
</template>
