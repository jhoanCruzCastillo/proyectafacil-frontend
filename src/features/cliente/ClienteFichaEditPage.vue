<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faGraduationCap, faChevronLeft, faChevronRight, faSpinner } from '@/lib/icons';
import ResizeHandle from '@/components/ResizeHandle.vue';
import SectionIndex from '@/features/editor/SectionIndex.vue';
import SectionContent from '@/features/editor/SectionContent.vue';
import SectionLoadingSkeleton from '@/features/editor/SectionLoadingSkeleton.vue';
import { useTransicionSeccion } from '@/composables/useTransicionSeccion';
import ExcelPreviewModal from '@/features/editor/ExcelPreviewModal.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import AppLoadingScreen from '@/components/AppLoadingScreen.vue';
import ClienteFichaTopBar from './ClienteFichaTopBar.vue';
import EjemplosReferenciaPanel from './EjemplosReferenciaPanel.vue';
import FuenteVerdadModal from './FuenteVerdadModal.vue';
import LlenadoIAProgresoModal from './LlenadoIAProgresoModal.vue';
import AsesorIAChat from './AsesorIAChat.vue';
import HistorialFichaModal from './HistorialFichaModal.vue';
import { useClienteFichaEditor } from '@/composables/useClienteFichaEditor';
import { useLlenadoIAAsyncQuery, useIniciarLlenadoIAAsync, useCancelarLlenadoIAAsync } from '@/composables/useLlenadoIAAsync';
import { useLlenadoTablaIA } from '@/composables/useLlenadoTablaIA';
import { opcionesLlenadoCascada } from '@/lib/cascadaProblemaObjetivo';
import { opcionesEstaticasPorColumna } from '@/lib/opcionesEstaticasTabla';
import { valorTablaPareceVacio, valoresTablaSonIguales } from '@/lib/tableRowHelpers';
import { useUiStore } from '@/stores/ui';

const route = useRoute();
const ejemploId = computed(() => route.params.ejemploId as string);

const {
  ejemplo, plantilla, cargandoFicha, archivoEjemplo, esNivel0, diasRestantes,
  soloLectura, permiteMejoraIA, muestraHistorial, showHistorial, showFuenteVerdad,
  esPropietario, ejemplosReferencia, referenciaId, referenciaEjemplo,
  editedValores, leftWidth, activeTab, examplesWidth, showPreview, showInsertConfirm, isInserting, insertProgress, insertProgressLabel,
  modoEdicion, borradoresPorCampo, confirmarBorradorCampo, fuentesPorCampo, origenPorCampo, setFuenteCampo, marcarAutocompletadoPorIA, advertenciasPorCampo, setAdvertenciasCampo,
  errores, erroresCount, progreso, erroresPorSeccion,
  secciones, safeIdx, seccionActiva, isFirst, isLast,
  handleLeftResize, handleExamplesResize, handleSectionSelect, goToPrevSection, goToNextSection, handleValueChange,
  handleSave, iniciarDescarga, confirmarInsertarYDescargar, abrirVistaPrevia,
  nombreArchivoDescarga,
  excelVivo,
} = useClienteFichaEditor(ejemploId);

const { data: trabajoLlenadoIA } = useLlenadoIAAsyncQuery(ejemploId);
const iniciarLlenadoIAAsync = useIniciarLlenadoIAAsync();
const cancelarLlenadoIAAsync = useCancelarLlenadoIAAsync();
const trabajoLlenadoIAActivo = computed(
  () => trabajoLlenadoIA.value?.estado === 'pendiente' || trabajoLlenadoIA.value?.estado === 'procesando',
);
const showCancelarLlenadoConfirm = ref(false);

const { cargandoPorCampo: cargandoTablaIAPorCampo, erroresPorCampo: erroresTablaIAPorCampo, llenarTabla } = useLlenadoTablaIA(ejemploId);
const ui = useUiStore();

// Cambiar de sección o de pestaña (Mi ficha/Ejemplos de referencia) remonta SectionContent entero —
// decenas de FieldCard volviendo a consultar su celda en el Excel vivo. Sin este estado de carga, ese
// trabajo síncrono se sentía como que la pantalla se congelaba (ver useTransicionSeccion).
const claveSeccion = computed(() => (seccionActiva.value ? `${seccionActiva.value.id}:${activeTab.value}` : null));
const { cargando: cargandoSeccion, claveMostrada: claveSeccionMostrada } = useTransicionSeccion(claveSeccion);

const showLlenadoIAProgreso = ref(false);
// Mientras hay un llenado async en curso, "Contexto IA" muestra en qué va ese trabajo en vez de
// abrir el modal para INICIAR uno nuevo (confuso mientras uno ya está corriendo — y el backend
// igual lo rechazaría con 409 "ya hay un llenado en curso").
function abrirContextoIA() {
  if (trabajoLlenadoIAActivo.value) {
    showLlenadoIAProgreso.value = true;
    return;
  }
  showFuenteVerdad.value = true;
}

async function onLlenarTablaIA(campoId: string, identificador: string, seccionId: string): Promise<{ fuente: string; advertencias: string[]; sinCambios: boolean; vacio: boolean } | null> {
  const antes = editedValores.value[identificador] ?? '';
  // Sección 5 (Problema-Objetivo): 3 de sus tablas dependen de un desplegable del Excel que a su vez
  // depende de otro campo (INDIRECT en cascada) — se resuelven las opciones vigentes ANTES de llamar
  // a la IA, para que no tenga que adivinar el catálogo. Ver frontend/src/lib/cascadaProblemaObjetivo.ts.
  let opciones = opcionesLlenadoCascada(identificador, excelVivo.value);
  // Cualquier OTRA tabla puede tener una columna con desplegable fijo en el Excel que el JSON de
  // estructura no capturó como `opciones` (encontrado en vivo: 08.03.1 "¿Se incluye como parte del
  // PI?" — la IA proponía "Sí", que no es ninguna de las 2 opciones reales del Excel). Se resuelve
  // igual para CUALQUIER tabla, no solo para las de cascada — ver opcionesEstaticasTabla.ts.
  if (!opciones && excelVivo.value) {
    const seccion = plantilla.value?.secciones.find((s) => s.id === seccionId);
    const campo = seccion?.subsecciones.flatMap((sub) => sub.campos).find((c) => c.identificador === identificador);
    if (campo?.configTabla && seccion?.hoja) {
      const opcionesPorColumna = opcionesEstaticasPorColumna(excelVivo.value, seccion.hoja, campo.configTabla);
      if (Object.keys(opcionesPorColumna).length > 0) {
        opciones = { opcionesPorColumna };
      }
    }
  }
  const resultado = await llenarTabla(campoId, identificador, seccionId, opciones);
  if (resultado === null) return null;

  const sinCambios = valoresTablaSonIguales(antes, resultado.valorJson);
  onValueChange(campoId, identificador, resultado.valorJson);
  // Lo que llena la IA se confirma solo; lo que escribe el usuario sigue pidiendo Confirmar (pedido
  // explícito). Sin esto, onValueChange dejaba la propuesta como BORRADOR —la misma vía que una
  // edición a mano— y el usuario tenía que ir tabla por tabla apretando Confirmar para algo que ni
  // siquiera escribió él. El indicador azul de origen no se ve afectado: sigue saliendo de
  // marcarAutocompletadoPorIA() de abajo, vía calcularCambios().
  confirmarBorradorCampo(campoId, identificador);
  setFuenteCampo(identificador, resultado.fuente);
  // Aparte de setFuenteCampo: esa función descarta fuentes vacías, pero la tabla sí se llenó con
  // IA — sin esto el historial de cambios la registraba como "Editó" (ver calcularCambios).
  marcarAutocompletadoPorIA(identificador);
  setAdvertenciasCampo(identificador, resultado.advertencias);
  return {
    fuente: resultado.fuente,
    advertencias: resultado.advertencias,
    sinCambios,
    vacio: valorTablaPareceVacio(resultado.valorJson),
  };
}

/** Botón "?" de una tabla (ver FieldCard.vue) — abre el chat, muestra el pedido como si el usuario lo
 * hubiera escrito ("Ayúdame a llenar la tabla X") y delega el llenado real a onLlenarTablaIA (misma
 * resolución de opciones de cascada, mismo endpoint, mismo borrador aplicado al campo) — ver
 * AsesorIAChat.vue::solicitarAyudaTabla. */
function onAyudaIATabla(campoId: string, identificador: string, seccionId: string) {
  void asesorIAChatRef.value?.solicitarAyudaTabla(identificador, () => onLlenarTablaIA(campoId, identificador, seccionId));
}

async function iniciarLlenadoIA(payload?: { seccionIds?: string[] }) {
  try {
    await iniciarLlenadoIAAsync.mutateAsync({ ejemploId: ejemploId.value, seccionIds: payload?.seccionIds });
    ui.toast('Llenado con IA iniciado en segundo plano — puedes seguir navegando; te avisaremos por correo cuando termine');
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo iniciar el llenado con IA', 'error');
  }
}

async function confirmarCancelarLlenadoIA() {
  try {
    await cancelarLlenadoIAAsync.mutateAsync(ejemploId.value);
    ui.toast('Llenado con IA cancelado.');
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo cancelar el llenado con IA', 'error');
  } finally {
    showCancelarLlenadoConfirm.value = false;
    showLlenadoIAProgreso.value = false;
  }
}

function onValueChange(campoId: string, campoIdentificador: string, value: string) {
  handleValueChange(campoId, campoIdentificador, value);
}

function onConfirmarBorrador(campoId: string, identificador: string) {
  confirmarBorradorCampo(campoId, identificador);
}

// Asesor de IA (chat flotante) — "ayúdame a llenar el campo X": un solo campo resaltado a la vez,
// controlado desde AsesorIAChat.vue (busca/desambigua contra plantilla.secciones, que ya tiene cargada).
const campoResaltadoIdentificador = ref<string | null>(null);
const asesorIAChatRef = ref<InstanceType<typeof AsesorIAChat> | null>(null);

/** Botón "?" de un campo (ver FieldCard.vue) — abre el chat y dispara la MISMA consulta que
 * "ayúdame a llenar/verificar el campo X", sin que el usuario tenga que escribirlo. */
function onAyudaIACampo(identificador: string, modo: 'llenar' | 'verificar') {
  void asesorIAChatRef.value?.solicitarAyudaCampo(identificador, modo);
}

function onAplicarValorDesdeChat(payload: { campoId: string; identificador: string; valor: string }) {
  onValueChange(payload.campoId, payload.identificador, payload.valor);
  onConfirmarBorrador(payload.campoId, payload.identificador);
}

async function onGuardar() {
  await handleSave();
}
</script>

<template>
  <!-- `cargandoFicha` distingue "todavía no llegó la respuesta" de "no existe" — sin esto, se veía
       "Ficha no encontrada" por un instante real en cada entrada, antes de que ejemplo/plantilla
       terminaran de resolver (ver useClienteFichaEditor.ts). -->
  <AppLoadingScreen v-if="cargandoFicha" />
  <div v-else-if="!ejemplo || !esPropietario" class="p-8 flex flex-col items-center justify-center text-center h-full">
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
      :cargando-accion-archivo="isInserting"
      :llenadoIAActivo="trabajoLlenadoIAActivo"
      @change-tab="activeTab = $event"
      @historial="showHistorial = true"
      @fuente-verdad="abrirContextoIA"
      @save="onGuardar"
      @download="iniciarDescarga"
      @preview="abrirVistaPrevia"
    />

    <button
      v-if="trabajoLlenadoIAActivo"
      type="button"
      @click="showLlenadoIAProgreso = true"
      class="shrink-0 border-b border-violet-100 bg-violet-50/60 hover:bg-violet-100/70 px-6 py-2 flex items-center gap-2 text-xs text-violet-700 text-left transition-colors duration-75"
    >
      <FontAwesomeIcon :icon="faSpinner" class="w-3.5 h-3.5 shrink-0 animate-spin" />
      <span>
        Llenado con IA en progreso{{ trabajoLlenadoIA?.progresoTexto ? ` — ${trabajoLlenadoIA.progresoTexto}` : '' }}.
        Puedes seguir navegando; te avisaremos por correo cuando termine.
        <span class="underline">Ver detalle</span>
      </span>
    </button>

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
          <SectionLoadingSkeleton v-if="cargandoSeccion" :cantidad-campos="seccionActiva?.cantidadCampos" />
          <SectionContent
            v-else-if="seccionActiva && claveSeccionMostrada === claveSeccion"
            :key="`${seccionActiva.id}-${activeTab}`"
            :seccion="seccionActiva"
            show-example-values
            :example-valores="activeTab === 'mi-ficha' ? editedValores : referenciaEjemplo?.valores"
            :values-editable="activeTab === 'mi-ficha' && !soloLectura"
            :errores-validacion="activeTab === 'mi-ficha' ? errores : undefined"
            :referencia-valores="activeTab === 'mi-ficha' ? referenciaEjemplo?.valores : undefined"
            :permite-mejora-i-a="activeTab === 'mi-ficha' && permiteMejoraIA"
            :modo-edicion="activeTab === 'mi-ficha' ? modoEdicion : undefined"
            :borradores-por-campo="activeTab === 'mi-ficha' ? borradoresPorCampo : undefined"
            :plantilla-codigo="plantilla.codigo"
            :cargando-tabla-i-a-por-campo="activeTab === 'mi-ficha' ? cargandoTablaIAPorCampo : undefined"
            :errores-tabla-i-a-por-campo="activeTab === 'mi-ficha' ? erroresTablaIAPorCampo : undefined"
            :fuentes-por-campo="activeTab === 'mi-ficha' ? fuentesPorCampo : undefined"
            :origen-por-campo="activeTab === 'mi-ficha' ? origenPorCampo : undefined"
            :advertencias-por-campo="activeTab === 'mi-ficha' ? advertenciasPorCampo : undefined"
            :campo-resaltado-identificador="activeTab === 'mi-ficha' ? campoResaltadoIdentificador : undefined"
            @update-example-value="(campoId, identificador, value) => onValueChange(campoId, identificador, value)"
            @confirmar-borrador="onConfirmarBorrador"
            @llenar-tabla-ia="onLlenarTablaIA"
            @ayuda-ia-campo="onAyudaIACampo"
            @ayuda-ia-tabla="onAyudaIATabla"
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

    <AsesorIAChat
      ref="asesorIAChatRef"
      :plantilla="plantilla"
      :seccion-activa-id="seccionActiva?.id ?? null"
      :permitido="permiteMejoraIA"
      :ejemplo-id="ejemploId"
      :valores-actuales="editedValores"
      @resaltar-campo="campoResaltadoIdentificador = $event"
      @aplicar-valor-campo="onAplicarValorDesdeChat"
    />

    <ConfirmModal
      :is-open="showInsertConfirm"
      title="Insertar antes de descargar"
      :message="erroresCount > 0
        ? `Todavía tienes ${erroresCount} campo${erroresCount > 1 ? 's' : ''} con error de formato. Tienes cambios sin insertar en el Excel de &quot;${ejemplo.nombre}&quot; — se insertarán con lo que llenaste hasta ahora y luego se descargará. Esta acción no se puede deshacer.`
        : `Tienes cambios sin insertar en el Excel de &quot;${ejemplo.nombre}&quot; — se insertarán y luego se descargará. Esta acción no se puede deshacer.`"
      confirm-label="Insertar y descargar"
      :progress="isInserting ? insertProgress : null"
      :progress-label="isInserting ? insertProgressLabel : null"
      @confirm="confirmarInsertarYDescargar"
      @close="showInsertConfirm = false"
    />


    <ExcelPreviewModal
      :is-open="showPreview"
      :file-url="archivoEjemplo?.dataUrl ?? null"
      :file-name="nombreArchivoDescarga()"
      :title="`${plantilla.codigo} — ${ejemplo.nombre}`"
      @close="showPreview = false"
    />

    <HistorialFichaModal :is-open="showHistorial" :ejemplo-id="ejemplo.id" :plantilla="plantilla" @close="showHistorial = false" />

    <FuenteVerdadModal
      :is-open="showFuenteVerdad"
      :ejemplo-id="ejemplo.id"
      :secciones="plantilla.secciones"
      @close="showFuenteVerdad = false"
      @iniciar-llenado="iniciarLlenadoIA"
    />

    <LlenadoIAProgresoModal
      :is-open="showLlenadoIAProgreso"
      :trabajo="trabajoLlenadoIA ?? null"
      @close="showLlenadoIAProgreso = false"
      @cancelar="showCancelarLlenadoConfirm = true"
    />

    <ConfirmModal
      :is-open="showCancelarLlenadoConfirm"
      title="¿Cancelar llenado con IA?"
      message="Se detendrá el llenado en el servidor. Los campos que ya se hayan completado antes de cancelar NO se guardarán."
      confirm-label="Sí, cancelar"
      loading-label="Cancelando…"
      :loading="cancelarLlenadoIAAsync.isPending.value"
      @confirm="confirmarCancelarLlenadoIA"
      @close="showCancelarLlenadoConfirm = false"
    />
  </div>
</template>
