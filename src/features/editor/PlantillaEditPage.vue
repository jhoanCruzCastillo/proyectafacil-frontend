<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronLeft, faChevronRight } from '@/lib/icons';
import ResizeHandle from '@/components/ResizeHandle.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import SectionIndex from './SectionIndex.vue';
import SectionContent from './SectionContent.vue';
import FieldPropertiesPanel from './FieldPropertiesPanel.vue';
import EditorTopBar from './EditorTopBar.vue';
import ContextosIAPanel from './ContextosIAPanel.vue';
import SeccionHojaModal from './SeccionHojaModal.vue';
import ImportarEstructuraModal from './ImportarEstructuraModal.vue';
import ExamplesPanel from './ExamplesPanel.vue';
import NuevoEjemploModal from './NuevoEjemploModal.vue';
import JsonPreviewModal from './JsonPreviewModal.vue';
import ExcelPreviewModal from './ExcelPreviewModal.vue';
import VolcarExcelModal from './VolcarExcelModal.vue';
import ExcelCatalogModal from '@/features/plantillas/ExcelCatalogModal.vue';
import { usePlantillaEditor } from '@/composables/usePlantillaEditor';

const route = useRoute();
const sectorId = computed(() => route.params.sectorId as string);
const plantillaId = computed(() => route.params.plantillaId as string);

const {
  estadoGuardado,
  editData, activeTab, selectedCampo, isNewCampo, editingHojaSeccionId,
  leftWidth, rightWidth, examplesWidth, highlightMissingCaptura, ejemplosCount, jsonPreview,
  showImportEstructura,
  modoEdicion, setModoEdicion, borradoresPorCampo, confirmarBorradorCampo,
  handleUpdateDefaultValue, handleUpdateExampleValue,
  secciones, safeIdx, seccionActiva, isFirst, isLast, showExamples,
  ejemplos, activeEjemplo, editedValores, excelDesactualizado, showNuevoEjemplo, deleteTarget, volcarTarget, volcarEstructura,
  archivoExcelAsignado, showExcelCatalogModal, showPreview, showInsertConfirm, isInserting, insertProgress, insertProgressLabel,
  previewFileUrl, previewFileName,
  handleLeftResize, handleRightResize, handleExamplesResize, handleTabChange, handleSectionSelect,
  goToPrevSection, goToNextSection, handleFieldUpdate, handleAddCampo, handleAddNota, handleDuplicarCampo, handleDeleteCampo,
  handleSectionNameChange, handleSectionHojaChange, handleSubsectionNameChange,
  handleSubseccionAyudaChange, handleAddSubsection, handleDeleteSubsection, handleAddSection, handleDuplicarSeccion,
  handleCreateExample, handleDeleteEjemplo, handleToggleEjemploEstado,
  handleDownloadExcel, handlePreviewExample, handleInsertExcel,
  handleVolcarExcel, handleVolcarEstructura, handleConfirmarVolcado, getDefaultValores,
  handleImportEstructura,
  handleSave, handleViewJson,
} = usePlantillaEditor(plantillaId);

const mostrarTipologiasIoarr = computed(() => editData.value?.instrumento === 'ioarr');

// Contextos IA reemplaza el cuerpo del editor (no es una versión más de la ficha, así que no entra
// en `activeTab`): la barra superior se queda y debajo se cambia todo el contenido.
const verContextosIA = ref(false);
</script>

<template>
  <div v-if="!editData" class="p-8 text-muted">Plantilla no encontrada</div>
  <div v-else class="flex flex-col h-screen">
    <EditorTopBar
      :plantilla="editData"
      :sector-id="sectorId"
      :plantilla-id="plantillaId"
      :active-tab="activeTab"
      :contextos-i-a="verContextosIA"
      :tiene-excel-asignado="!!archivoExcelAsignado"
      :estado-guardado="estadoGuardado"
      :modo-edicion="modoEdicion"
      :excel-desactualizado="excelDesactualizado"
      @change-tab="(t) => { verContextosIA = false; handleTabChange(t); }"
      @toggle-contextos-ia="verContextosIA = !verContextosIA"
      @update:modo-edicion="setModoEdicion"
      @save="handleSave"
      @preview-excel="showPreview = true"
      @insert-excel="showInsertConfirm = true"
      @volcar-estructura="handleVolcarEstructura"
    />

    <ContextosIAPanel v-if="verContextosIA" :plantilla="editData" :plantilla-id="plantillaId" />

    <div v-else class="flex flex-1 overflow-hidden">
      <template v-if="showExamples">
        <div class="shrink-0 bg-white overflow-hidden border-r border-gray-100" :style="{ width: `${examplesWidth}px` }">
          <ExamplesPanel
            :ejemplos="ejemplos"
            :active-ejemplo="activeEjemplo"
            @select="activeEjemplo = $event"
            @new-example="showNuevoEjemplo = true"
            @preview="handlePreviewExample"
            @download="handleDownloadExcel"
            @delete="deleteTarget = $event"
            @toggle-estado="handleToggleEjemploEstado"
            @volcar-excel="handleVolcarExcel"
          />
        </div>
        <ResizeHandle @resize="handleExamplesResize" />
      </template>

      <div class="shrink-0 bg-white p-4 overflow-y-auto" :style="{ width: `${leftWidth}px` }">
        <SectionIndex
          :secciones="secciones"
          :active-seccion-id="seccionActiva?.id ?? null"
          :show-add-button="!showExamples"
          show-edit-hoja
          :show-duplicate-section="!showExamples"
          :show-import-estructura="!showExamples"
          @select="handleSectionSelect"
          @add-section="handleAddSection"
          @edit-hoja="editingHojaSeccionId = $event"
          @duplicate-section="handleDuplicarSeccion"
          @import-estructura="showImportEstructura = true"
          @view-json="handleViewJson"
        />
      </div>

      <ResizeHandle @resize="handleLeftResize" />

      <div class="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
        <div class="flex-1 overflow-y-auto bg-white p-6 mr-1.5">
          <SectionContent
            v-if="seccionActiva"
            :key="seccionActiva.id"
            :seccion="seccionActiva"
            editable
            :show-example-values="showExamples"
            :example-valores="showExamples ? editedValores : undefined"
            :selected-campo-id="selectedCampo?.id"
            :highlight-missing-captura="highlightMissingCaptura"
            :modo-edicion="modoEdicion"
            :borradores-por-campo="borradoresPorCampo"
            @select-campo="(c) => { selectedCampo = c; isNewCampo = false; }"
            @add-campo="handleAddCampo"
            @add-nota="handleAddNota"
            @delete-campo="handleDeleteCampo"
            @duplicate-campo="handleDuplicarCampo"
            @section-name-change="handleSectionNameChange"
            @section-hoja-change="handleSectionHojaChange"
            @subsection-name-change="handleSubsectionNameChange"
            @subseccion-ayuda-change="handleSubseccionAyudaChange"
            @add-subsection="handleAddSubsection"
            @delete-subsection="handleDeleteSubsection"
            @update-default-value="handleUpdateDefaultValue"
            @update-example-value="(campoId, identificador, value) => handleUpdateExampleValue(campoId, identificador, value)"
            @confirmar-borrador="confirmarBorradorCampo"
            @update-config-tabla="(campoId, configTabla) => handleFieldUpdate(campoId, { configTabla })"
          />
        </div>

        <div class="shrink-0 border-t border-gray-100 bg-white px-6 py-3 flex items-center justify-between">
          <button @click="goToPrevSection" :disabled="isFirst" class="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <FontAwesomeIcon :icon="faChevronLeft" class="w-3.5 h-3.5" />
            Anterior
          </button>
          <span class="text-sm text-muted">
            Sección <span class="font-semibold text-heading">{{ safeIdx + 1 }}</span> de {{ secciones.length }}
          </span>
          <button @click="goToNextSection" :disabled="isLast" class="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Siguiente
            <FontAwesomeIcon :icon="faChevronRight" class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <template v-if="!showExamples">
        <ResizeHandle @resize="handleRightResize" />
        <div class="shrink-0 bg-white p-5 overflow-y-auto" :style="{ width: `${rightWidth}px` }">
          <FieldPropertiesPanel
            v-if="selectedCampo"
            :key="selectedCampo.id"
            :campo="selectedCampo"
            :auto-focus-etiqueta="isNewCampo"
            :ejemplos-count="ejemplosCount"
            :modo-edicion="modoEdicion"
            @update="handleFieldUpdate"
          />
          <div v-else class="flex items-center justify-center h-full text-muted text-sm text-center px-4">
            Selecciona un campo para ver sus propiedades
          </div>
        </div>
      </template>
    </div>

    <SeccionHojaModal
      :is-open="!!editingHojaSeccionId"
      :seccion="secciones.find((s) => s.id === editingHojaSeccionId) ?? null"
      @close="editingHojaSeccionId = null"
      @change="(hoja) => editingHojaSeccionId && handleSectionHojaChange(editingHojaSeccionId, hoja)"
    />

    <ImportarEstructuraModal
      :is-open="showImportEstructura"
      @close="showImportEstructura = false"
      @import="handleImportEstructura"
    />

    <NuevoEjemploModal
      :is-open="showNuevoEjemplo"
      :mostrar-tipologias-ioarr="mostrarTipologiasIoarr"
      :has-excel-asignado="!!archivoExcelAsignado"
      @close="showNuevoEjemplo = false"
      @create="handleCreateExample"
      @assign-excel="showNuevoEjemplo = false; showExcelCatalogModal = true"
    />

    <ExcelCatalogModal
      v-if="editData"
      :is-open="showExcelCatalogModal"
      :plantilla="editData"
      @close="showExcelCatalogModal = false"
    />

    <ConfirmModal
      :is-open="!!deleteTarget"
      title="Eliminar ejemplo"
      :message="`¿Seguro que deseas eliminar el ejemplo &quot;${deleteTarget?.nombre}&quot;? Sus valores se perderán y esta acción no se puede deshacer.`"
      @close="deleteTarget = null"
      @confirm="handleDeleteEjemplo"
    />

    <ConfirmModal
      :is-open="showInsertConfirm"
      title="Insertar valores en el Excel"
      :message="`Se sobreescribirán todos los datos actuales del Excel asignado al ejemplo &quot;${activeEjemplo?.nombre}&quot;. Esta acción no se puede deshacer.`"
      confirm-label="Insertar"
      :progress="isInserting ? insertProgress : null"
      :progress-label="isInserting ? insertProgressLabel : null"
      @close="showInsertConfirm = false"
      @confirm="handleInsertExcel"
    />

    <ExcelPreviewModal
      v-if="editData"
      :is-open="showPreview"
      :file-url="previewFileUrl"
      :file-name="previewFileName"
      :title="`${editData.codigo} — ${editData.nombre}`"
      @close="showPreview = false"
    />

    <JsonPreviewModal
      :is-open="!!jsonPreview"
      :title="jsonPreview?.title ?? ''"
      :json="jsonPreview?.json ?? ''"
      @close="jsonPreview = null"
    />

    <!-- Un solo modal para los dos destinos: en Estructura lee el Excel asignado y llena los valores
         por defecto; en Ejemplos se elige archivo y llena el ejemplo activo. -->
    <VolcarExcelModal
      :is-open="!!volcarTarget || volcarEstructura"
      :ejemplo="volcarTarget"
      :plantilla="editData"
      :destino="volcarEstructura ? 'estructura' : 'ejemplo'"
      :valores-actuales="volcarEstructura ? getDefaultValores() : editedValores"
      :excel-estructura="archivoExcelAsignado?.dataUrl"
      :nombre-excel-estructura="archivoExcelAsignado?.nombre"
      @close="volcarTarget = null; volcarEstructura = false"
      @confirmar="handleConfirmarVolcado"
    />
  </div>
</template>
