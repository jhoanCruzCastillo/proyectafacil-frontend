<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faPlus } from '@/lib/icons';
import TableHeaderRow from './TableHeaderRow.vue';
import TableRow from './TableRow.vue';
import { useVirtualRowWindow } from '@/composables/useVirtualRowWindow';
import { parseDynamicRows, newEmptyRow, getPeriodos, esCeldaPartida, valorPlano, alturaFilaBase, type FilaDinamica } from '@/lib/tableRowHelpers';
import type { ConfigTabla } from '@/types';

/** Espera antes de subir el JSON al padre (evita stringify + rebuild Excel-vivo en cada tecla). */
const PERSIST_DEBOUNCE_MS = 250;

const props = defineProps<{
  config: ConfigTabla;
  modelValue: string;
  /** true = permite agregar/renombrar columnas dinámicas (solo tab Estructura) */
  puedeEditarPeriodos?: boolean;
  /** Hoja de Excel de la sección — habilita los desplegables y el cálculo en vivo por celda */
  hoja?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [string]; 'update:config': [ConfigTabla] }>();

const rows = ref<FilaDinamica[]>(parseDynamicRows(props.modelValue, props.config));
/** Último JSON que emitimos o que aceptamos del padre — evita pisar ediciones locales con el eco. */
let lastSyncedJson = props.modelValue || JSON.stringify(rows.value);
let persistTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.modelValue,
  (v) => {
    if (v === lastSyncedJson) return;
    // Cambio externo (volcado, otro campo, reload): cancela el debounce y toma el valor nuevo.
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    lastSyncedJson = v;
    rows.value = parseDynamicRows(v, props.config);
  },
);

const rowCount = computed(() => rows.value.length);
const virtual = useVirtualRowWindow(rowCount);
const {
  activo: virtualActivo,
  ventana,
  padTopPx,
  padBottomPx,
  onScroll,
  scrollToIndex,
  viewportMaxPx,
} = virtual;

function bindScrollEl(el: Element | null) {
  virtual.scrollEl.value = el instanceof HTMLElement ? el : null;
}

const periodos = computed(() => getPeriodos(props.config));

/** Anchos arrastrados en esta sesión; pisan `col.ancho` del config (y sirven si el padre no persiste config). */
const anchosLocales = ref<Record<string, number>>({});
const columnasVista = computed(() =>
  props.config.columnas.map((c) => ({
    ...c,
    ancho: anchosLocales.value[c.id] ?? c.ancho,
  })),
);

/** Celdas físicas por fila (misma lógica que TableHeaderRow) + columna de borrar. */
const colspanSpacer = computed(() => {
  const n = columnasVista.value.reduce((s, c) => {
    if (c.id === props.config.columnaDinamicaId) return s + Math.max(periodos.value.length, 1);
    return s + (c.subcolumnas?.length || 1);
  }, 0);
  return n + 1;
});

function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const json = JSON.stringify(rows.value);
  if (json === lastSyncedJson) return;
  lastSyncedJson = json;
  emit('update:modelValue', json);
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushPersist();
  }, PERSIST_DEBOUNCE_MS);
}

/** Actualiza filas en memoria. `immediate` = stringify ya (alta/baja de filas, partir celda). */
function setRows(next: FilaDinamica[], immediate = false) {
  rows.value = next;
  if (immediate) flushPersist();
  else schedulePersist();
}

function replaceRow(ri: number, row: FilaDinamica, immediate = false) {
  const next = rows.value.slice();
  next[ri] = row;
  setRows(next, immediate);
}

function updateCell(ri: number, colId: string, val: string) {
  const row = rows.value[ri];
  if (!row || row[colId] === val) return;
  replaceRow(ri, { ...row, [colId]: val });
}
function updatePeriodo(ri: number, colId: string, pi: number, val: string) {
  const row = rows.value[ri];
  if (!row) return;
  const arr = Array.isArray(row[colId]) ? [...(row[colId] as string[])] : [];
  if (arr[pi] === val) return;
  arr[pi] = val;
  replaceRow(ri, { ...row, [colId]: arr });
}
async function addRow() {
  flushPersist();
  const next = [...rows.value, newEmptyRow(props.config)];
  setRows(next, true);
  await scrollToIndex(next.length - 1);
}
function removeRow(ri: number) {
  if (rows.value.length <= 1) return;
  setRows(rows.value.filter((_, i) => i !== ri), true);
}

// --- Celdas partidas (4.8) ---
function updateSubcelda(ri: number, colId: string, subId: string, val: string) {
  const row = rows.value[ri];
  if (!row) return;
  const actual = esCeldaPartida(row[colId]) ? (row[colId] as Record<string, string>) : {};
  if (actual[subId] === val) return;
  replaceRow(ri, { ...row, [colId]: { ...actual, [subId]: val } });
}

// Alterna entre celda partida y fusionada en ESA fila. Al partir, lo que hubiera escrito pasa a la
// primera parte; al fusionar, se concatena lo de todas las partes — en ningún sentido se pierde texto.
function togglePartida(ri: number, colId: string) {
  const col = props.config.columnas.find((c) => c.id === colId);
  if (!col?.subcolumnas?.length) return;
  const row = rows.value[ri];
  if (!row) return;
  let nextRow: FilaDinamica;
  if (esCeldaPartida(row[colId])) {
    nextRow = { ...row, [colId]: valorPlano(row[colId]) };
  } else {
    const texto = valorPlano(row[colId]);
    const partes: Record<string, string> = {};
    col.subcolumnas.forEach((s, si) => { partes[s.id] = si === 0 ? texto : ''; });
    nextRow = { ...row, [colId]: partes };
  }
  replaceRow(ri, nextRow, true);
}

function addPeriodo() {
  flushPersist();
  emit('update:config', { ...props.config, periodos: [...(props.config.periodos ?? []), ''] });
}
function renamePeriodo(pi: number, value: string) {
  const periodosNext = [...(props.config.periodos ?? [])];
  periodosNext[pi] = value;
  emit('update:config', { ...props.config, periodos: periodosNext });
}

function resizeColumna(colId: string, anchoPx: number) {
  // Solo UI en sesión: no escribe en config/plantilla (evita autoguardado masivo al arrastrar).
  anchosLocales.value = { ...anchosLocales.value, [colId]: anchoPx };
}

onBeforeUnmount(() => {
  flushPersist();
});
</script>

<template>
  <div class="mt-2">
    <div
      :ref="(el) => bindScrollEl(el as Element | null)"
      class="rounded-lg border border-brand-200 overflow-auto"
      :class="virtualActivo ? '' : 'overflow-x-auto'"
      :style="virtualActivo ? { maxHeight: `${viewportMaxPx}px` } : undefined"
      @scroll="onScroll"
    >
      <table
        class="w-full text-xs border-separate border-spacing-0"
        :class="columnasVista.some((c) => c.ancho) ? 'table-fixed' : ''"
      >
        <thead class="sticky top-0 z-10">
          <TableHeaderRow
            :cols="columnasVista"
            :periodos="periodos"
            :columna-dinamica-id="config.columnaDinamicaId"
            :cabeceras="config.cabeceras"
            :editable-periodos="puedeEditarPeriodos"
            :show-add-periodo="puedeEditarPeriodos"
            @rename-periodo="renamePeriodo"
            @add-periodo="addPeriodo"
            @resize-columna="resizeColumna"
          />
        </thead>
        <tbody>
          <tr v-if="padTopPx > 0" aria-hidden="true">
            <td
              :colspan="colspanSpacer"
              :style="{ height: `${padTopPx}px`, padding: 0, border: 'none', lineHeight: 0 }"
            />
          </tr>
          <TableRow
            v-for="item in ventana"
            :key="item.ri"
            :cols="columnasVista"
            :row="rows[item.ri]"
            :row-index="item.ri"
            :periodos="periodos"
            :columna-dinamica-id="config.columnaDinamicaId"
            :hoja="hoja"
            :fila-excel="config.captura?.filaInicial ? config.captura.filaInicial + item.ri * alturaFilaBase(config) : undefined"
            @cell-change="(colId, val) => updateCell(item.ri, colId, val)"
            @periodo-change="(colId, pi, val) => updatePeriodo(item.ri, colId, pi, val)"
            @subcelda-change="(colId, subId, val) => updateSubcelda(item.ri, colId, subId, val)"
            @toggle-partida="(colId) => togglePartida(item.ri, colId)"
            @delete="removeRow(item.ri)"
          />
          <tr v-if="padBottomPx > 0" aria-hidden="true">
            <td
              :colspan="colspanSpacer"
              :style="{ height: `${padBottomPx}px`, padding: 0, border: 'none', lineHeight: 0 }"
            />
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mt-1 flex items-center justify-between gap-2">
      <button
        @click.stop="addRow"
        type="button"
        class="flex-1 py-1.5 rounded-lg border border-dashed border-brand-200 text-[11px] font-medium text-brand-600 hover:bg-brand-50 transition-colors flex items-center justify-center gap-1"
      >
        <FontAwesomeIcon :icon="faPlus" class="w-2.5 h-2.5" /> Agregar fila
      </button>
      <span v-if="virtualActivo" class="text-[10px] text-muted shrink-0 tabular-nums">
        {{ rows.length }} filas · vista virtual
      </span>
    </div>
  </div>
</template>
