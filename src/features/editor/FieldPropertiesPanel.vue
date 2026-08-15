<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCode, faLeaf, faPencil, faSave } from '@/lib/icons';
import { fieldTypeIcons, fieldTypeLabels, faTriangleExclamation } from '@/lib/icons';
import { parseCampoJson, stringifyCampoJson } from '@/lib/campoJson';
import { campoFaltaCaptura } from '@/lib/campoValidation';
import { parseCoords } from '@/lib/coords';
import TableColumnsEditor from './TableColumnsEditor.vue';
import CampoCoordenadasInput from '@/components/CampoCoordenadasInput.vue';
import type { ModoEdicionEditor } from '@/composables/usePlantillaEditor';
import type { Campo, TipoCampo, CapturaCampo, ConfigTabla } from '@/types';

const props = defineProps<{
  campo: Campo;
  autoFocusEtiqueta?: boolean;
  ejemplosCount: number;
  /** live = cada cambio aplica ya; confirmar = borrador hasta Guardar (no toca Excel vivo) */
  modoEdicion?: ModoEdicionEditor;
}>();

const emit = defineEmits<{ update: [campoId: string, updates: Partial<Campo>] }>();

const allowedFieldTypes: TipoCampo[] = ['texto_corto', 'texto_largo', 'numero', 'decimal', 'fecha', 'booleano', 'mapa_coordenadas', 'tabla'];
const allFieldTypes = allowedFieldTypes.map((k) => [k, fieldTypeLabels[k]] as [TipoCampo, string]);

const defaultTableConfig: ConfigTabla = { subtipo: 'filas_dinamicas', columnas: [] };

type PropiedadesTab = 'ui' | 'json';

function cloneCampo(c: Campo): Campo {
  return JSON.parse(JSON.stringify(c));
}

/** Copia de trabajo: en confirmar se edita aquÃ­ hasta Guardar; en live se espeja y se emite ya. */
const local = ref<Campo>(cloneCampo(props.campo));
const dirty = ref(false);
const activeTab = ref<PropiedadesTab>('ui');
const jsonText = ref('');
const jsonBaseline = ref('');
const jsonError = ref<string | null>(null);

const esConfirmar = computed(() => (props.modoEdicion ?? 'live') === 'confirmar');
const tienePendiente = computed(() => esConfirmar.value && dirty.value);
const jsonDirty = computed(() => jsonText.value !== jsonBaseline.value);
const puedeGuardarJson = computed(() => {
  if (!jsonDirty.value || jsonError.value) return false;
  return parseCampoJson(jsonText.value).ok;
});
const puedeCambiarAUi = computed(() => !jsonDirty.value);
const mostrarGuardar = computed(() =>
  activeTab.value === 'json' ? true : esConfirmar.value,
);
const puedeGuardar = computed(() =>
  activeTab.value === 'json' ? puedeGuardarJson.value : tienePendiente.value,
);

watch(
  () => props.campo.id,
  () => {
    local.value = cloneCampo(props.campo);
    dirty.value = false;
    activeTab.value = 'ui';
    jsonText.value = '';
    jsonBaseline.value = '';
    jsonError.value = null;
  },
);

// Tras Guardar (o correcciÃ³n externa) el padre manda el campo ya aplicado: resincronizar si no hay borrador.
watch(
  () => props.campo,
  (c) => {
    if (dirty.value || jsonDirty.value) return;
    local.value = cloneCampo(c);
    if (activeTab.value === 'json') syncJsonFromLocal();
  },
  { deep: true },
);

watch(
  () => props.modoEdicion,
  (modo) => {
    if (modo === 'live' && dirty.value && activeTab.value === 'ui') {
      // Al pasar a live no se confirman solos los borradores de propiedades.
      local.value = cloneCampo(props.campo);
      dirty.value = false;
    }
  },
);

const vista = computed(() => local.value);
const icon = computed(() => fieldTypeIcons[vista.value.tipo]);
const typeLabel = computed(() => fieldTypeLabels[vista.value.tipo]);
const isTable = computed(() => vista.value.tipo === 'tabla' || vista.value.tipo === 'tabla_jerarquica');
const faltaCaptura = computed(() => campoFaltaCaptura(vista.value));
const coords = computed(() => parseCoords(vista.value.valorEjemplo));

const etiquetaInput = ref<HTMLInputElement | null>(null);
const notaInput = ref<HTMLTextAreaElement | null>(null);
const jsonTextarea = ref<HTMLTextAreaElement | null>(null);

function focusEtiqueta() {
  if (!props.autoFocusEtiqueta) return;
  // Doble tick: el panel derecho puede montarse/scrollar después del primer paint.
  nextTick(() => {
    nextTick(() => {
      if (vista.value.tipo === 'nota') {
        notaInput.value?.focus();
        notaInput.value?.scrollIntoView({ block: 'nearest' });
        return;
      }
      etiquetaInput.value?.focus();
      etiquetaInput.value?.select();
    });
  });
}
onMounted(focusEtiqueta);
watch(() => props.campo.id, () => nextTick(focusEtiqueta));
watch(() => props.autoFocusEtiqueta, (v) => { if (v) nextTick(focusEtiqueta); });

function syncJsonFromLocal() {
  const pretty = stringifyCampoJson(local.value);
  jsonText.value = pretty;
  jsonBaseline.value = pretty;
  jsonError.value = null;
}

function selectTab(tab: PropiedadesTab) {
  if (tab === activeTab.value) return;
  if (tab === 'ui' && !puedeCambiarAUi.value) return;
  if (tab === 'json') {
    syncJsonFromLocal();
    nextTick(() => jsonTextarea.value?.focus());
  }
  activeTab.value = tab;
}

function onJsonInput(value: string) {
  jsonText.value = value;
  if (!value.trim()) {
    jsonError.value = 'El JSON no puede estar vacÃ­o.';
    return;
  }
  const result = parseCampoJson(value);
  jsonError.value = result.ok ? null : result.error;
}

function diffContraPadre(desde: Campo = local.value): Partial<Campo> {
  const origen = props.campo;
  const updates: Partial<Campo> = {};
  const keys = new Set([...Object.keys(origen), ...Object.keys(desde)]) as Set<keyof Campo>;
  for (const key of keys) {
    if (JSON.stringify(origen[key]) !== JSON.stringify(desde[key])) {
      (updates as Record<string, unknown>)[key] = desde[key];
    }
  }
  // Si el JSON omitiÃ³ claves opcionales que el padre tenÃ­a, hay que limpiarlas.
  for (const key of Object.keys(origen) as (keyof Campo)[]) {
    if (!(key in desde) && origen[key] !== undefined) {
      (updates as Record<string, unknown>)[key] = undefined;
    }
  }
  return updates;
}

function update(updates: Partial<Campo>) {
  local.value = { ...local.value, ...updates };
  if (esConfirmar.value) {
    dirty.value = true;
    return;
  }
  emit('update', props.campo.id, updates);
}

function guardarUi() {
  if (!tienePendiente.value) return;
  const updates = diffContraPadre();
  if (Object.keys(updates).length === 0) {
    dirty.value = false;
    return;
  }
  dirty.value = false;
  // Un solo emit â†’ un solo rebuild del Excel vivo (la parte lenta).
  emit('update', props.campo.id, updates);
}

function guardarJson() {
  const result = parseCampoJson(jsonText.value);
  if (!result.ok) {
    jsonError.value = result.error;
    return;
  }
  // El id interno ancla la selecciÃ³n en el Ã¡rbol; no se deja cambiar desde el JSON.
  const next: Campo = { ...result.campo, id: props.campo.id };
  local.value = next;
  dirty.value = false;
  const updates = diffContraPadre(next);
  jsonBaseline.value = stringifyCampoJson(next);
  jsonText.value = jsonBaseline.value;
  jsonError.value = null;
  if (Object.keys(updates).length > 0) {
    emit('update', props.campo.id, updates);
  }
}

function guardar() {
  if (activeTab.value === 'json') {
    guardarJson();
    return;
  }
  guardarUi();
}

function updateCaptura(patch: Partial<CapturaCampo>) {
  update({
    captura: {
      columna: local.value.captura?.columna ?? '',
      fila: local.value.captura?.fila ?? 0,
      abarcaColumnas: local.value.captura?.abarcaColumnas,
      abarcaFilas: local.value.captura?.abarcaFilas,
      ...patch,
    },
  });
}

function handleTypeChange(e: Event) {
  const newType = (e.target as HTMLSelectElement).value as TipoCampo;
  const updates: Partial<Campo> = { tipo: newType };
  if ((newType === 'tabla' || newType === 'tabla_jerarquica') && !local.value.configTabla) {
    updates.configTabla = { ...defaultTableConfig, subtipo: newType === 'tabla_jerarquica' ? 'jerarquica' : 'filas_dinamicas' };
  }
  update(updates);
}

function updateCoords(lat: number, lng: number) {
  update({ valorEjemplo: JSON.stringify({ lat, lng }) });
}
</script>
<template>
  <div class="space-y-4">
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-xs font-semibold uppercase tracking-widest text-muted shrink-0">
          {{ vista.tipo === 'nota' ? 'Nota' : 'Propiedades del campo' }}
        </h3>
        <div class="flex items-center gap-2 shrink-0">
          <button
            v-if="mostrarGuardar"
            type="button"
            :disabled="!puedeGuardar"
            :title="activeTab === 'json'
              ? 'Aplicar el JSON del campo'
              : 'Aplicar cambios y actualizar el Excel vivo'"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :class="puedeGuardar ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-gray-100 text-gray-400'"
            @click="guardar"
          >
            <FontAwesomeIcon :icon="faSave" class="w-3 h-3" />
            Guardar
          </button>
          <span
            v-if="vista.tipo !== 'nota'"
            class="text-xs font-bold px-2 py-1 rounded bg-brand-100 text-brand-700"
          >{{ vista.identificador }}</span>
        </div>
      </div>

      <div class="flex rounded-lg border border-gray-200 overflow-hidden">
        <button
          type="button"
          class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors"
          :class="activeTab === 'ui' ? 'bg-brand-50 text-brand-700' : 'bg-white text-gray-400 hover:text-heading'"
          :disabled="!puedeCambiarAUi && activeTab === 'json'"
          :title="!puedeCambiarAUi && activeTab === 'json'
            ? 'Guarda el JSON o restáuralo a su estado original para volver a la UI'
            : 'Editar con formularios'"
          @click="selectTab('ui')"
        >
          <FontAwesomeIcon :icon="faPencil" class="w-3 h-3" />
          UI
        </button>
        <button
          type="button"
          class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l border-gray-200"
          :class="activeTab === 'json' ? 'bg-brand-50 text-brand-700' : 'bg-white text-gray-400 hover:text-heading'"
          title="Editar el JSON del campo"
          @click="selectTab('json')"
        >
          <FontAwesomeIcon :icon="faCode" class="w-3 h-3" />
          JSON
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'json'" class="space-y-2">
      <textarea
        ref="jsonTextarea"
        :value="jsonText"
        @input="onJsonInput(($event.target as HTMLTextAreaElement).value)"
        spellcheck="false"
        rows="22"
        class="w-full px-3 py-2 rounded-lg border text-[11px] font-mono leading-relaxed resize-y min-h-[280px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        :class="jsonError
          ? 'border-red-300 bg-red-50/40'
          : jsonDirty
            ? 'border-amber-300 bg-amber-50/30'
            : 'border-gray-200'"
      />
      <p v-if="jsonError" class="text-[11px] text-red-600 font-medium leading-snug">
        {{ jsonError }}
      </p>
      <p v-else-if="jsonDirty" class="text-[11px] text-amber-700 leading-snug">
        Hay cambios sin guardar. Guarda el JSON o restáuralo para volver a la pestaña UI.
      </p>
      <p v-else class="text-[11px] text-muted leading-snug">
        Edita la forma interna del campo. El <span class="font-mono">id</span> se conserva al guardar.
      </p>
    </div>

    <template v-else-if="vista.tipo === 'nota'">
      <textarea
        ref="notaInput"
        :value="vista.valorEjemplo || ''"
        @input="update({ valorEjemplo: ($event.target as HTMLTextAreaElement).value })"
        rows="4"
        placeholder="Escribe la nota…"
        class="w-full px-3 py-2 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        :class="tienePendiente ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'"
      />
    </template>

    <div v-else class="space-y-5">
      <div
        class="flex items-center gap-3 pb-4 border-b"
        :class="tienePendiente ? 'border-amber-200' : 'border-gray-100'"
      >
        <div class="w-10 h-10 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center">
          <FontAwesomeIcon :icon="icon" class="w-5 h-5" />
        </div>
        <div>
          <div class="font-semibold text-heading text-sm">{{ vista.etiqueta }}</div>
          <div class="text-xs text-muted">{{ typeLabel }}</div>
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-heading mb-1.5">Identificador</label>
        <input
          :value="vista.identificador"
          @input="update({ identificador: ($event.target as HTMLInputElement).value })"
          type="text"
          class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-heading mb-1.5">Etiqueta</label>
        <input
          ref="etiquetaInput"
          :value="vista.etiqueta"
          @input="update({ etiqueta: ($event.target as HTMLInputElement).value })"
          type="text"
          class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-heading mb-1.5">Tipo de campo</label>
        <div class="relative">
          <select
            :value="vista.tipo"
            @change="handleTypeChange"
            class="w-full px-3 py-2 pl-9 rounded-lg border border-gray-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white"
          >
            <option v-for="[key, label] in allFieldTypes" :key="key" :value="key">{{ label }}</option>
          </select>
          <FontAwesomeIcon :icon="icon" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-heading mb-1.5">Comportamiento</label>
        <div class="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            @click="update({ editable: true })"
            type="button"
            class="flex-1 px-4 py-2 text-sm font-medium transition-colors duration-75"
            :class="vista.editable ? 'bg-brand-50 text-brand-600' : 'bg-white text-gray-400'"
          >
            Editable
          </button>
          <button
            @click="update({ editable: false, valorEjemplo: !isTable && !vista.valorEjemplo ? '=' : vista.valorEjemplo })"
            type="button"
            class="flex-1 px-4 py-2 text-sm font-medium transition-colors duration-75"
            :class="!vista.editable ? 'bg-brand-50 text-brand-600' : 'bg-white text-gray-400'"
          >
            Calculado
          </button>
        </div>
      </div>

      <div v-if="vista.editable && !isTable">
        <label class="block text-xs font-medium text-heading mb-1.5">Obligatorio para el cliente</label>
        <div class="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            @click="update({ requerido: false })"
            type="button"
            class="flex-1 px-4 py-2 text-sm font-medium transition-colors duration-75"
            :class="!vista.requerido ? 'bg-brand-50 text-brand-600' : 'bg-white text-gray-400'"
          >
            No
          </button>
          <button
            @click="update({ requerido: true })"
            type="button"
            class="flex-1 px-4 py-2 text-sm font-medium transition-colors duration-75"
            :class="vista.requerido ? 'bg-brand-50 text-brand-600' : 'bg-white text-gray-400'"
          >
            Sí
          </button>
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-heading mb-1.5">Descripción / ayuda</label>
        <textarea
          :value="vista.descripcion || ''"
          @input="update({ descripcion: ($event.target as HTMLTextAreaElement).value })"
          rows="2"
          class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
      </div>

      <div v-if="vista.tipo === 'catalogo_simple' || vista.tipo === 'catalogo_encadenado'">
        <label class="block text-xs font-medium text-heading mb-1.5">Fuente de catálogo</label>
        <input
          :value="vista.fuenteCatalogo || ''"
          @input="update({ fuenteCatalogo: ($event.target as HTMLInputElement).value })"
          type="text"
          placeholder="Ej. UBIGEO, Niveles de gobierno..."
          class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
      </div>

      <div v-if="!isTable" class="pt-3 border-t border-gray-100">
        <div class="flex items-center gap-2 mb-2">
          <label class="text-xs font-semibold uppercase tracking-widest text-muted">Ubicación en Excel</label>
          <span
            v-if="faltaCaptura"
            title="Sin columna/fila no se puede insertar el valor de este campo en el Excel"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-semibold"
          >
            <FontAwesomeIcon :icon="faTriangleExclamation" class="w-2.5 h-2.5" />
            Obligatorio
          </span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[10px] font-medium text-muted mb-1">Columna</label>
            <input
              :value="vista.captura?.columna || ''"
              @input="updateCaptura({ columna: ($event.target as HTMLInputElement).value })"
              type="text"
              placeholder="Ej. R"
              class="w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              :class="vista.captura?.columna ? 'border-gray-200' : 'border-amber-300'"
            />
          </div>
          <div>
            <label class="block text-[10px] font-medium text-muted mb-1">Fila</label>
            <input
              :value="vista.captura?.fila ?? ''"
              @input="updateCaptura({ fila: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : 0 })"
              type="number"
              placeholder="Ej. 9"
              min="1"
              class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              :class="vista.captura?.fila ? 'border-gray-200' : 'border-amber-300'"
            />
          </div>
          <div>
            <label class="block text-[10px] font-medium text-muted mb-1">Abarca columnas</label>
            <input
              :value="vista.captura?.abarcaColumnas ?? ''"
              @input="updateCaptura({ abarcaColumnas: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined })"
              type="number"
              placeholder="1"
              min="1"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
          </div>
          <div>
            <label class="block text-[10px] font-medium text-muted mb-1">Abarca filas</label>
            <input
              :value="vista.captura?.abarcaFilas ?? ''"
              @input="updateCaptura({ abarcaFilas: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined })"
              type="number"
              placeholder="1"
              min="1"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
          </div>
        </div>
      </div>

      <div v-if="isTable" class="pt-3 border-t border-gray-100">
        <TableColumnsEditor
          :config="vista.configTabla || defaultTableConfig"
          @update="(configTabla) => update({ configTabla })"
        />
      </div>

      <div v-if="vista.tipo === 'mapa_coordenadas'" class="pt-3 border-t border-gray-100 space-y-2">
        <label class="block text-xs font-medium text-heading">Ubicación por defecto</label>
        <CampoCoordenadasInput :value="vista.valorEjemplo || ''" @change="update({ valorEjemplo: $event })" />
        <div v-if="coords" class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] font-medium text-muted mb-1">Latitud</label>
            <input
              :value="coords?.lat ?? ''"
              @input="updateCoords(Number(($event.target as HTMLInputElement).value), coords?.lng ?? 0)"
              type="number"
              step="0.000001"
              class="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
          </div>
          <div>
            <label class="block text-[10px] font-medium text-muted mb-1">Longitud</label>
            <input
              :value="coords?.lng ?? ''"
              @input="updateCoords(coords?.lat ?? 0, Number(($event.target as HTMLInputElement).value))"
              type="number"
              step="0.000001"
              class="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
          </div>
        </div>
      </div>

      <div class="bg-brand-50 rounded-xl p-4 flex items-start gap-3">
        <div class="w-8 h-8 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
          <FontAwesomeIcon :icon="faLeaf" class="w-4 h-4" />
        </div>
        <div>
          <div class="font-semibold text-heading text-sm">{{ ejemplosCount }} ejemplos asociados</div>
          <div class="text-xs text-muted">Valores de referencia para la IA</div>
        </div>
      </div>
    </div>
  </div>
</template>
