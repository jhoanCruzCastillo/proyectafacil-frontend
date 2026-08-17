<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faPlus, faTrash, fieldTypeIcons } from '@/lib/icons';
import TableHeaderRow from './TableHeaderRow.vue';
import TableRow from './TableRow.vue';
import CampoListaInput from '@/components/CampoListaInput.vue';
import { EXCEL_VIVO } from '@/composables/useListasExcel';
import { etiquetaDeValor } from '@/lib/conversionesExcel';
import { parseGroupedRows, newEmptyRow, getPeriodos, esCeldaPartida, valorPlano, posicionesGrupos, grupoOcupaFila, repartoAgrupador, alturaFilaBase, idsHermanasCasillaBooleano, type GrupoFilas } from '@/lib/tableRowHelpers';
import type { ConfigTabla, ColumnaTabla } from '@/types';

// Filas planas agrupadas bajo un encabezado de grupo (config.agrupador === true). Una sola tabla:
// el encabezado de columnas una vez arriba, y cada grupo como una fila de título fusionada (abarca
// config.agrupadorAbarcaColumnas columnas, contando desde la primera) seguida de sus filas de datos.
const props = defineProps<{
  config: ConfigTabla;
  modelValue: string;
  /** true = permite agregar/renombrar columnas dinámicas (solo tab Estructura) */
  puedeEditarPeriodos?: boolean;
  /** Hoja de Excel de la sección — habilita desplegables y cálculo en vivo por celda */
  hoja?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [string]; 'update:config': [ConfigTabla] }>();

const grupos = ref<GrupoFilas[]>(parseGroupedRows(props.modelValue, props.config));
watch(() => props.modelValue, (v) => { grupos.value = parseGroupedRows(v, props.config); });

function persist(next: GrupoFilas[]) {
  grupos.value = next;
  emit('update:modelValue', JSON.stringify(next));
}

function updateGrupoNombre(gi: number, nombre: string) {
  persist(grupos.value.map((g, i) => (i === gi ? { ...g, grupo: nombre } : g)));
}
function updateValorGrupo(gi: number, colId: string, val: string) {
  persist(grupos.value.map((g, i) => (i !== gi ? g : { ...g, valoresGrupo: { ...(g.valoresGrupo ?? {}), [colId]: val } })));
}
function updateValorGrupoPeriodo(gi: number, colId: string, pi: number, val: string) {
  persist(grupos.value.map((g, i) => {
    if (i !== gi) return g;
    const actual = g.valoresGrupo?.[colId];
    const arr = Array.isArray(actual) ? [...actual] : [];
    arr[pi] = val;
    return { ...g, valoresGrupo: { ...(g.valoresGrupo ?? {}), [colId]: arr } };
  }));
}
function updateCell(gi: number, ri: number, colId: string, val: string) {
  persist(grupos.value.map((g, i) => {
    if (i !== gi) return g;
    return {
      ...g,
      filas: g.filas.map((r, j) => {
        if (j !== ri) return r;
        if (val.trim() !== '') {
          const hermanas = idsHermanasCasillaBooleano(colId, props.config.columnas, props.config.cabeceras);
          if (hermanas.length > 0) {
            const next = { ...r, [colId]: val };
            for (const id of hermanas) next[id] = '';
            return next;
          }
        }
        return { ...r, [colId]: val };
      }),
    };
  }));
}

// --- Celdas partidas (4.8) — misma lógica que DynamicEditor, aplicada dentro del grupo ---
function updateSubcelda(gi: number, ri: number, colId: string, subId: string, val: string) {
  persist(grupos.value.map((g, i) => (i !== gi ? g : {
    ...g,
    filas: g.filas.map((r, j) => {
      if (j !== ri) return r;
      const actual = esCeldaPartida(r[colId]) ? (r[colId] as Record<string, string>) : {};
      return { ...r, [colId]: { ...actual, [subId]: val } };
    }),
  })));
}

function togglePartida(gi: number, ri: number, colId: string) {
  const col = props.config.columnas.find((c) => c.id === colId);
  if (!col?.subcolumnas?.length) return;
  persist(grupos.value.map((g, i) => (i !== gi ? g : {
    ...g,
    filas: g.filas.map((r, j) => {
      if (j !== ri) return r;
      if (esCeldaPartida(r[colId])) return { ...r, [colId]: valorPlano(r[colId]) };
      const texto = valorPlano(r[colId]);
      const partes: Record<string, string> = {};
      col.subcolumnas!.forEach((s, si) => { partes[s.id] = si === 0 ? texto : ''; });
      return { ...r, [colId]: partes };
    }),
  })));
}
function updatePeriodo(gi: number, ri: number, colId: string, pi: number, val: string) {
  persist(grupos.value.map((g, i) => {
    if (i !== gi) return g;
    return {
      ...g,
      filas: g.filas.map((r, j) => {
        if (j !== ri) return r;
        const arr = Array.isArray(r[colId]) ? [...(r[colId] as string[])] : [];
        arr[pi] = val;
        return { ...r, [colId]: arr };
      }),
    };
  }));
}
function addRow(gi: number) { persist(grupos.value.map((g, i) => (i === gi ? { ...g, filas: [...g.filas, newEmptyRow(props.config)] } : g))); }
// Un grupo puede quedarse en cero filas: su fila de título ya es una fila del Excel y a menudo los
// datos van ahí mismo. Borrar la última fila NO borra el grupo — el grupo se elimina solo con la
// papelera de su fila de título, y su botón "Agregar fila" sigue disponible para recuperarla.
function removeRow(gi: number, ri: number) {
  persist(grupos.value.map((g, i) => (i !== gi ? g : { ...g, filas: g.filas.filter((_, j) => j !== ri) })));
}
// Un grupo nuevo nace SIN filas hijas: su propia fila de título ya es una fila del Excel y suele
// llevar los datos ahí mismo (ej. "Tasa de crecimiento…", que ocupa una única fila que abarca el
// ancho y tiene sus valores a la derecha). Crearlo con una fila de cortesía obligaba a borrarla y,
// si no te dabas cuenta, la tabla ocupaba una fila de más y empujaba todo lo de abajo.
function addGrupo() { persist([...grupos.value, { grupo: `Grupo ${grupos.value.length + 1}`, filas: [] }]); }
function removeGrupo(gi: number) { if (grupos.value.length > 1) persist(grupos.value.filter((_, i) => i !== gi)); }

function addPeriodo() {
  emit('update:config', { ...props.config, periodos: [...(props.config.periodos ?? []), ''] });
}
function renamePeriodo(pi: number, value: string) {
  const periodos = [...(props.config.periodos ?? [])];
  periodos[pi] = value;
  emit('update:config', { ...props.config, periodos });
}
function resizeColumna(colId: string, anchoPx: number) {
  // Solo UI en sesión: no escribe en config/plantilla (evita autoguardado masivo al arrastrar).
  anchosLocales.value = { ...anchosLocales.value, [colId]: anchoPx };
}

const periodos = computed(() => getPeriodos(props.config));
const anchosLocales = ref<Record<string, number>>({});
const columnasVista = computed(() =>
  props.config.columnas.map((c) => ({
    ...c,
    ancho: anchosLocales.value[c.id] ?? c.ancho,
  })),
);
// Total de columnas realmente renderizadas en el encabezado (la dinámica se expande por período),
// para calcular cuántas quedan sueltas a la derecha de la fila de grupo.
const totalCols = computed(() => props.config.columnas.reduce((sum, c) => sum + (c.id === props.config.columnaDinamicaId && periodos.value.length > 0 ? periodos.value.length : 1), 0));
// El reparto de la fila de título lo decide `repartoAgrupador`, en columnas REALES de Excel. Aquí
// se traduce a colspans de la tabla HTML, donde cada cabecera es una celda (la dinámica, una por
// período). Un corte que parta una cabecera se dibuja como la celda del título + la del sobrante.
const reparto = computed(() => repartoAgrupador(props.config, periodos.value));
const anchoHtml = (col: ColumnaTabla) =>
  col.id === props.config.columnaDinamicaId && periodos.value.length > 0 ? periodos.value.length : 1;

/** Cabeceras que el título cubre por completo */
const cabecerasCubiertas = computed(() =>
  Math.max(reparto.value.primeraCabeceraLibre - (reparto.value.anchoResto > 0 ? 1 : 0), 0),
);
const abarca = computed(() =>
  Math.max(props.config.columnas.slice(0, cabecerasCubiertas.value).reduce((s, c) => s + anchoHtml(c), 0), 1),
);
// Solo se dibuja el sobrante si hay al menos una cabecera entera antes: si el corte cae dentro de la
// PRIMERA, la rejilla HTML no puede partir esa columna y el título ocupa la cabecera completa.
const hayResto = computed(() => reparto.value.anchoResto > 0 && cabecerasCubiertas.value >= 1);
const colspanResto = computed(() => {
  const col = props.config.columnas[cabecerasCubiertas.value];
  return col ? anchoHtml(col) : 1;
});

// Columnas que quedan libres a la derecha — ahí la fila de título se renderiza como una fila de
// datos más, para grupos "resumen" sin filas hijas propias (ej. "Nivel de cobertura...": título
// fusionado + un valor por año).
const restColumnas = computed(() => props.config.columnas.slice(reparto.value.primeraCabeceraLibre));

// --- Ayudas del Excel, celda a celda ---
// La fila de cada parte sale de `posicionesGrupos`, la misma aritmética que usa el escritor: así la
// celda que se le consulta al Excel y la celda donde acabará el dato son la misma por construcción.
const excel = inject(EXCEL_VIVO, undefined);

const posiciones = computed(() => {
  const filaInicial = props.config.captura?.filaInicial;
  if (!props.hoja || !filaInicial) return null;
  return posicionesGrupos(grupos.value, filaInicial, (fila) => {
    const primera = props.config.columnas.find((c) => c.columnaExcel)?.columnaExcel;
    return alturaFilaBase(props.config, excel?.value?.altoDeBloque(props.hoja!, primera, fila));
  });
});

/** Fila de Excel de una fila de datos, o undefined si no se puede resolver. */
function filaExcelDe(gi: number, ri: number): number | undefined {
  return posiciones.value?.[gi]?.filas[ri];
}

/** Celda de la fila de título del grupo en una de sus columnas libres. */
function refGrupo(gi: number, col: ColumnaTabla): string | null {
  const fila = posiciones.value?.[gi]?.filaTitulo;
  if (!fila || !col.columnaExcel || !props.hoja) return null;
  return `${col.columnaExcel}${fila}`;
}

function calculoGrupo(gi: number, col: ColumnaTabla) {
  const ref = refGrupo(gi, col);
  return ref && props.hoja ? (excel?.value?.calculado(props.hoja, ref) ?? null) : null;
}

function opcionesGrupo(gi: number, col: ColumnaTabla): string[] | null {
  const ref = refGrupo(gi, col);
  if (!ref || !props.hoja) return null;
  const ops = excel?.value?.opcionesDe(props.hoja, ref);
  return ops && ops.length > 0 ? ops : null;
}

function valorGrupoMostrado(gi: number, col: ColumnaTabla, opciones: string[] | null): string {
  const bruto = (grupos.value[gi]?.valoresGrupo?.[col.id] as string) || '';
  return etiquetaDeValor(bruto, opciones, col.etiquetasBooleano);
}
</script>

<template>
  <div class="mt-2">
    <div class="overflow-x-auto rounded-lg border border-brand-200">
      <table class="w-full text-xs border-separate border-spacing-0" :class="columnasVista.some((c) => c.ancho) ? 'table-fixed' : ''">
        <thead>
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
          <template v-for="(grupo, gi) in grupos" :key="gi">
            <tr v-if="grupoOcupaFila(grupo)" class="bg-brand-50/60 border-t-2 border-brand-200">
              <td :colspan="abarca" class="px-2 py-1.5">
                <div class="flex items-center gap-2">
                  <input
                    :value="grupo.grupo"
                    @input="updateGrupoNombre(gi, ($event.target as HTMLInputElement).value)"
                    @click.stop
                    type="text"
                    placeholder="Nombre del grupo…"
                    class="flex-1 min-w-0 px-1.5 py-0.5 rounded border border-transparent hover:border-gray-200 focus:border-brand-300 text-xs font-semibold tracking-wide text-heading focus:outline-none bg-transparent"
                  />
                  <button v-if="grupos.length > 1" @click.stop="removeGrupo(gi)" type="button" class="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors shrink-0">
                    <FontAwesomeIcon :icon="faTrash" class="w-2.5 h-2.5" />
                  </button>
                </div>
              </td>
              <!-- Sobrante de la cabecera que el corte parte: en el Excel se fusiona como celda
                   propia, así que aquí se dibuja igual, vacía. -->
              <td v-if="hayResto" :colspan="colspanResto" class="bg-brand-50/40 border-l border-brand-200/60" />
              <template v-for="col in restColumnas" :key="col.id">
                <template v-if="col.id === config.columnaDinamicaId && periodos.length > 0">
                  <td v-for="(p, pi) in periodos" :key="`${col.id}-${pi}`" class="px-1 py-0.5 bg-brand-50/60">
                    <input
                      :value="(Array.isArray(grupo.valoresGrupo?.[col.id]) ? (grupo.valoresGrupo?.[col.id] as string[])[pi] : '') || ''"
                      @input="updateValorGrupoPeriodo(gi, col.id, pi, ($event.target as HTMLInputElement).value)"
                      @click.stop
                      type="text"
                      :title="p"
                      placeholder="—"
                      class="w-16 px-1 py-1 rounded border border-transparent hover:border-amber-200 focus:border-amber-400 text-xs text-heading focus:outline-none focus:ring-1 focus:ring-amber-500/30 bg-transparent"
                    />
                  </td>
                </template>
                <!-- Columna libre de la fila de título: en el Excel es una celda como cualquier
                     otra, así que recibe el mismo trato (cálculo en vivo o desplegable). -->
                <td v-else class="px-1 py-0.5 bg-brand-50/60 align-top">
                  <div v-if="calculoGrupo(gi, col)" class="flex items-start gap-1 px-1 py-1">
                    <FontAwesomeIcon :icon="fieldTypeIcons.calculado" class="w-2.5 h-2.5 text-sky-500 shrink-0 mt-0.5" title="Lo calcula el Excel" />
                    <span v-if="!calculoGrupo(gi, col)!.soportado" class="text-[11px] text-sky-800/60 italic">Lo calcula el Excel</span>
                    <span v-else-if="calculoGrupo(gi, col)!.error" class="text-[11px] text-amber-700 font-mono">{{ calculoGrupo(gi, col)!.error }}</span>
                    <span v-else-if="calculoGrupo(gi, col)!.texto" class="text-xs font-semibold text-heading break-words">{{ calculoGrupo(gi, col)!.texto }}</span>
                    <span v-else class="text-[11px] text-muted">—</span>
                  </div>
                  <CampoListaInput
                    v-else-if="opcionesGrupo(gi, col)"
                    :value="valorGrupoMostrado(gi, col, opcionesGrupo(gi, col))"
                    :opciones="opcionesGrupo(gi, col) ?? []"
                    compacto
                    @change="updateValorGrupo(gi, col.id, $event)"
                    @click.stop
                  />
                  <textarea
                    v-else
                    :value="(grupo.valoresGrupo?.[col.id] as string) || ''"
                    @input="updateValorGrupo(gi, col.id, ($event.target as HTMLTextAreaElement).value)"
                    @click.stop
                    rows="1"
                    placeholder="—"
                    class="block w-full px-1.5 py-1 rounded border border-transparent hover:border-gray-200 focus:border-brand-300 text-xs text-heading focus:outline-none focus:ring-1 focus:ring-brand-500/30 bg-transparent resize-none overflow-y-auto max-h-[15lh] [field-sizing:content]"
                  />
                </td>
              </template>
              <td class="bg-brand-50/60" />
            </tr>
            <TableRow
              v-for="(row, ri) in grupo.filas"
              :key="ri"
              :cols="columnasVista"
              :row="row"
              :row-index="ri"
              :periodos="periodos"
              :columna-dinamica-id="config.columnaDinamicaId"
              :cabeceras="config.cabeceras"
              :hoja="hoja"
              :fila-excel="filaExcelDe(gi, ri)"
              @cell-change="(colId, val) => updateCell(gi, ri, colId, val)"
              @periodo-change="(colId, pi, val) => updatePeriodo(gi, ri, colId, pi, val)"
              @subcelda-change="(colId, subId, val) => updateSubcelda(gi, ri, colId, subId, val)"
              @toggle-partida="(colId) => togglePartida(gi, ri, colId)"
              @delete="removeRow(gi, ri)"
            />
            <tr>
              <td :colspan="totalCols + 1" class="px-1 py-1">
                <div class="flex items-center gap-1">
                  <button @click.stop="addRow(gi)" type="button" class="flex-1 py-1 text-[10px] font-medium text-brand-600 hover:bg-brand-50 transition-colors flex items-center justify-center gap-1">
                    <FontAwesomeIcon :icon="faPlus" class="w-2 h-2" /> Agregar fila
                  </button>
                  <!-- Grupo "filas sueltas": sin fila de título no hay papelera en ningún otro lado
                       para eliminarlo, así que se ofrece aquí mismo. -->
                  <button
                    v-if="!grupoOcupaFila(grupo) && grupos.length > 1"
                    @click.stop="removeGrupo(gi)"
                    type="button"
                    title="Eliminar este grupo de filas sueltas"
                    class="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors shrink-0"
                  >
                    <FontAwesomeIcon :icon="faTrash" class="w-2.5 h-2.5" />
                  </button>
                </div>
              </td>
            </tr>
          </template>
          <tr>
            <td :colspan="totalCols + 1" class="px-1 py-1.5 border-t border-brand-100">
              <button @click.stop="addGrupo" type="button" class="w-full py-1.5 rounded-lg border border-dashed border-brand-200 text-[11px] font-medium text-brand-600 hover:bg-brand-50 transition-colors flex items-center justify-center gap-1">
                <FontAwesomeIcon :icon="faPlus" class="w-2.5 h-2.5" /> Agregar grupo
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
