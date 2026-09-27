<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { fieldTypeIcons, fieldTypeLabels, subtipoTablaLabels, columnTypeLabels, faTriangleExclamation, faClone, faTrash, faLightbulb, faWandMagicSparkles, faCheck, faCircleQuestion, faFileCode, faPen } from '@/lib/icons';
import { campoFaltaCaptura } from '@/lib/campoValidation';
import { esTablaExcluidaDeIA } from '@/lib/camposTablaExcluidosIA';
import { esCampoAyudableConIA } from '@/lib/camposAyudaIA';
import ExampleTableEditor from './ExampleTableEditor.vue';
import CampoCoordenadasInput from '@/components/CampoCoordenadasInput.vue';
import CampoImagenInput from '@/components/CampoImagenInput.vue';
import CampoArchivoInput from '@/components/CampoArchivoInput.vue';
import CampoListaInput from '@/components/CampoListaInput.vue';
import CampoEstadoIA from '@/features/cliente/CampoEstadoIA.vue';
import CampoBooleanoInput from '@/components/CampoBooleanoInput.vue';
import CampoAyudaModal from './CampoAyudaModal.vue';
import CampoFechaInput from '@/components/CampoFechaInput.vue';
import { EXCEL_VIVO } from '@/composables/useListasExcel';
import { etiquetaDeValor, textoVisibleDeNumero } from '@/lib/conversionesExcel';
import type { ModoEdicionEditor } from '@/composables/usePlantillaEditor';
import type { Campo, ConfigTabla, EstadoCampoIA, OrigenCampo } from '@/types';

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
  /** true = este campo es el sospechoso de un error de "Insertar" en el Excel (ver
   * usePlantillaEditor::señalarCampoDeErrorInsercion) — borde naranja, distinto del rojo de
   * highlightWarning (que es "a este campo le falta posición", un problema distinto). */
  errorInsercion?: boolean;
  /** Mensaje de validación del valor de ejemplo/cliente (solo modo cliente) */
  error?: string;
  /** Valor de un ejemplo de referencia autorado por el admin para este campo (solo modo cliente) */
  referenciaValor?: string;
  /** true = el plan del cliente incluye la ayuda de IA para mejorar títulos/textos (Nivel 1+); undefined = no mostrar el botón (modo admin) */
  permiteMejoraIA?: boolean;
  /** Estado del llenado IA para este campo (solo cliente, tras un llenado) */
  estadoIA?: EstadoCampoIA | null;
  /** Quién puso/tocó por última vez el valor actual ('ia'|'usuario'; null = sin completar o dato
   * legado sin este tracking) — indicador verde/azul del editor de ficha del cliente. Distinto de
   * `estadoIA` (que es sobre confianza del llenado IA, no sobre quién editó último). */
  origenCampo?: OrigenCampo | null;
  /** Código de la plantilla — solo para saber si esta tabla está en la lista de exclusión (tablas de solo-fórmula) */
  plantillaCodigo?: string;
  /** true mientras se espera la respuesta de "Llenar con IA" para esta tabla */
  cargandoTablaIA?: boolean;
  /** Mensaje de error de la última llamada a "Llenar con IA" para esta tabla, si falló */
  errorTablaIA?: string;
  /** Origen breve del valor actual ("¿de dónde salió este dato?"), si se llenó con IA */
  fuenteCampo?: string;
  /** Advertencias del último llenado con IA de esta tabla (ej. "Fila 2: no se pudo determinar el
   * UBIGEO para 'X' — revísalo y complétalo manualmente"), si las hubo */
  advertenciasCampo?: string[];
  /** Hoja de Excel de la sección a la que pertenece el campo — hace falta para localizar su celda
   * y saber si tiene lista desplegable */
  hoja?: string;
  /** Admin: live (default) | confirmar */
  modoEdicion?: ModoEdicionEditor;
  /** Borrador pendiente en modo confirmar (si existe, se muestra en el editor en vez del valor confirmado) */
  valorBorrador?: string;
  /** true = el Asesor de IA (chat flotante) está ofreciendo ayuda para ESTE campo ahora mismo —
   * outline morado brillante + scroll automático, ver AsesorIAChat.vue */
  resaltadoChat?: boolean;
}>();

const emit = defineEmits<{
  click: [];
  delete: [];
  duplicate: [];
  'view-json': [];
  'edit-json': [];
  'update-default-value': [value: string];
  'update-example-value': [value: string];
  'update-config-tabla': [config: ConfigTabla];
  'confirmar-ia': [];
  'confirmar-borrador': [];
  'llenar-tabla-ia': [];
  /** Botón "?" del campo — "llenar" si está vacío, "verificar" si ya tiene un valor (ver
   * AsesorIAChat.vue::solicitarAyudaCampo). */
  'ayuda-ia-campo': [modo: 'llenar' | 'verificar'];
  /** Botón "?" de una tabla — a diferencia de "llenar-tabla-ia" (silencioso), esto abre el chat del
   * asesor de IA, muestra el pedido como un mensaje del usuario ("Ayúdame a llenar la tabla X") y
   * llena la tabla desde ahí (ver AsesorIAChat.vue::solicitarAyudaTabla). Pedido explícito del
   * usuario: mismo patrón visual/interacción que el "?" de un campo simple, para tablas. */
  'ayuda-ia-tabla': [];
}>();

const valorEditorEl = ref<HTMLElement | null>(null);
const rootEl = ref<HTMLElement | null>(null);

// Cuando el Asesor de IA empieza a ofrecer ayuda para este campo, lo traemos a la vista — sin robarle
// el foco al chat (a diferencia de enfocarEditorValor(), que sí lo hace para "Confirmar" de IA).
watch(() => props.resaltadoChat, (val) => {
  if (!val) return;
  void nextTick(() => rootEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
});
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
const tablaExcluidaDeIA = computed(() =>
  props.plantillaCodigo ? esTablaExcluidaDeIA(props.plantillaCodigo, props.campo.identificador) : false,
);
// `configTabla.columnas` es plana: cada columna hija de un grupo (cabecera) o de un nivel
// padre/hijo ya es una entrada propia ahí, así que contar sus elementos ya cuenta subcolumnas. La
// columna dinámica (columnaDinamicaId) es la excepción: en el array cuenta como UNA entrada, pero
// se renderiza como una columna física por período — hay que sumar esas de más y restar la entrada
// original para no contarla dos veces.
const numColumnasRenderizadas = computed(() => {
  const cfg = props.campo.configTabla;
  if (!cfg) return 0;
  const base = cfg.columnas.length;
  if (cfg.columnaDinamicaId && cfg.periodos && cfg.periodos.length > 1) {
    return base - 1 + cfg.periodos.length;
  }
  return base;
});
const tablaAncha = computed(() => isTableField.value && numColumnasRenderizadas.value > 6);
const isCoordField = computed(() => props.campo.tipo === 'mapa_coordenadas');
const isBooleanoField = computed(() => props.campo.tipo === 'booleano');
const isFechaField = computed(() => props.campo.tipo === 'fecha');
// Campo tipo imagen: el valor es una URL, pero se edita con vista previa y carga de archivo.
const isImagenField = computed(() => props.campo.tipo === 'imagen');
// Campo tipo archivo: mismo criterio que imagen — el valor es una URL, con carga y vista previa propias.
const isArchivoField = computed(() => props.campo.tipo === 'archivo');
const faltaCaptura = computed(() => campoFaltaCaptura(props.campo));

// Botón "?" — "ayúdame a llenar/verificar este campo con IA" (pedido explícito del usuario). Mismo
// gate que "Mejorar con IA"/"Llenar con IA" (permiteMejoraIA !== undefined solo lo pasa la ficha del
// cliente en su tab "Mi ficha" — nunca el admin, ver ClienteFichaEditPage.vue): así este botón no
// aparece ni en Estructura ni al admin construyendo el ejemplo de referencia de la plantilla.
const mostrarAyudaIA = computed(() => !!props.editableExample && props.permiteMejoraIA !== undefined && esCampoAyudableConIA(props.campo));
const modoAyudaIA = computed<'llenar' | 'verificar'>(() => ((displayValue.value || '').trim() ? 'verificar' : 'llenar'));

// Modal de ayuda del campo (descripción + acción de IA), abierto desde el "?" — ver CampoAyudaModal.
const mostrarAyudaCampo = ref(false);
/** ¿Esta tarjeta renderiza algún "?" que abra el modal? Un campo simple lo tiene por mostrarAyudaIA;
 *  una tabla, por su propia condición en la fila de acciones (la variante ancha y la angosta usan la
 *  misma regla, `tablaAncha` solo decide cuál de las dos se pinta). Se usa para no repetir el botón
 *  de "origen del dato", que ahora vive dentro de ese mismo modal. */
const hayModalDeAyuda = computed(
  () => mostrarAyudaIA.value
    || (isTableField.value && !!props.editableExample && props.permiteMejoraIA !== undefined && !tablaExcluidaDeIA.value),
);
/** Una tabla nunca está "a medio llenar" para este efecto: si ya tiene filas con datos, se ofrece
 *  mejorar; si no, llenar. Para un campo simple alcanza con mirar si hay texto. */
const modoAyudaModal = computed<'llenar' | 'mejorar'>(() => {
  // "¿Ya está lleno?" se responde distinto según el tipo, porque cada señal falla en un caso:
  //
  //  - TABLA: por `origenCampo` (lo mismo que pinta el círculo de la tarjeta). Mirar el contenido no
  //    sirve: la tabla trae etiquetas de estructura precargadas del Excel ("Adquisición",
  //    "Mobiliario de Aula…") y valorTablaPareceVacio() las cuenta como dato real — no distingue un
  //    rótulo del molde de algo que alguien escribió. Por eso 04.01.1, con el molde vacío, ofrecía
  //    "Mejorar con IA" mientras su círculo decía "Sin completar".
  //  - CAMPO SIMPLE: por el contenido. Acá `origenCampo` es el que falla, con los datos anteriores al
  //    tracking de origen: 02.01.2 tiene "10%" cargado y ninguna entrada en el mapa, así que por
  //    origen habría ofrecido "Llenar con IA" sobre un campo lleno.
  if (isTableField.value) {
    return props.origenCampo ? 'mejorar' : 'llenar';
  }

  return (displayValue.value || '').trim() ? 'mejorar' : 'llenar';
});
/** El "?" de una tabla y el de un campo simple abren el MISMO modal, pero la acción de IA no es la
 *  misma: la tabla va por llenar-tabla-ia (endpoint propio) y el campo simple por ayuda-ia-campo
 *  (chat del asesor). Se decide acá para que el modal no tenga que saber de esa diferencia. */
function pedirIADesdeModal() {
  mostrarAyudaCampo.value = false;
  if (isTableField.value) {
    emit('ayuda-ia-tabla');
    return;
  }
  emit('ayuda-ia-campo', modoAyudaIA.value);
}

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
// antes con la forma canónica 'true'/'false' (ver etiquetaDeValor). Si la celda tiene máscara
// (`"E-"00`) y el JSON aún trae el crudo (`1`), se muestra como en Excel (E-01).
function mostrado(valor: string | undefined): string {
  const base = etiquetaDeValor(valor || '', opcionesExcel.value, props.campo.etiquetasBooleano);
  const fmt = celdaExcel.value
    ? excel?.value?.codigoFormato?.(celdaExcel.value.hoja, celdaExcel.value.ref)
    : undefined;
  return textoVisibleDeNumero(base, fmt) ?? base;
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
const esTextoLargo = computed(() => props.campo.tipo === 'texto_largo');

const mostrarFuenteInfo = ref(false);

// Acá vivían pedirMejoraIA()/usarSugerencia()/sugerenciaIA, que alimentaban el botón de texto
// "Mejorar con IA" y su panel de sugerencia. No llamaban a ninguna IA: `mejorarTexto()` es una
// transformación local de string (src/lib/mejoraTexto.ts), un placeholder de cuando la función no
// existía todavía. Al pasar la entrada de IA al modal del "?" —que sí va al asesor real— quedaron
// sin ninguna vía de ejecución, así que se quitan en vez de dejar un panel inalcanzable.
// `mejoraTexto.ts` se deja en su lugar: ya no lo importa nadie, pero borrarlo es una decisión aparte.

function handleClick() {
  if (props.clickable) emit('click');
}

/** Al enfocar un input/celda dentro del card, se selecciona el campo entero (propiedades, borde, etc.). */
function handleFocusIn() {
  if (props.clickable && !props.isSelected) emit('click');
}

const claseContenedor = computed(() => {
  // border-2 fijo siempre: el resaltado va con outline/inset para no cambiar el box model ni empujar vecinos.
  // Máxima prioridad: el Asesor de IA está mirando este campo ahora mismo (outline morado brillante,
  // pedido explícito del usuario — nunca box-shadow con blur que desplace o tape campos vecinos).
  if (props.resaltadoChat) {
    return 'border-fuchsia-400 bg-fuchsia-50/40 outline outline-2 outline-fuchsia-500 -outline-offset-2 shadow-[0_0_0_4px_rgba(217,70,239,0.25)]';
  }
  if (faltaCaptura.value && props.highlightWarning) {
    return 'border-red-400 bg-red-50/40 animate-pulse';
  }
  if (props.errorInsercion) {
    return 'border-orange-400 bg-orange-50/40 outline outline-2 outline-orange-500 -outline-offset-2 animate-pulse';
  }
  if (props.isSelected) {
    return 'border-brand-500 bg-brand-50/30 outline outline-2 outline-brand-500 -outline-offset-2 shadow-[inset_0_0_14px_rgba(34,197,94,0.28)]';
  }
  // Quién editó último (ficha del cliente) — verde=usuario, azul=IA; sin marca = sin completar
  // (o dato legado de antes de este tracking), cae al estadoIA/default de abajo.
  // Más saturado que los tintes de `estadoIA` de abajo (pedido explícito): con bg-*-50/60 las
  // tarjetas verdes/azules casi no se distinguían de las grises al recorrer la sección de un vistazo,
  // que es justo para lo que existe este indicador. El recuadro interno del valor sigue en blanco,
  // así que gana contraste sin perder la lectura de "acá se escribe".
  if (props.origenCampo === 'usuario') {
    return 'border-emerald-400 bg-emerald-100';
  }
  if (props.origenCampo === 'ia') {
    return 'border-violet-400 bg-violet-100';
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
      // Pedido explícito del usuario: más contraste contra el fondo blanco de la página — antes
      // era bg-white/border-gray-100 y las tarjetas se perdían visualmente unas contra otras. El
      // recuadro interno "Valor por defecto" pasa a bg-white (ver más abajo) para que siga
      // leyéndose como recuadro editable, más claro que esta tarjeta que lo contiene.
      return 'border-gray-300 bg-gray-100';
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
    ref="rootEl"
    :data-campo-identificador="campo.identificador"
    @click="handleClick"
    @focusin="handleFocusIn"
    class="campo-card-cv rounded-xl border-2 p-4 transition-[background-color,border-color,outline-color,box-shadow] duration-150"
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
        <button v-if="deletable" @click.stop="emit('view-json')" type="button" class="text-gray-300 hover:text-brand-600 transition-colors p-1" title="Ver JSON de la nota">
          <FontAwesomeIcon :icon="faFileCode" class="w-3 h-3" />
        </button>
        <button v-if="deletable && showExampleValue" @click.stop="emit('edit-json')" type="button" class="text-gray-300 hover:text-brand-600 transition-colors p-1" title="Editar JSON de la nota">
          <FontAwesomeIcon :icon="faPen" class="w-3 h-3" />
        </button>
        <button v-if="deletable" @click.stop="emit('delete')" type="button" class="text-gray-300 hover:text-red-500 transition-colors p-1" title="Eliminar nota">
          <FontAwesomeIcon :icon="faTrash" class="w-3 h-3" />
        </button>
      </div>
    </div>
  </div>
  <div
    v-else
    ref="rootEl"
    :data-campo-identificador="campo.identificador"
    @click="handleClick"
    @focusin="handleFocusIn"
    class="campo-card-cv rounded-xl border-2 p-4 transition-[background-color,border-color,outline-color,box-shadow] duration-150"
    :class="[claseContenedor, clickable ? 'cursor-pointer' : '']"
  >
    <div class="flex items-start gap-3">
      <!-- El indicador de origen va montado sobre el ícono de tipo de dato (pedido explícito): un
           solo punto de lectura a la izquierda de la tarjeta, en vez de repartir "qué tipo es" a la
           izquierda y "quién lo llenó" al lado del identificador. El ring blanco lo despega del
           fondo teñido de la tarjeta, que ahora es más saturado. -->
      <div class="relative shrink-0">
        <div
          class="w-9 h-9 rounded-lg flex items-center justify-center"
          :class="isSelected ? 'bg-brand-100 text-brand-600' : 'bg-gray-50 text-gray-400'"
        >
          <FontAwesomeIcon :icon="icon" class="w-4 h-4" />
        </div>
        <span
          v-if="origenCampo !== undefined"
          class="absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm"
          :class="{
            'bg-emerald-500 text-white': origenCampo === 'usuario',
            'bg-violet-500 text-white': origenCampo === 'ia',
            'bg-white border-2 border-gray-300': !origenCampo,
          }"
          :title="origenCampo === 'usuario' ? 'Editado por el usuario' : origenCampo === 'ia' ? 'Valor sugerido por IA' : 'Sin completar'"
        >
          <FontAwesomeIcon v-if="origenCampo === 'usuario'" :icon="faCheck" class="w-3 h-3" />
          <FontAwesomeIcon v-else-if="origenCampo === 'ia'" :icon="faWandMagicSparkles" class="w-3 h-3" />
        </span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start gap-2">
          <div class="flex items-center gap-2 flex-wrap min-w-0 flex-1">
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded opacity-90" :class="isSelected ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'">
              {{ campo.identificador }}
            </span>
            <span class="font-semibold text-heading text-sm">{{ campo.etiqueta }}</span>
            <FontAwesomeIcon
              v-if="!campo.editable"
              :icon="fieldTypeIcons.calculado"
              class="w-3 h-3 text-gray-400"
              title="Campo calculado (solo lectura)"
            />
            <!-- Respaldo, no el camino normal: estos dos datos (origen del valor y advertencias) ahora
                 se muestran DENTRO del modal del "?" — ver CampoAyudaModal. Este botón sobrevive solo
                 para el caso en que la tarjeta no tenga ese modal (campo no editable, calculado,
                 imagen/firma, o tabla excluida de IA), donde si no la información quedaría
                 inalcanzable. En una tarjeta normal ya no se renderiza: era el segundo "?" al lado
                 del primero. -->
            <span
              v-if="!hayModalDeAyuda && (fuenteCampo || (advertenciasCampo && advertenciasCampo.length > 0))"
              class="relative inline-flex shrink-0"
            >
              <button
                type="button"
                @click.stop="mostrarFuenteInfo = !mostrarFuenteInfo"
                title="¿De dónde salió este dato? ¿Hay algo que revisar?"
                class="w-4 h-4 rounded-full flex items-center justify-center transition-colors"
                :class="advertenciasCampo && advertenciasCampo.length > 0
                  ? (mostrarFuenteInfo ? 'text-amber-700 bg-amber-100' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-100')
                  : (mostrarFuenteInfo ? 'text-brand-600 bg-brand-50' : 'text-gray-300 hover:text-brand-600 hover:bg-brand-50')"
              >
                <FontAwesomeIcon :icon="faCircleQuestion" class="w-3 h-3" />
              </button>
              <div
                v-if="mostrarFuenteInfo"
                @click.stop
                class="absolute z-20 top-5 left-0 w-72 p-2.5 rounded-lg bg-gray-900 text-white text-[11px] leading-snug shadow-lg space-y-2"
              >
                <div v-if="advertenciasCampo && advertenciasCampo.length > 0">
                  <p class="font-semibold text-[10px] uppercase tracking-wide text-amber-400 mb-1">Para revisar</p>
                  <ul class="space-y-1 list-disc list-inside">
                    <li v-for="(a, i) in advertenciasCampo" :key="i">{{ a }}</li>
                  </ul>
                </div>
                <div v-if="fuenteCampo">
                  <p class="font-semibold text-[10px] uppercase tracking-wide text-gray-400 mb-1">Origen del dato</p>
                  {{ fuenteCampo }}
                </div>
              </div>
            </span>
            <!-- Ya no dispara la IA directo: abre el modal con la descripción del campo, y desde ahí
                 el usuario decide. Ver CampoAyudaModal.vue. El botón queda habilitado aunque el plan
                 no incluya IA — la explicación del campo se lee igual; lo que se deshabilita es la
                 acción de IA dentro del modal. -->
            <button
              v-if="mostrarAyudaIA"
              type="button"
              @click.stop="mostrarAyudaCampo = true"
              title="¿Qué va en este campo?"
              class="w-4 h-4 rounded-full flex items-center justify-center text-violet-400 hover:text-violet-700 hover:bg-violet-50 transition-colors shrink-0"
            >
              <FontAwesomeIcon :icon="faCircleQuestion" class="w-3 h-3" />
            </button>
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
          :class="tienePendiente ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-gray-200'"
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
          <div v-else-if="isArchivoField" class="mt-1.5">
            <CampoArchivoInput :value="valorDefaultMostrado" @change="emit('update-default-value', $event)" />
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
          <div v-else-if="isBooleanoField" class="mt-1.5">
            <CampoBooleanoInput
              :value="valorDefaultMostrado"
              :etiquetas="campo.etiquetasBooleano ?? { true: 'Sí', false: 'No' }"
              variante="si_no"
              @change="emit('update-default-value', $event)"
            />
          </div>
          <CampoFechaInput
            v-else-if="isFechaField"
            :value="valorDefaultMostrado"
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
              <!-- Los botones de texto "Mejorar con IA" / "Llenar con IA" que vivían acá se quitaron:
                   la única entrada a la IA es el "?" de la cabecera (ver CampoAyudaModal.vue), que
                   además muestra la descripción del campo antes de ofrecer la acción. -->
              <button
                v-if="editableExample && isTableField && !tablaAncha && permiteMejoraIA !== undefined && !tablaExcluidaDeIA"
                type="button"
                @click.stop="mostrarAyudaCampo = true"
                title="¿Qué va en esta tabla?"
                class="w-4 h-4 rounded-full flex items-center justify-center text-violet-400 hover:text-violet-700 hover:bg-violet-50 transition-colors shrink-0"
              >
                <FontAwesomeIcon :icon="faCircleQuestion" class="w-3 h-3" />
              </button>
            </div>
          </div>
          <p v-if="isTableField && !tablaAncha && errorTablaIA" class="mt-1 text-[11px] text-red-600 flex items-center gap-1">
            <FontAwesomeIcon :icon="faTriangleExclamation" class="w-2.5 h-2.5 shrink-0" />
            {{ errorTablaIA }}
          </p>
          <!-- Tabla/coordenadas/imagen tienen forma propia — un volcado de texto plano mostraría el
               JSON crudo de la tabla, ilegible. Siempre se renderiza el widget real; si no es
               editable (tab "Ejemplos" del cliente, ficha en solo lectura), se envuelve en un
               <fieldset disabled> nativo: se ve exactamente igual pero ningún control responde,
               sin tener que duplicar la lógica de cada editor de tabla en una versión de solo lectura. -->
          <fieldset
            v-if="isCoordField || isImagenField || isArchivoField || (isTableField && campo.configTabla)"
            :disabled="!editableExample"
            class="m-0 p-0 border-0 min-w-0 mt-1.5"
          >
            <CampoCoordenadasInput v-if="isCoordField" :value="displayValue || ''" :editable="editableExample" @change="emit('update-example-value', $event)" />
            <CampoImagenInput v-else-if="isImagenField" :value="displayValue || ''" :editable="editableExample" @change="emit('update-example-value', $event)" />
            <CampoArchivoInput v-else-if="isArchivoField" :value="displayValue || ''" :editable="editableExample" @change="emit('update-example-value', $event)" />
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
            <CampoBooleanoInput
              v-else-if="isBooleanoField"
              :value="displayValue || ''"
              :etiquetas="campo.etiquetasBooleano ?? { true: 'Sí', false: 'No' }"
              variante="si_no"
              :editable="editableExample"
              @change="emit('update-example-value', $event)"
            />
            <CampoFechaInput
              v-else-if="isFechaField"
              :value="displayValue || ''"
              :editable="editableExample"
              :error="!!error"
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
          <div v-if="referenciaValor && referenciaValor.trim() && !isTableField && !isCoordField && !isImagenField && !isArchivoField" class="mt-2 flex items-start gap-2 p-2 rounded-lg bg-blue-50 border border-blue-100">
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
          @click.stop="emit('view-json')"
          type="button"
          class="text-gray-300 hover:text-brand-600 transition-colors p-1"
          title="Ver JSON del campo"
        >
          <FontAwesomeIcon :icon="faFileCode" class="w-3 h-3" />
        </button>
        <button
          v-if="deletable && showExampleValue"
          @click.stop="emit('edit-json')"
          type="button"
          class="text-gray-300 hover:text-brand-600 transition-colors p-1"
          title="Editar JSON del campo"
        >
          <FontAwesomeIcon :icon="faPen" class="w-3 h-3" />
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
      :class="tienePendiente ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-gray-200'"
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
          <!-- Igual que en la variante angosta: sin botón de texto, la IA se pide desde el "?". -->
          <button
            v-if="editableExample && permiteMejoraIA !== undefined && !tablaExcluidaDeIA"
            type="button"
            @click.stop="mostrarAyudaCampo = true"
            title="¿Qué va en esta tabla?"
            class="w-4 h-4 rounded-full flex items-center justify-center text-violet-400 hover:text-violet-700 hover:bg-violet-50 transition-colors shrink-0"
          >
            <FontAwesomeIcon :icon="faCircleQuestion" class="w-3 h-3" />
          </button>
        </div>
      </div>
      <p v-if="errorTablaIA" class="mt-1 px-1.5 text-[11px] text-red-600 flex items-center gap-1">
        <FontAwesomeIcon :icon="faTriangleExclamation" class="w-2.5 h-2.5 shrink-0" />
        {{ errorTablaIA }}
      </p>
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

  <!-- Fuera del contenedor de la tarjeta: el modal es `fixed`, y la tarjeta tiene
       `content-visibility: auto` (ver el style de abajo), que crea contexto de contención y le
       recortaría el overlay a los límites de la tarjeta. -->
  <CampoAyudaModal
    :is-open="mostrarAyudaCampo"
    :etiqueta="campo.etiqueta"
    :descripcion="campo.descripcion"
    :modo="modoAyudaModal"
    :fuente="fuenteCampo"
    :advertencias="advertenciasCampo"
    :permite-ia="permiteMejoraIA"
    :cargando="isTableField && cargandoTablaIA"
    @llenar-ia="pedirIADesdeModal"
    @close="mostrarAyudaCampo = false"
  />
</template>

<style scoped>
/* Una sección puede traer decenas de campos (Ficha Estándar real: 81) renderizados de una — sin
   esto, cualquier reflow que atraviese la página (ej. el margin-left del sidebar al
   colapsar/expandir) recalcula el layout de los 81 de una sola vez. `content-visibility: auto`
   deja que el navegador se salte layout/paint de las tarjetas fuera de pantalla; `auto` en
   contain-intrinsic-size solo usa el alto de reserva la primera vez (antes de haberse mostrado
   nunca) y luego recuerda el alto real ya medido, así que no hay salto visible de scroll en el
   uso normal (abrir la sección, bajar, y recién ahí tocar el sidebar). */
.campo-card-cv {
  content-visibility: auto;
  contain-intrinsic-size: auto 220px;
}
</style>
