<script setup lang="ts">
import { inject } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faTrash, faGear, fieldTypeIcons } from '@/lib/icons';
import CampoListaInput from '@/components/CampoListaInput.vue';
import CeldaPartida from './CeldaPartida.vue';
import { EXCEL_VIVO } from '@/composables/useListasExcel';
import { etiquetaDeValor } from '@/lib/conversionesExcel';
import type { ColumnaTabla } from '@/types';
import { esCeldaPartida, valorPlano, type FilaDinamica } from '@/lib/tableRowHelpers';

// Fila compartida entre DynamicEditor (sin agrupador) y GroupedRowsEditor (con agrupador).
// La columna dinámica se expande en una celda por período, alineada con TableHeaderRow.
// Una columna con `subcolumnas` (convención 4.8) se expande, en las filas marcadas como partidas,
// en una celda por parte; en las demás filas ocupa todo el ancho como celda única.
const props = defineProps<{
  cols: ColumnaTabla[];
  row: FilaDinamica;
  rowIndex: number;
  periodos: string[];
  columnaDinamicaId?: string;
  /** Hoja de Excel de la sección — con `filaExcel` localiza cada celda en el archivo */
  hoja?: string;
  /** Fila de Excel que ocupa ESTA fila de la tabla (fila inicial de la captura + índice) */
  filaExcel?: number;
}>();

const emit = defineEmits<{
  'cell-change': [colId: string, value: string];
  'periodo-change': [colId: string, periodoIdx: number, value: string];
  'subcelda-change': [colId: string, subId: string, value: string];
  'toggle-partida': [colId: string];
  delete: [];
}>();

function periodoValues(colId: string): string[] {
  return Array.isArray(props.row[colId]) ? (props.row[colId] as string[]) : [];
}

function partida(col: ColumnaTabla): boolean {
  return !!col.subcolumnas?.length && esCeldaPartida(props.row[col.id]);
}

function textoPlano(colId: string): string {
  return valorPlano(props.row[colId]);
}

// --- Ayudas leídas del Excel, celda a celda ---
// En Territorio, por ejemplo, la columna Ubigeo es un desplegable y Departamento/Provincia/Distrito
// son VLOOKUP sobre ella: al elegir el ubigeo de una fila, las otras tres celdas de ESA fila se
// llenan solas. Todo sale del archivo; nada de esto vive en la estructura JSON.
const excel = inject(EXCEL_VIVO, undefined);

function refDe(col: ColumnaTabla): string | null {
  if (!excel?.value || !props.hoja || !props.filaExcel || !col.columnaExcel) return null;
  return `${col.columnaExcel}${props.filaExcel}`;
}

/** Opciones del desplegable de esa celda, o null si no tiene */
function opcionesExcel(col: ColumnaTabla): string[] | null {
  const ref = refDe(col);
  if (!ref || !props.hoja) return null;
  const ops = excel?.value?.opcionesDe(props.hoja, ref);
  return ops && ops.length > 0 ? ops : null;
}

/** Lo que el Excel calcula en esa celda, o null si no es una celda con fórmula */
function calculoExcel(col: ColumnaTabla): { texto: string; soportado: boolean; error?: string } | null {
  const ref = refDe(col);
  if (!ref || !props.hoja) return null;
  return excel?.value?.calculado(props.hoja, ref) ?? null;
}

// El valor guardado es la palabra del Excel; lo elegido se guarda tal cual. La traducción solo
// entra para los ejemplos anteriores, que guardaron 'true'/'false' (ver etiquetaDeValor).
function valorMostrado(col: ColumnaTabla, opciones: string[] | null): string {
  return etiquetaDeValor((props.row[col.id] as string) || '', opciones, col.etiquetasBooleano);
}
</script>

<template>
  <tr class="border-b border-brand-50 last:border-0 group">
    <template v-for="col in cols" :key="col.id">
      <td v-if="col.tipo === 'auto_numerico'" class="px-1 py-0.5">
        <span class="text-muted px-1">{{ rowIndex + 1 }}</span>
      </td>
      <template v-else-if="col.id === columnaDinamicaId && periodos.length > 0">
        <td v-for="(p, pi) in periodos" :key="`${col.id}-${pi}`" class="px-1 py-0.5 bg-amber-50/30">
          <input
            :value="periodoValues(col.id)[pi] || ''"
            @input="emit('periodo-change', col.id, pi, ($event.target as HTMLInputElement).value)"
            @click.stop
            type="text"
            :title="p"
            placeholder="—"
            class="w-16 px-1 py-1 rounded border border-transparent hover:border-amber-200 focus:border-amber-400 text-xs text-heading focus:outline-none focus:ring-1 focus:ring-amber-500/30 bg-transparent"
          />
        </td>
      </template>
      <!-- Columna partida (4.8): una celda por parte en esta fila -->
      <CeldaPartida
        v-else-if="partida(col)"
        :col="col"
        :valor="row[col.id]"
        :hoja="hoja"
        :fila-excel="filaExcel"
        @subcelda-change="(subId, val) => emit('subcelda-change', col.id, subId, val)"
        @toggle-partida="emit('toggle-partida', col.id)"
      />
      <!-- Columna con subcolumnas pero fusionada en esta fila: una sola celda a todo el ancho -->
      <td
        v-else-if="col.subcolumnas && col.subcolumnas.length > 0"
        :colspan="col.subcolumnas.length"
        class="px-1 py-0.5 align-top group/celda"
      >
        <div class="flex items-start gap-0.5">
          <textarea
            :value="textoPlano(col.id)"
            @input="emit('cell-change', col.id, ($event.target as HTMLTextAreaElement).value)"
            @click.stop
            rows="1"
            placeholder="—"
            class="block w-full px-1.5 py-1 rounded border border-transparent hover:border-gray-200 focus:border-brand-300 text-xs text-heading focus:outline-none focus:ring-1 focus:ring-brand-500/30 bg-transparent resize-none overflow-y-auto max-h-[15lh] [field-sizing:content]"
          />
          <button
            @click.stop="emit('toggle-partida', col.id)"
            type="button"
            title="Partir en subcolumnas"
            class="w-5 h-5 rounded flex items-center justify-center text-gray-300 opacity-0 group-hover/celda:opacity-100 hover:text-brand-600 transition-opacity shrink-0 mt-0.5"
          >
            <FontAwesomeIcon :icon="faGear" class="w-2.5 h-2.5" />
          </button>
        </div>
      </td>
      <!-- Celda que el Excel calcula solo (VLOOKUP sobre otra columna de la misma fila) -->
      <td v-else-if="calculoExcel(col)" class="px-1 py-0.5 align-top bg-sky-50/50">
        <div class="flex items-start gap-1 px-1 py-1">
          <FontAwesomeIcon
            :icon="fieldTypeIcons.calculado"
            class="w-2.5 h-2.5 text-sky-500 shrink-0 mt-0.5"
            title="Lo calcula el Excel"
          />
          <span v-if="!calculoExcel(col)!.soportado" class="text-[11px] text-sky-800/60 italic">Lo calcula el Excel</span>
          <span v-else-if="calculoExcel(col)!.error" class="text-[11px] text-amber-700 font-mono">{{ calculoExcel(col)!.error }}</span>
          <span v-else-if="calculoExcel(col)!.texto" class="text-xs text-heading break-words">{{ calculoExcel(col)!.texto }}</span>
          <span v-else class="text-[11px] text-muted">—</span>
        </div>
      </td>
      <!-- Columna booleana (4.10): en el Excel oficial es una casilla de verificación (checkbox de
           formulario) enlazada a una celda TRUE/FALSE — se dibuja como tal en vez de como texto. -->
      <td v-else-if="col.tipo === 'booleano'" class="px-1 py-0.5 align-top">
        <input
          :checked="row[col.id] === 'true'"
          @change="emit('cell-change', col.id, ($event.target as HTMLInputElement).checked ? 'true' : 'false')"
          @click.stop
          type="checkbox"
          class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 mt-0.5"
        />
      </td>
      <!-- Celda con desplegable declarado en el Excel -->
      <td v-else-if="opcionesExcel(col)" class="px-1 py-0.5 align-top">
        <CampoListaInput
          :value="valorMostrado(col, opcionesExcel(col))"
          :opciones="opcionesExcel(col) ?? []"
          compacto
          @change="emit('cell-change', col.id, $event)"
        />
      </td>
      <td v-else-if="col.opciones && col.opciones.length > 0" class="px-1 py-0.5 align-top">
        <select
          :value="(row[col.id] as string) || ''"
          @change="emit('cell-change', col.id, ($event.target as HTMLSelectElement).value)"
          @click.stop
          class="block w-full px-1.5 py-1 rounded border border-transparent hover:border-gray-200 focus:border-brand-300 text-xs text-heading focus:outline-none focus:ring-1 focus:ring-brand-500/30 bg-transparent"
        >
          <option value="">—</option>
          <option v-for="opt in col.opciones" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </td>
      <td v-else class="px-1 py-0.5 align-top">
        <!-- textarea con field-sizing: crece con el contenido hasta 15 líneas y luego scrollea -->
        <textarea
          :value="(row[col.id] as string) || ''"
          @input="emit('cell-change', col.id, ($event.target as HTMLTextAreaElement).value)"
          @click.stop
          rows="1"
          placeholder="—"
          class="block w-full px-1.5 py-1 rounded border border-transparent hover:border-gray-200 focus:border-brand-300 text-xs text-heading focus:outline-none focus:ring-1 focus:ring-brand-500/30 bg-transparent resize-none overflow-y-auto max-h-[15lh] [field-sizing:content]"
        />
      </td>
    </template>
    <td class="px-1 py-0.5">
      <button @click.stop="emit('delete')" type="button" class="w-5 h-5 rounded flex items-center justify-center text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity">
        <FontAwesomeIcon :icon="faTrash" class="w-2.5 h-2.5" />
      </button>
    </td>
  </tr>
</template>
