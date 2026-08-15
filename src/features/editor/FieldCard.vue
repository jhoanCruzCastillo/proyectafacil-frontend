<script setup lang="ts">
import { computed, inject, nextTick, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { fieldTypeIcons, fieldTypeLabels, subtipoTablaLabels, columnTypeLabels, faTriangleExclamation, faClone, faTrash, faLightbulb, faWandMagicSparkles, faSpinner, faCheck } from '@/lib/icons';
import { campoFaltaCaptura } from '@/lib/campoValidation';
import { mejorarTexto } from '@/lib/mejoraTexto';
import ExampleTableEditor from './ExampleTableEditor.vue';
import CampoCoordenadasInput from '@/components/CampoCoordenadasInput.vue';
import CampoImagenInput from '@/components/CampoImagenInput.vue';
import CampoListaInput from '@/components/CampoListaInput.vue';
import CampoEstadoIA from '@/features/cliente/CampoEstadoIA.vue';
import { EXCEL_VIVO } from '@/composables/useListasExcel';
import { etiquetaDeValor } from '@/lib/conversionesExcel';
import type { ModoEdicionEditor } from '@/composables/usePlantillaEditor';
import type { Campo, ConfigTabla, EstadoCampoIA } from '@/types';

const props = defineProps<{
  campo: Campo;
  isSelected?: boolean;
  showExampleValue?: boolean;
  exampleValue?: string;
  /** true = muestra el editor de "valor por defecto" (solo tab Estructura) */
  editableDefault?: boolean;
  /** true = el valor de ejemplo es editable (tab Ejemplos) */
  editableExample?: boolean;
  clickable?: boolean;
  deletable?: boolean;
  /** true = muestra el botón de duplicar (solo tab Estructura, donde se edita el molde) */
  duplicable?: boolean;
  highlightWarning?: boolean;
  /** Mensaje de validación del valor de ejemplo/cliente (solo modo cliente) */
  error?: string;
  /** Valor de un ejemplo de referencia autorado por el admin para este campo (solo modo cliente) */
  referenciaValor?: string;
  /** true = el plan del cliente incluye la ayuda de IA para mejorar títulos/textos (Nivel 1+); undefined = no mostrar el botón (modo admin) */
  permiteMejoraIA?: boolean;
  /** Estado del llenado IA para este campo (solo cliente, tras un llenado) */
  estadoIA?: EstadoCampoIA | null;
  /** Hoja de Excel de la sección a la que pertenece el campo — hace falta para localizar su celda
   * y saber si tiene lista desplegable */
  hoja?: string;
  /** Admin: live (default) | confirmar */
  modoEdicion?: ModoEdicionEditor;
  /** Borrador pendiente en modo confirmar (si existe, se muestra en el editor en vez del valor confirmado) */
  valorBorrador?: string;
}>();

const emit = defineEmits<{
  click: [];
  delete: [];
  duplicate: [];
  'update-default-value': [value: string];
  'update-example-value': [value: string];
  'update-config-tabla': [config: ConfigTabla];
  'confirmar-ia': [];
  'confirmar-borrador': [];
}>();

const valorEditorEl = ref<HTMLElement | null>(null);
const tienePendiente = computed(
  () => (props.modoEdicion ?? 'live') === 'confirmar' && props.valorBorrador !== undefined,
);

async function enfocarEditorValor() {
  await nextTick();
  valorEditorEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const focusable = valorEditorEl.value?.querySelector<HTMLElement>(
    'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  focusable?.focus();
}

function onConfirmarIA() {
  emit('confirmar-ia');
  void enfocarEditorValor();
}

const icon = computed(() => fieldTypeIcons[props.campo.tipo]);
const typeLabel = computed(() => fieldTypeLabels[props.campo.tipo]);
/** Valor mostrado en editores: borrador pendiente (modo confirmar) o el valor ya confirmado. */
const displayValue = computed(() =>
  props.valorBorrador !== undefined
    ? props.valorBorrador
    : (props.exampleValue ?? props.campo.valorEjemplo),
);
const valorDefaultMostrado = computed(() =>
  props.valorBorrador !== undefined ? props.valorBorrador : (props.campo.valorEjemplo || ''),
);
const isTableField = computed(() => props.campo.tipo === 'tabla' || props.campo.tipo === 'tabla_jerarquica');
// `configTabla.columnas` es plana: cada columna hija de un grupo (cabecera) o de un nivel
// padre/hijo ya es una entrada propia ahí, así que contar sus elementos ya cuenta subcolumnas.
const tablaAncha = computed(() => isTableField.value && (props.campo.configTabla?.columnas.length ?? 0) > 6);
const isCoordField = computed(() => props.campo.tipo === 'mapa_coordenadas');
// Campo tipo imagen: el valor es una URL, pero se edita con vista previa y carga de archivo.
const isImagenField = computed(() => props.campo.tipo === 'imagen');
const faltaCaptura = computed(() => campoFaltaCaptura(props.campo));

// Ayudas leídas del Excel asignado (no de la estructura JSON): las opciones del desplegable de esta
// celda, y —si la celda es una fórmula— el valor que el Excel calcularía ahí con los datos actuales.
// Si no hay Excel o la celda no aplica, quedan en undefined y el campo se comporta como siempre.
const excel = inject(EXCEL_VIVO, undefined);
const celdaExcel = computed(() => {
  const captura = props.campo.captura;
  if (!excel?.value || !props.hoja || !captura?.columna || !captura.fila) return null;
  return { hoja: props.hoja, ref: `${captura.columna}${captura.fila}` };
});

const opcionesExcel = computed(() =>
  celdaExcel.value ? excel?.value?.opcionesDe(celdaExcel.value.hoja, celdaExcel.value.ref) : undefined,
);
const tieneLista = computed(() => (opcionesExcel.value?.length ?? 0) > 0);

// El valor guardado ya es la palabra del Excel; la traducción solo entra para lo que se guardó
// antes con la forma canónica 'true'/'false' (ver etiquetaDeValor).
function mostrado(valor: string | undefined): string {
  return etiquetaDeValor(valor || '', opcionesExcel.value, props.campo.etiquetasBooleano);
}

// Celda con fórmula: el Excel manda. No se escribe nunca (el escritor ya respeta las fórmulas del
// archivo), así que se muestra en solo lectura en vez de un input que no llevaría a nada.
const calculoExcel = computed(() =>
  celdaExcel.value ? excel?.value?.calculado(celdaExcel.value.hoja, celdaExcel.value.ref) : undefined,
);
const esCalculadaPorExcel = computed(() => calculoExcel.value !== undefined);
// Preferimos el resultado vivo; si no hay (fórmula no soportada / sin caché en el Excel asignado),
// usamos el valor volcado o el valor por defecto ya guardado en el JSON.
const textoCalculadoMostrar = computed(() => {
  const vivo = calculoExcel.value?.texto?.trim() ?? '';
  if (vivo) return vivo;
  const guardado = (displayValue.value || '').trim();
  return guardado || '';
});
const esCampoTexto = computed(() => props.campo.tipo === 'texto_corto' || props.campo.tipo === 'texto_largo');
const esTextoLargo = computed(() => props.campo.tipo === 'texto_largo');

const sugerenciaIA = ref<string | null>(null);
const cargandoIA = ref(false);

function pedirMejoraIA() {
  cargandoIA.value = true;
  sugerenciaIA.value = null;
  setTimeout(() => {
    sugerenciaIA.value = mejorarTexto(displayValue.value || '');
    cargandoIA.value = false;
  }, 500);
}

function usarSugerencia() {
  if (sugerenciaIA.value === null) return;
  emit('update-example-value', sugerenciaIA.value);
  sugerenciaIA.value = null;
}

function handleClick() {
  if (props.clickable) emit('click');
}

/** Al enfocar un input/celda dentro del card, se selecciona el campo entero (propiedades, borde, etc.). */
function handleFocusIn() {
  if (props.clickable && !props.isSelected) emit('click');
}

const claseContenedor = computed(() => {
  // border-2 fijo siempre: el resaltado va con outline/inset para no cambiar el box model ni empujar vecinos.
  if (faltaCaptura.value && props.highlightWarning) {
    return 'border-red-400 bg-red-50/40 animate-pulse';
  }
  if (props.isSelected) {
    return 'border-brand-500 bg-brand-50/30 outline outline-2 outline-brand-500 -outline-offset-2 shadow-[inset_0_0_14px_rgba(34,197,94,0.28)]';
  }
  // Tras llenado IA: el card entero refleja el estado (ver mock Extraído / Inferido / No encontrado).
  switch (props.estadoIA) {
    case 'extraido':
      return 'border-emerald-200 bg-emerald-50/60';
    case 'inferido':
      return 'border-sky-200 bg-sky-50/60';
    case 'requiere_confirmacion':
      return 'border-amber-200 bg-amber-50/50';
    case 'no_encontrado':
      return 'border-rose-200 bg-rose-50/60';
    default:
      return 'border-gray-100 bg-white';
  }
});

/** Caja "Valor de ejemplo": tinte acorde al estado IA (sin pisar el ámbar de borrador pendiente). */
const claseCajaEjemplo = computed(() => {
  if (tienePendiente.value) return 'bg-amber-50/70 border-amber-300';
  switch (props.estadoIA) {
    case 'extraido':
      return 'bg-emerald-50/90 border-emerald-200';
    case 'inferido':
      return 'bg-sky-50/90 border-sky-200';
    case 'requiere_confirmacion':
      return 'bg-amber-50/80 border-amber-200';
    case 'no_encontrado':
      return 'bg-rose-50/80 border-rose-200';
    default:
      return 'bg-brand-100/70 border-brand-200';
  }
});

const claseLabelEjemplo = computed(() => {
  if (tienePendiente.value) return 'text-amber-700';
  switch (props.estadoIA) {
    case 'extraido':
      return 'text-emerald-700';
    case 'inferido':
      return 'text-sky-700';
    case 'requiere_confirmacion':
      return 'text-amber-700';
    case 'no_encontrado':
      return 'text-rose-700';
    default:
      return 'text-brand-600';
  }
});
</script>

<template>
  <!-- Nota (4.11): no es un campo real, es un bloque de texto que el admin deja entre los campos.
       Se muestra igual al cliente, siempre en solo lectura — se edita únicamente desde el panel de
       propiedades en Estructura (ver FieldPropertiesPanel). -->
  <div
    v-if="campo.tipo === 'nota'"
    @click="handleClick"
    @focusin="handleFocusIn"
    class="rounded-xl border-2 p-4 transition-[background-color,border-color,outline-color,box-shadow] duration-150"
    :class="[claseContenedor, clickable ? 'cursor-pointer' : '']"
  >
    <div class="flex items-start gap-3">
      <p class="flex-1 min-w-0 font-semibold text-heading text-sm whitespace-pre-wrap break-words">
        <span v-if="campo.valorEjemplo">{{ campo.valorEjemplo }}</span>
        <span v-else class="text-muted italic font-normal">Nota vacía…</span>
      </p>
      <div v-if="duplicable || deletable" class="flex flex-col gap-1 shrink-0">
        <button v-if="duplicable" @click.stop="emit('duplicate')" type="button" class="text-gray-300 hover:text-brand-600 transition-colors p-1" title="Duplicar nota">
          <FontAwesomeIcon :icon="faClone" class="w-3 h-3" />
        </button>
        <button v-if="deletable" @click.stop="emit('delete')" type="button" class="text-gray-300 hover:text-red-500 transition-colors p-1" title="Eliminar nota">
          <FontAwesomeIcon :icon="faTrash" class="w-3 h-3" />
        </button>
      </div>
    </div>
  </div>
  <div
    v-else
    @click="handleClick"
    @focusin="handleFocusIn"
    class="rounded-xl border-2 p-4 transition-[background-color,border-color,outline-color,box-shadow] duration-150"
    :class="[claseContenedor, clickable ? 'cursor-pointer' : '']"
  >
    <div class="flex items-start gap-3">
      <div
        class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        :class="isSelected ? 'bg-brand-100 text-brand-600' : 'bg-gray-50 text-gray-400'"
      >
        <FontAwesomeIcon :icon="icon" class="w-4 h-4" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start gap-2">
          <div class="flex items-center gap-2 flex-wrap min-w-0 flex-1">
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded opacity-90" :class="isSelected ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'">
              {{ campo.identificador }}
            </span>
            <span class="font-semibold text-heading text-sm">{{ campo.etiqueta }}</span>
            <span v-if="campo.requerido" class="text-red-500 text-sm" title="Obligatorio">*</span>
            <FontAwesomeIcon
              v-if="!campo.editable"
              :icon="fieldTypeIcons.calculado"
              class="w-3 h-3 text-gray-400"
              title="Campo calculado (solo lectura)"
            />
            <span
              v-if="faltaCaptura"
              title="Falta registrar su posición en el Excel (columna/fila) — no se insertará al Excel hasta configurarla"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-semibold shrink-0"
            >
              <FontAwesomeIcon :icon="faTriangleExclamation" class="w-2.5 h-2.5" />
              Sin posición Excel
            </span>
          </div>
          <CampoEstadoIA
            v-if="estadoIA"
            :estado="estadoIA"
            :editable="editableExample"
            @confirmar="onConfirmarIA"
            @agregar-valor="enfocarEditorValor"
          />
        </div>
        <div class="text-xs text-muted mt-1 flex items-center gap-2">
          <span>{{ typeLabel }}</span>
          <span v-if="campo.fuenteCatalogo" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[11px]">
            {{ campo.fuenteCatalogo }}
          </span>
        </div>
        <div v-if="campo.tipo === 'catalogo_encadenado' && campo.cadena" class="flex flex-wrap items-center gap-1 mt-2">
          <span v-for="(step, i) in campo.cadena" :key="i" class="flex items-center gap-1">
            <span class="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{{ step }}</span>
            <span v-if="i < campo.cadena.length - 1" class="text-gray-300 text-xs">→</span>
          </span>
        </div>
        <div v-if="isTableField && campo.configTabla && campo.configTabla.columnas.length > 0" class="mt-2">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {{ subtipoTablaLabels[campo.configTabla.subtipo] }}
            </span>
            <span class="text-[10px] text-muted">· {{ campo.configTabla.columnas.length }} columnas</span>
          </div>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="col in campo.configTabla.columnas"
              :key="col.id"
              class="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-600"
              :title="columnTypeLabels[col.tipo]"
            >
              {{ col.nombre }}
            </span>
          </div>
        </div>

        <!-- Celda que el Excel calcula solo: no se edita, se muestra el resultado en vivo. Aplica
             igual en Estructura y en Ejemplos — en Ejemplos reemplaza al input de "Valor de
             ejemplo", porque teclear ahí no tendría efecto: al insertar en el Excel las fórmulas se
             respetan y se recalculan solas. Si la mini-calculadora no cubre la fórmula, se muestra
             el valor volcado/cacheado (displayValue) cuando exista. -->
        <div v-if="(editableDefault || showExampleValue) && esCalculadaPorExcel" class="mt-2 p-2.5 rounded-lg bg-sky-50/60 border border-sky-200" @click.stop>
          <span class="text-[10px] font-bold uppercase tracking-wider text-sky-700 flex items-center gap-1">
            <FontAwesomeIcon :icon="fieldTypeIcons.calculado" class="w-2.5 h-2.5" />
            Lo calcula el Excel
          </span>
          <p v-if="textoCalculadoMostrar" class="text-sm text-heading mt-1 break-words whitespace-pre-wrap">{{ textoCalculadoMostrar }}</p>
          <p v-else-if="calculoExcel?.error" class="text-xs text-amber-700 mt-1 font-mono">{{ calculoExcel.error }}</p>
          <p v-else-if="calculoExcel && !calculoExcel.soportado" class="text-xs text-sky-800/70 italic mt-1">
            La fórmula de esta celda usa algo que todavía no sabemos calcular — su valor aparecerá al abrir el Excel.
          </p>
          <p v-else class="text-xs text-muted italic mt-1">Vacío — depende de otros campos que aún no tienen valor.</p>
        </div>

        <div
          v-else-if="editableDefault && !tablaAncha"
          class="mt-2 p-2.5 rounded-lg border"
          :class="tienePendiente ? 'bg-amber-50/70 border-amber-300' : 'bg-gray-50 border-gray-200'"
          @click.stop
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Valor por defecto</span>
            <button
              v-if="tienePendiente"
              type="button"
              @click.stop="emit('confirmar-borrador')"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
            >
              <FontAwesomeIcon :icon="faCheck" class="w-2.5 h-2.5" />
              Confirmar
            </button>
          </div>
          <div v-if="isCoordField" class="mt-1.5">
            <CampoCoordenadasInput :value="valorDefaultMostrado" @change="emit('update-default-value', $event)" />
          </div>
          <div v-else-if="isImagenField" class="mt-1.5">
            <CampoImagenInput :value="valorDefaultMostrado" @change="emit('update-default-value', $event)" />
          </div>
          <ExampleTableEditor
            v-else-if="isTableField && campo.configTabla"
            :config="(campo.configTabla as ConfigTabla)"
            :model-value="valorDefaultMostrado"
            :puede-editar-periodos="true"
            :hoja="hoja"
            @update:model-value="emit('update-default-value', $event)"
            @update:config="emit('update-config-tabla', $event)"
          />
          <CampoListaInput
            v-else-if="tieneLista"
            :value="mostrado(valorDefaultMostrado)"
            :opciones="opcionesExcel ?? []"
            @change="emit('update-default-value', $event)"
          />
          <textarea
            v-else-if="esTextoLargo"
            :value="valorDefaultMostrado"
            @input="emit('update-default-value', ($event.target as HTMLTextAreaElement).value)"
            rows="1"
            placeholder="Valor inicial por defecto..."
            class="block w-full mt-1 px-2 py-1.5 rounded border border-gray-200 bg-white text-sm text-heading focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 resize-none overflow-y-auto max-h-[15lh] [field-sizing:content]"
          />
          <input
            v-else
            :value="valorDefaultMostrado"
            @input="emit('update-default-value', ($event.target as HTMLInputElement).value)"
            type="text"
            :placeholder="!campo.editable ? '=1.01.1+1.02.3' : 'Valor inicial por defecto...'"
            class="w-full mt-1 px-2 py-1.5 rounded border border-gray-200 bg-white text-sm text-heading focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
          />
        </div>

        <div
          v-if="showExampleValue && !esCalculadaPorExcel && !tablaAncha"
          ref="valorEditorEl"
          class="mt-2 p-2.5 rounded-lg border"
          :class="claseCajaEjemplo"
          @click.stop
        >
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider" :class="claseLabelEjemplo">Valor de ejemplo</span>
            <div class="flex items-center gap-2">
              <button
                v-if="tienePendiente"
                type="button"
                @click.stop="emit('confirmar-borrador')"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
              >
                <FontAwesomeIcon :icon="faCheck" class="w-2.5 h-2.5" />
                Confirmar
              </button>
              <button
                v-if="editableExample && esCampoTexto && permiteMejoraIA !== undefined"
                @click.stop="pedirMejoraIA"
                :disabled="!permiteMejoraIA || cargandoIA || !(displayValue || '').trim()"
                type="button"
                :title="!permiteMejoraIA ? 'Disponible desde Nivel 1 — actualiza tu plan' : undefined"
                class="inline-flex items-center gap-1 text-[10px] font-medium text-violet-600 hover:text-violet-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <FontAwesomeIcon :icon="cargandoIA ? faSpinner : faWandMagicSparkles" class="w-2.5 h-2.5" :class="cargandoIA ? 'animate-spin' : ''" />
                Mejorar con IA
              </button>
            </div>
          </div>
          <!-- Tabla/coordenadas/imagen tienen forma propia — un volcado de texto plano mostraría el
               JSON crudo de la tabla, ilegible. Siempre se renderiza el widget real; si no es
               editable (tab "Ejemplos" del cliente, ficha en solo lectura), se envuelve en un
               <fieldset disabled> nativo: se ve exactamente igual pero ningún control responde,
               sin tener que duplicar la lógica de cada editor de tabla en una versión de solo lectura. -->
          <fieldset
            v-if="isCoordField || isImagenField || (isTableField && campo.configTabla)"
            :disabled="!editableExample"
            class="m-0 p-0 border-0 min-w-0 mt-1.5"
          >
            <CampoCoordenadasInput v-if="isCoordField" :value="displayValue || ''" :editable="editableExample" @change="emit('update-example-value', $event)" />
            <CampoImagenInput v-else-if="isImagenField" :value="displayValue || ''" :editable="editableExample" @change="emit('update-example-value', $event)" />
            <ExampleTableEditor
              v-else-if="isTableField && campo.configTabla"
              :config="(campo.configTabla as ConfigTabla)"
              :model-value="displayValue || ''"
              :hoja="hoja"
              @update:model-value="emit('update-example-value', $event)"
            />
          </fieldset>
          <div v-else-if="!editableExample" class="text-sm text-heading mt-0.5">
            {{ displayValue || '' }}
            <span v-if="!displayValue" class="text-muted italic">Sin valor</span>
          </div>
          <template v-else>
            <CampoListaInput
              v-if="tieneLista"
              :value="mostrado(displayValue)"
              :opciones="opcionesExcel ?? []"
              :editable="editableExample"
              @change="emit('update-example-value', $event)"
            />
            <textarea
              v-else-if="esTextoLargo"
              :value="displayValue || ''"
              @input="emit('update-example-value', ($event.target as HTMLTextAreaElement).value)"
              rows="1"
              placeholder="Escribe el valor de ejemplo..."
              class="block w-full mt-1 px-2 py-1.5 rounded border bg-white text-sm text-heading focus:outline-none focus:ring-2 resize-none overflow-y-auto max-h-[15lh] [field-sizing:content]"
              :class="error ? 'border-red-400 focus:ring-red-300 focus:border-red-400' : 'border-brand-200 focus:ring-brand-500/30 focus:border-brand-500'"
            />
            <input
              v-else
              :value="displayValue || ''"
              @input="emit('update-example-value', ($event.target as HTMLInputElement).value)"
              type="text"
              placeholder="Escribe el valor de ejemplo..."
              class="w-full mt-1 px-2 py-1.5 rounded border bg-white text-sm text-heading focus:outline-none focus:ring-2"
              :class="error ? 'border-red-400 focus:ring-red-300 focus:border-red-400' : 'border-brand-200 focus:ring-brand-500/30 focus:border-brand-500'"
            />
            <p v-if="error" class="mt-1 text-[11px] text-red-600 flex items-center gap-1">
              <FontAwesomeIcon :icon="faTriangleExclamation" class="w-2.5 h-2.5 shrink-0" />
              {{ error }}
            </p>
          </template>
          <div v-if="referenciaValor && referenciaValor.trim() && !isTableField && !isCoordField && !isImagenField" class="mt-2 flex items-start gap-2 p-2 rounded-lg bg-blue-50 border border-blue-100">
            <FontAwesomeIcon :icon="faLightbulb" class="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-[10px] font-bold uppercase tracking-wider text-blue-500">Ejemplo de referencia</p>
              <p class="text-xs text-blue-900 mt-0.5 break-words whitespace-pre-wrap">{{ referenciaValor }}</p>
            </div>
            <button
              v-if="editableExample"
              @click.stop="emit('update-example-value', referenciaValor)"
              type="button"
              class="text-[11px] font-medium text-blue-600 hover:text-blue-800 shrink-0"
            >
              Usar
            </button>
          </div>
          <div v-if="sugerenciaIA !== null && esCampoTexto && editableExample" class="mt-2 flex items-start gap-2 p-2 rounded-lg bg-violet-50 border border-violet-100">
            <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3 h-3 text-violet-400 mt-0.5 shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-[10px] font-bold uppercase tracking-wider text-violet-500">Sugerencia de IA</p>
              <p v-if="sugerenciaIA === (displayValue || '').trim()" class="text-xs text-violet-700 mt-0.5 italic">
                Tu redacción ya está clara — no encontramos mejoras.
              </p>
              <p v-else class="text-xs text-violet-900 mt-0.5 break-words whitespace-pre-wrap">{{ sugerenciaIA }}</p>
            </div>
            <button
              v-if="sugerenciaIA !== (displayValue || '').trim()"
              @click.stop="usarSugerencia"
              type="button"
              class="text-[11px] font-medium text-violet-600 hover:text-violet-800 shrink-0"
            >
              Usar
            </button>
          </div>
        </div>
      </div>
      <div v-if="duplicable || deletable" class="flex flex-col gap-1 shrink-0">
        <button
          v-if="duplicable"
          @click.stop="emit('duplicate')"
          type="button"
          class="text-gray-300 hover:text-brand-600 transition-colors p-1"
          title="Duplicar campo"
        >
          <FontAwesomeIcon :icon="faClone" class="w-3 h-3" />
        </button>
        <button
          v-if="deletable"
          @click.stop="emit('delete')"
          type="button"
          class="text-gray-300 hover:text-red-500 transition-colors p-1"
          title="Eliminar campo"
        >
          <FontAwesomeIcon :icon="faTrash" class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Tablas de más de 6 columnas (subcolumnas incluidas) se apretaban en el ancho de la columna
         de contenido, angosta por el icono a la izquierda y los botones a la derecha. Como bloque
         aparte, fuera de esa fila, puede ignorar el padding de la tarjeta (-mx-4) y ocupar su ancho
         completo en vez de quedar comprimida. -->
    <div
      v-if="tablaAncha && editableDefault && !esCalculadaPorExcel"
      class="mt-2 -mx-4 py-2.5 border-t border-b"
      :class="tienePendiente ? 'bg-amber-50/70 border-amber-300' : 'bg-gray-50 border-gray-200'"
      @click.stop
    >
      <div class="flex items-center justify-between gap-2 px-1.5">
        <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Valor por defecto</span>
        <button
          v-if="tienePendiente"
          type="button"
          @click.stop="emit('confirmar-borrador')"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
        >
          <FontAwesomeIcon :icon="faCheck" class="w-2.5 h-2.5" />
          Confirmar
        </button>
      </div>
      <ExampleTableEditor
        v-if="campo.configTabla"
        :config="(campo.configTabla as ConfigTabla)"
        :model-value="valorDefaultMostrado"
        :puede-editar-periodos="true"
        :hoja="hoja"
        class="mt-1.5"
        @update:model-value="emit('update-default-value', $event)"
        @update:config="emit('update-config-tabla', $event)"
      />
    </div>
    <div
      v-if="tablaAncha && showExampleValue && !esCalculadaPorExcel"
      ref="valorEditorEl"
      class="mt-2 -mx-4 py-2.5 border-t border-b"
      :class="claseCajaEjemplo"
      @click.stop
    >
      <div class="flex items-center justify-between px-1.5">
        <span class="text-[10px] font-bold uppercase tracking-wider" :class="claseLabelEjemplo">Valor de ejemplo</span>
        <button
          v-if="tienePendiente"
          type="button"
          @click.stop="emit('confirmar-borrador')"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
        >
          <FontAwesomeIcon :icon="faCheck" class="w-2.5 h-2.5" />
          Confirmar
        </button>
      </div>
      <fieldset :disabled="!editableExample" class="m-0 p-0 border-0 min-w-0 mt-1.5">
        <ExampleTableEditor
          v-if="campo.configTabla"
          :config="(campo.configTabla as ConfigTabla)"
          :model-value="displayValue || ''"
          :hoja="hoja"
          @update:model-value="emit('update-example-value', $event)"
        />
      </fieldset>
    </div>
  </div>
</template>
