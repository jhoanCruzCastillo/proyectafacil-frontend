<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { subtipoTablaLabels, faTriangleExclamation, faGear } from '@/lib/icons';
import { columnaFaltaCaptura } from '@/lib/campoValidation';
import FilasDinamicasColumnsEditor from './FilasDinamicasColumnsEditor.vue';
import MatrizPeriodosEditor from './MatrizPeriodosEditor.vue';
import JerarquicaColumnsEditor from './JerarquicaColumnsEditor.vue';
import AgrupadorConfigModal from './AgrupadorConfigModal.vue';
import CampoConAyuda from '@/components/CampoConAyuda.vue';
import { esJerarquica, agrupadorProfundidad } from '@/lib/tableRowHelpers';
import type { ConfigTabla, SubtipoTabla } from '@/types';

const props = defineProps<{ config: ConfigTabla }>();
const emit = defineEmits<{ update: [ConfigTabla] }>();

const subtipos = Object.entries(subtipoTablaLabels) as [SubtipoTabla, string][];
const showAgrupadorConfig = ref(false);
const columnasSinPosicion = computed(() => props.config.columnas.filter(columnaFaltaCaptura).length);

// Proxy pasado como v-model:config a los 3 editores de columnas — cada uno solo necesita leer y
// reasignar `config.value`, sin tener que reenviar el evento `update` manualmente.
const config = computed({
  get: () => props.config,
  set: (v: ConfigTabla) => emit('update', v),
});

function updateCaptura(patch: Partial<NonNullable<ConfigTabla['captura']>>) {
  emit('update', { ...props.config, captura: { ...props.config.captura, ...patch } });
}

// En una tabla plana el título de grupo arranca en la primera columna, así que puede abarcar las
// N cabeceras de la tabla. En una jerárquica arranca en la columna del agrupador, y solo quedan a
// su derecha las que van de ahí al final — ese es el máximo configurable.
const columnaInicioGrupo = computed(() =>
  esJerarquica(props.config.subtipo) ? agrupadorProfundidad(props.config.columnas, props.config) : 0,
);
// El modal elige por cabecera pero guarda columnas de Excel, así que necesita el ancho real de cada
// una (la dinámica se expande por período, igual que en repartoAgrupador).
const cabecerasAgrupador = computed(() =>
  props.config.columnas.slice(columnaInicioGrupo.value).map((c) => ({
    nombre: c.nombre,
    ancho: c.id === props.config.columnaDinamicaId && (props.config.periodos?.length ?? 0) > 0
      ? (props.config.periodos!.length) * (c.abarcaColumnasExcel ?? 1)
      : c.abarcaColumnasExcel ?? 1,
    columna: c.columnaExcel,
  })),
);
const anchoTotalAgrupador = computed(() => cabecerasAgrupador.value.reduce((s, c) => s + c.ancho, 0));
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-xs font-medium text-heading mb-1.5">Subtipo de tabla</label>
      <select
        :value="config.subtipo"
        @change="emit('update', { ...config, subtipo: ($event.target as HTMLSelectElement).value as SubtipoTabla })"
        class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-white"
      >
        <option v-for="[key, label] in subtipos" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <div class="grid grid-cols-4 gap-3">
      <CampoConAyuda
        etiqueta="Columna inicial"
        ayuda="Letra de la columna del Excel donde arranca la tabla. Es solo una referencia: cada columna puede indicar la suya propia con el engranaje."
      >
        <input
          :value="config.captura?.columnaInicial ?? ''"
          @input="updateCaptura({ columnaInicial: ($event.target as HTMLInputElement).value })"
          type="text"
          placeholder="Ej. B"
          class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </CampoConAyuda>
      <CampoConAyuda
        etiqueta="Fila inicial (Excel)"
        ayuda="Número de la fila del Excel donde está el PRIMER dato de la tabla, no la fila de los títulos. Si te equivocas, los datos se leen y se escriben corridos."
      >
        <input
          :value="config.captura?.filaInicial ?? ''"
          @input="updateCaptura({ filaInicial: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined })"
          type="number"
          placeholder="Ej. 18"
          min="1"
          class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          :class="config.captura?.filaInicial ? 'border-gray-200' : 'border-amber-300'"
        />
      </CampoConAyuda>
      <CampoConAyuda
        etiqueta="Filas base"
        ayuda="Cuántas filas del Excel ocupa la tabla tal como viene en la plantilla. Si va de la fila 94 a la 104, son 11. Es lo que se lee al volcar datos."
      >
        <input
          :value="config.captura?.filasBase ?? ''"
          @input="updateCaptura({ filasBase: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined })"
          type="number"
          placeholder="Ej. 3"
          min="0"
          class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </CampoConAyuda>
      <CampoConAyuda
        etiqueta="Abarca filas"
        ayuda="Cuántas filas del Excel ocupa cada fila base de la tabla (una fila de valor, o un nodo hoja en jerárquicas). 1 si no están fusionadas — es el valor por defecto."
      >
        <input
          :value="config.abarcaFilas ?? 1"
          @input="emit('update', { ...config, abarcaFilas: Number(($event.target as HTMLInputElement).value) || 1 })"
          type="number"
          placeholder="1"
          min="1"
          class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </CampoConAyuda>
    </div>

    <div class="flex items-center justify-between">
      <label class="text-xs font-medium text-heading">Agrupar filas bajo encabezados</label>
      <div class="flex items-center gap-2">
        <button
          v-if="config.agrupador"
          @click="showAgrupadorConfig = true"
          type="button"
          title="Configurar fila de título de grupo"
          class="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-brand-600 hover:bg-gray-50 transition-colors"
        >
          <FontAwesomeIcon :icon="faGear" class="w-3 h-3" />
        </button>
        <button
          @click="emit('update', { ...config, agrupador: !config.agrupador })"
          type="button"
          class="relative w-10 h-6 rounded-full transition-colors duration-100"
          :class="config.agrupador ? 'bg-brand-500' : 'bg-gray-300'"
        >
          <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-100" :class="config.agrupador ? 'left-4.5' : 'left-0.5'" />
        </button>
      </div>
    </div>

    <MatrizPeriodosEditor v-if="config.subtipo === 'matriz_por_periodos'" v-model:config="config" />
    <JerarquicaColumnsEditor v-else-if="esJerarquica(config.subtipo)" v-model:config="config" />
    <FilasDinamicasColumnsEditor v-else v-model:config="config" />

    <p v-if="columnasSinPosicion > 0" class="flex items-center gap-1.5 text-[11px] text-amber-600 font-medium">
      <FontAwesomeIcon :icon="faTriangleExclamation" class="w-2.5 h-2.5 shrink-0" />
      {{ columnasSinPosicion }} columna{{ columnasSinPosicion === 1 ? '' : 's' }} sin posición en Excel — configúra{{ columnasSinPosicion === 1 ? 'la' : 'las' }} desde el engranaje de cada columna.
    </p>

    <AgrupadorConfigModal
      :is-open="showAgrupadorConfig"
      :abarca-columnas="Math.min(config.agrupadorAbarcaColumnas ?? anchoTotalAgrupador, anchoTotalAgrupador)"
      :cabeceras="cabecerasAgrupador"
      :desde-columna="esJerarquica(config.subtipo) ? config.columnas[columnaInicioGrupo]?.nombre : undefined"
      @close="showAgrupadorConfig = false"
      @change="(v) => emit('update', { ...config, agrupadorAbarcaColumnas: v })"
    />
  </div>
</template>
