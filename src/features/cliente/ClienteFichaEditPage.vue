<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
import type { SeccionProgresoIA } from './ProcesamientoIAModal.vue';
import ResultadoLlenadoIAModal from './ResultadoLlenadoIAModal.vue';
import AsesorIAChat from './AsesorIAChat.vue';
import AsesoriaHumanaFAB from './AsesoriaHumanaFAB.vue';
import HistorialFichaModal from './HistorialFichaModal.vue';
import { useClienteFichaEditor } from '@/composables/useClienteFichaEditor';
import { useLlenadoIAProgreso } from '@/composables/useLlenadoIAProgreso';
import { useLlenadoTablaIA } from '@/composables/useLlenadoTablaIA';
import { opcionesLlenadoCascada } from '@/lib/cascadaProblemaObjetivo';
import { opcionesEstaticasPorColumna } from '@/lib/opcionesEstaticasTabla';
import { esTablaExcluidaDeIA } from '@/lib/camposTablaExcluidosIA';
import { useUiStore } from '@/stores/ui';

const route = useRoute();
const ejemploId = computed(() => route.params.ejemploId as string);

const {
  ejemplo, plantilla, archivoEjemplo, esNivel0, diasRestantes,
  soloLectura, permiteMejoraIA, muestraHistorial, showHistorial, showFuenteVerdad,
  esPropietario, ejemplosReferencia, referenciaId, referenciaEjemplo,
  editedValores, leftWidth, activeTab, examplesWidth, showPreview, showInsertConfirm, isInserting, insertProgress, insertProgressLabel,
  modoEdicion, borradoresPorCampo, confirmarBorradorCampo, confirmarTodosLosBorradores, fuentesPorCampo, setFuenteCampo, advertenciasPorCampo, setAdvertenciasCampo,
  errores, erroresCount, progreso, erroresPorSeccion,
  secciones, safeIdx, seccionActiva, isFirst, isLast,
  handleLeftResize, handleExamplesResize, handleSectionSelect, goToPrevSection, goToNextSection, handleValueChange,
  handleSave, iniciarDescarga, confirmarInsertarYDescargar, abrirVistaPrevia,
  nombreArchivoDescarga,
  excelVivo,
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
  enRevisionIA,
  resaltarVerResumen,
  iniciar: iniciarLlenadoIAJob,
  abrirSiHaySesion,
  cerrarProgreso: cerrarProcesamientoIA,
  verResultados: verResultadosLlenadoIA,
  cerrarResultado: cerrarResultadoLlenadoIA,
  terminarProceso: terminarProcesoLlenadoIA,
  confirmarCampoIA,
  alEditarCampoIA,
  cancelar: cancelarLlenadoIAJob,
  // Temporal (2026-08-30): la Batch API de OpenAI está caída para cualquier organización desde el
  // 19/08 ("Cannot find file... organization does not have access to it", confirmado reproduciendo
  // el error con una llamada cruda a la API, sin nada de nuestro código de por medio — ver
  // https://community.openai.com/t/batch-api-batches-create-intermittently-fails-with-cannot-find-file-for-hours-after-upload-despite-files-retrieve-showing-status-processed/1393234).
  // Mientras dure, se usa este composable síncrono (llama /llenar-ia una vez por sección, en vez de
  // useLlenadoIALote que arma un batch) — ya probado en vivo, 20/20 secciones + 1 tabla exitosas. NO
  // llena tablas automáticamente al terminar por sí solo — por eso el watch de faseLlenadoIA de más
  // abajo encadena la fase 2 (llenarTablasFaltantes), que recorre TODAS las tablas elegibles con su
  // propia llamada, usando el mismo useLlenadoTablaIA de abajo que nunca usó Batch API.
} = useLlenadoIAProgreso(plantilla, ejemploId);

const { cargandoPorCampo: cargandoTablaIAPorCampo, erroresPorCampo: erroresTablaIAPorCampo, llenarTabla } = useLlenadoTablaIA(ejemploId);
const ui = useUiStore();

const showCancelarLlenadoConfirm = ref(false);
/** Parpadeo de "Guardar" en la topbar tras un llenado con IA — se prende cuando el sistema termina
 * de auto-confirmar los borradores de una fase (ver el watch de faseLlenadoIA y el final de
 * llenarTablasFaltantes) y se apaga al hacer clic en Guardar (ver onGuardar). Reemplaza al
 * botón "Terminar" que existía antes: ya no hace falta un paso explícito de "terminar de revisar",
 * el propio Guardar cumple ese rol. */
const resaltarGuardar = ref(false);
/** Qué lista muestra el modal de progreso: secciones de texto (fase 1, vía lote) o tablas (fase 2)
 * — ver llenarTablasFaltantes(). Sin esto, el modal reutilizado mostraba "Progreso por sección" con
 * nombres de tablas adentro, y alguien que eligió 2 secciones veía "4" ítems sin entender por qué. */
const modoProgresoIA = ref<'secciones' | 'tablas'>('secciones');

/** useLlenadoIALote no expone un `cancelado` propio (su cancelar() solo deja de pollear en esta
 * pestaña — el lote sigue en OpenAI) — la fase 2 síncrona de tablas, que corre en esta misma página
 * después de que el lote termina, necesita su propia bandera de cancelación. */
const canceladoFaseTablasIA = ref(false);
/** Evita reentradas: llenarTablasFaltantes() vuelve a poner faseLlenadoIA en 'completado' al
 * terminar, lo que re-dispara el watch de abajo si no se protege. */
const faseTablasYaEjecutada = ref(false);
const seccionIdsPendientesFaseTablas = ref<string[] | null>(null);

function marcarItemProgresoIA(id: string, patch: Partial<SeccionProgresoIA>) {
  seccionesProgresoIA.value = seccionesProgresoIA.value.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

// Mientras Batch API esté caída (ver el comentario junto a useLlenadoIAProgreso arriba), el llenado
// de secciones de texto es síncrono y NO propone tablas por su cuenta — por eso encadena la fase 2
// acá: recorre TODAS las tablas elegibles de la ficha (mismo criterio de exclusión que el backend,
// ver camposTablaExcluidosIA.ts) y las llena una por una, igual que hacía el lote antes de que se
// quitara aplicarTablasPropuestasDelLote de este archivo.
watch(faseLlenadoIA, (fase) => {
  if (fase !== 'completado' || faseTablasYaEjecutada.value) return;
  faseTablasYaEjecutada.value = true;
  // Proceso de sistema, no de IA (no cuesta nada): confirma los campos de texto que la IA propuso,
  // sin esperar a que el usuario haga clic en "Confirmar" uno por uno. Lo único pendiente después de
  // esto es persistir con Guardar, por eso se prende su parpadeo.
  confirmarTodosLosBorradores();
  resaltarGuardar.value = true;
  void llenarTablasFaltantes(seccionIdsPendientesFaseTablas.value);
});

function confirmarCancelarLlenadoIA() {
  showCancelarLlenadoConfirm.value = false;
  canceladoFaseTablasIA.value = true;
  cancelarLlenadoIAJob();
}

function abrirContextoIA() {
  if (abrirSiHaySesion()) return;
  showFuenteVerdad.value = true;
}

async function onLlenarTablaIA(campoId: string, identificador: string, seccionId: string) {
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
  if (resultado !== null) {
    onValueChange(campoId, identificador, resultado.valorJson);
    setFuenteCampo(identificador, resultado.fuente);
    setAdvertenciasCampo(identificador, resultado.advertencias);
  }
}

async function iniciarLlenadoIA(payload?: { seccionIds?: string[] }) {
  modoProgresoIA.value = 'secciones';
  canceladoFaseTablasIA.value = false;
  faseTablasYaEjecutada.value = false;
  seccionIdsPendientesFaseTablas.value = payload?.seccionIds ?? null;
  // useLlenadoIAProgreso.iniciar() SÍ espera a que termine la última sección antes de resolver (a
  // diferencia del lote, que resolvía apenas se agendaba el primer poll) — el `await` de acá ya
  // podría encadenar la fase 2 directamente, pero se deja el watch de faseLlenadoIA de arriba para no
  // tocar esa mecánica (funciona igual sin importar cuándo resuelva esta promesa).
  await iniciarLlenadoIAJob(ejemploId.value, payload?.seccionIds);
}

async function llenarTablasFaltantes(seccionIds: string[] | null) {
  if (!plantilla.value) return;
  const filtro = seccionIds && seccionIds.length > 0 ? new Set(seccionIds) : null;
  const tablas: { campoId: string; identificador: string; seccionId: string; etiqueta: string }[] = [];
  for (const seccion of plantilla.value.secciones) {
    if (filtro && !filtro.has(seccion.id)) continue;
    for (const sub of seccion.subsecciones) {
      for (const campo of sub.campos) {
        if (
          (campo.tipo === 'tabla' || campo.tipo === 'tabla_jerarquica')
          && campo.editable
          && campo.configTabla
          && !esTablaExcluidaDeIA(plantilla.value.codigo, campo.identificador)
        ) {
          tablas.push({ campoId: campo.id, identificador: campo.identificador, seccionId: seccion.id, etiqueta: campo.etiqueta });
        }
      }
    }
  }
  if (tablas.length === 0) return;

  // Reabre el modal de progreso (mismo componente que ya usan las secciones de texto), ahora con las
  // tablas en la lista en vez de las secciones — sin esto, el modal ya se habría cerrado (o estaría
  // mostrando el resumen de texto) mientras las tablas siguen procesándose en silencio, sin ninguna
  // forma visible de cancelarlas.
  seccionesProgresoIA.value = tablas.map((t) => ({ id: t.campoId, nombre: t.etiqueta, estado: 'pendiente' as const }));
  modoProgresoIA.value = 'tablas';
  showResultadoLlenadoIA.value = false;
  faseLlenadoIA.value = 'procesando';
  showProcesamientoIA.value = true;

  let hechas = 0;
  let conError = 0;
  for (const t of tablas) {
    if (canceladoFaseTablasIA.value) break;
    marcarItemProgresoIA(t.campoId, { estado: 'procesando' });
    // Secuencial (no Promise.all): cada tabla es su propia consulta al modelo — en paralelo
    // saturaríamos el backend/la API y perderíamos el orden en que se ve el progreso por campo.
    await onLlenarTablaIA(t.campoId, t.identificador, t.seccionId);
    // valoresPorCelda (useMapaValoresExcelDebounced) recalcula el Excel vivo con 300ms de debounce —
    // sin esperar aquí, la SIGUIENTE tabla de una cascada (ej. 5.02.02 justo después de 5.01.02) podía
    // pedir sus opciones antes de que ese recálculo aterrizara, y veía la tabla anterior como si aún
    // estuviera vacía. Encontrado en vivo: con el fix de leer borradores en resolverValorExcel, 3 de
    // 4 filas de medios/acciones ya salían bien, pero la primera (procesada inmediatamente después de
    // 5.01.02, sin ningún await de por medio) seguía en blanco — exactamente el patrón de una
    // condición de carrera con el debounce, no del contexto en sí.
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (erroresTablaIAPorCampo.value[t.campoId]) {
      conError++;
      marcarItemProgresoIA(t.campoId, { estado: 'error' });
    } else {
      hechas++;
      marcarItemProgresoIA(t.campoId, { estado: 'completada' });
    }
  }

  if (canceladoFaseTablasIA.value) {
    // Deja el modal abierto mostrando el aviso, igual que al cancelar durante las secciones de texto.
    mensajeErrorLlenadoIA.value = `Cancelaste el llenado con IA. ${hechas} tabla${hechas === 1 ? '' : 's'} ya completada${hechas === 1 ? '' : 's'} se conserva${hechas === 1 ? '' : 'n'}.`;
    faseLlenadoIA.value = 'error';
    return;
  }

  // Mismo proceso de sistema que la fase 1: confirma las tablas solas, sin pedirle al usuario que
  // las apruebe una por una — solo queda persistir con Guardar.
  confirmarTodosLosBorradores();
  resaltarGuardar.value = true;

  faseLlenadoIA.value = 'completado';
  showProcesamientoIA.value = false;
  ui.toast(
    conError > 0
      ? `${hechas} de ${tablas.length} tablas llenadas con IA (${conError} con error) — revísalas y guarda los cambios`
      : `${hechas} tabla${hechas === 1 ? '' : 's'} llenada${hechas === 1 ? '' : 's'} con IA — guarda los cambios cuando quieras`,
  );
}

function onValueChange(campoId: string, campoIdentificador: string, value: string) {
  handleValueChange(campoId, campoIdentificador, value);
  alEditarCampoIA(campoIdentificador, value);
}

function onConfirmarBorrador(campoId: string, identificador: string) {
  confirmarBorradorCampo(campoId, identificador);
  alEditarCampoIA(identificador, editedValores.value[identificador] ?? '');
}

// El botón "Guardar" de la topbar ahora hace las veces del antiguo botón "Terminar": los borradores
// de la IA ya se confirmaron solos (ver los dos puntos de confirmarTodosLosBorradores() más arriba),
// así que Guardar solo necesita persistir — y, si había una revisión de IA en curso, cerrarla (apaga
// las marcas Extraído/Inferido/No encontrado y el rótulo "Ver resumen" vuelve a "Contexto IA").
async function onGuardar() {
  resaltarGuardar.value = false;
  const habiaRevisionIA = enRevisionIA.value;
  await handleSave();
  if (habiaRevisionIA) terminarProcesoLlenadoIA();
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
      :en-revision-i-a="enRevisionIA"
      :resaltar-ver-resumen="resaltarVerResumen"
      :resaltar-guardar="resaltarGuardar"
      :cargando-accion-archivo="isInserting"
      @change-tab="activeTab = $event"
      @historial="showHistorial = true"
      @fuente-verdad="abrirContextoIA"
      @save="onGuardar"
      @download="iniciarDescarga"
      @preview="abrirVistaPrevia"
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
            :modo-edicion="activeTab === 'mi-ficha' ? modoEdicion : undefined"
            :borradores-por-campo="activeTab === 'mi-ficha' ? borradoresPorCampo : undefined"
            :plantilla-codigo="plantilla.codigo"
            :cargando-tabla-i-a-por-campo="activeTab === 'mi-ficha' ? cargandoTablaIAPorCampo : undefined"
            :errores-tabla-i-a-por-campo="activeTab === 'mi-ficha' ? erroresTablaIAPorCampo : undefined"
            :fuentes-por-campo="activeTab === 'mi-ficha' ? fuentesPorCampo : undefined"
            :advertencias-por-campo="activeTab === 'mi-ficha' ? advertenciasPorCampo : undefined"
            @update-example-value="(campoId, identificador, value) => onValueChange(campoId, identificador, value)"
            @confirmar-borrador="onConfirmarBorrador"
            @confirmar-ia="confirmarCampoIA"
            @llenar-tabla-ia="onLlenarTablaIA"
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
      title="Insertar antes de descargar"
      :message="erroresCount > 0
        ? `Todavía tienes ${erroresCount} campo${erroresCount > 1 ? 's' : ''} pendiente${erroresCount > 1 ? 's' : ''} o con errores. Tienes cambios sin insertar en el Excel de &quot;${ejemplo.nombre}&quot; — se insertarán con lo que llenaste hasta ahora y luego se descargará. Esta acción no se puede deshacer.`
        : `Tienes cambios sin insertar en el Excel de &quot;${ejemplo.nombre}&quot; — se insertarán y luego se descargará. Esta acción no se puede deshacer.`"
      confirm-label="Insertar y descargar"
      :progress="isInserting ? insertProgress : null"
      :progress-label="isInserting ? insertProgressLabel : null"
      @confirm="confirmarInsertarYDescargar"
      @close="showInsertConfirm = false"
    />

    <ConfirmModal
      :is-open="showCancelarLlenadoConfirm"
      title="Cancelar llenado con IA"
      message="Se detendrá el llenado automático (textos y tablas). Lo que ya se completó hasta ahora se conserva; lo que falta quedará pendiente."
      confirm-label="Cancelar llenado"
      @confirm="confirmarCancelarLlenadoIA"
      @close="showCancelarLlenadoConfirm = false"
    />

    <ExcelPreviewModal
      :is-open="showPreview"
      :file-url="archivoEjemplo?.dataUrl ?? null"
      :file-name="nombreArchivoDescarga()"
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
    v-if="faseLlenadoIA === 'procesando' || faseLlenadoIA === 'error'"
    :is-open="showProcesamientoIA"
    :secciones="seccionesProgresoIA"
    :fase="faseLlenadoIA === 'error' ? 'error' : 'procesando'"
    :mensaje-error="mensajeErrorLlenadoIA"
    :esperando-servidor="esperandoServidorLlenadoIA"
    :modo="modoProgresoIA"
    @close="cerrarProcesamientoIA()"
    @ver-resultados="verResultadosLlenadoIA()"
    @cancelar="showCancelarLlenadoConfirm = true"
  />

  <ResultadoLlenadoIAModal
    :is-open="showResultadoLlenadoIA"
    :resumen="resumenResultado"
    @close="cerrarResultadoLlenadoIA()"
    @revisar="cerrarResultadoLlenadoIA()"
  />
</template>
