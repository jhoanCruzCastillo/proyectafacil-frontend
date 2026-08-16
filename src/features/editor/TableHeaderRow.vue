<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faPlus } from '@/lib/icons';
import { estiloAnchoColumna, iniciarResizeColumna } from '@/lib/tableColumnWidth';
import type { ColumnaTabla, CabeceraGrupo } from '@/types';

// Encabezado compartido entre DynamicEditor y GroupedRowsEditor (valores de ejemplo). La columna
// dinámica se expande en una celda de encabezado por período. Si hay cabeceras (agrupación bajo un
// título común), se agrega una fila superior con colspan por grupo, igual que en el editor de
// columnas. Los props editable* (editablePeriodos/showAddPeriodo/editableGrupos) están definidos
// para uso futuro desde el tab Estructura pero ningún caller los pasa hoy — mismo estado que el
// prototipo React original, que tampoco los cablea.
const props = defineProps<{
  cols: ColumnaTabla[];
  periodos: string[];
  columnaDinamicaId?: string;
  cabeceras?: CabeceraGrupo[];
  editablePeriodos?: boolean;
  showAddPeriodo?: boolean;
  editableGrupos?: boolean;
}>();

const emit = defineEmits<{
  'rename-periodo': [index: number, value: string];
  'add-periodo': [];
  'rename-grupo': [grupo: CabeceraGrupo, titulo: string];
  /** Ancho visual (px) de la columna lógica — se guarda en `ColumnaTabla.ancho`. */
  'resize-columna': [colId: string, anchoPx: number];
}>();

function grupoForKey(key: string): CabeceraGrupo | undefined {
  return (props.cabeceras ?? []).find((g) => g.hijoIds.includes(key));
}

interface Run { grupo?: CabeceraGrupo; cols: ColumnaTabla[] }
function buildRuns(): Run[] {
  const runs: Run[] = [];
  for (const col of props.cols) {
    const g = grupoForKey(col.id);
    const last = runs[runs.length - 1];
    if (last && g && last.grupo === g) last.cols.push(col);
    else runs.push({ grupo: g, cols: [col] });
  }
  return runs;
}

// Cuántas celdas físicas ocupa el grupo: la columna dinámica cuenta una por período, y una columna
// partida (4.8) una por subcolumna — el resto, una.
function runSpan(run: Run): number {
  return run.cols.reduce((s, c) => {
    if (c.id === props.columnaDinamicaId) return s + Math.max(props.periodos.length, 1);
    return s + (c.subcolumnas?.length || 1);
  }, 0);
}

function partsDe(col: ColumnaTabla): number {
  if (col.id === props.columnaDinamicaId && props.periodos.length > 0) return props.periodos.length;
  if (col.subcolumnas?.length) return col.subcolumnas.length;
  return 1;
}

function estiloDe(col: ColumnaTabla) {
  return estiloAnchoColumna(col.ancho, partsDe(col));
}

const thBase =
  'relative px-2 py-1.5 text-left font-medium text-white border-b border-r border-white/40 bg-brand-700 text-[11px] align-top break-words whitespace-normal';
// Para celdas con rowspan="2" (columnas sin cabecera padre): no se puede combinar `thBase` con un
// 'align-middle' aparte — ambas clases de alineación quedarían en la hoja de estilos y cuál gana
// depende del orden en que Tailwind las generó, no del orden en el array de clases, así que el
// resultado no era confiable. Con la alineación ya resuelta en un solo string no hay ambigüedad.
const thBaseCentrado = thBase.replace('align-top', 'align-middle');

function onResizeStart(col: ColumnaTabla, parts: number, e: MouseEvent) {
  const th = (e.currentTarget as HTMLElement).parentElement;
  const anchoActual = col.ancho && col.ancho > 0
    ? col.ancho
    : (th?.offsetWidth ?? 96) * parts;
  iniciarResizeColumna(e.clientX, anchoActual, (ancho) => {
    emit('resize-columna', col.id, ancho);
  });
}
</script>

<template>
  <template v-if="!cabeceras || cabeceras.length === 0">
    <tr class="bg-brand-700">
      <template v-for="col in cols" :key="col.id">
        <template v-if="col.id === columnaDinamicaId && periodos.length > 0">
          <th
            v-for="(p, pi) in periodos"
            :key="`${col.id}-${pi}`"
            :style="estiloDe(col)"
            class="relative px-1.5 py-1.5 text-left font-medium text-white border-b border-r border-amber-300 bg-brand-700 text-[11px] align-top break-words whitespace-normal"
          >
            <div class="flex items-start gap-1 min-w-0">
              <input
                v-if="editablePeriodos"
                :value="p"
                @input="emit('rename-periodo', pi, ($event.target as HTMLInputElement).value)"
                @click.stop
                type="text"
                placeholder="Nombre..."
                class="min-w-0 flex-1 px-1 py-0.5 rounded border border-amber-300 bg-brand-100 text-gray-900 text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-400/40 focus:border-amber-400"
              />
              <span v-else class="underline decoration-amber-400 break-words min-w-0">{{ p }}</span>
              <button
                v-if="pi === periodos.length - 1 && showAddPeriodo"
                @click.stop="emit('add-periodo')"
                type="button"
                title="Agregar columna dinámica"
                class="w-4 h-4 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shrink-0"
              >
                <FontAwesomeIcon :icon="faPlus" class="w-2 h-2" />
              </button>
            </div>
            <div
              class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60"
              title="Arrastrar para cambiar el ancho"
              @mousedown.stop.prevent="onResizeStart(col, periodos.length, $event)"
            />
          </th>
        </template>
        <!-- Columna partida (4.8): un encabezado por parte, sobre el mismo ancho de la columna -->
        <template v-else-if="col.subcolumnas && col.subcolumnas.length > 0">
          <th
            v-for="(sub, si) in col.subcolumnas"
            :key="`${col.id}-${sub.id}`"
            :style="estiloDe(col)"
            :class="thBase"
            :title="`${col.nombre} · ${sub.nombre}`"
          >
            {{ sub.nombre || col.nombre }}
            <div
              v-if="si === col.subcolumnas!.length - 1"
              class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60"
              title="Arrastrar para cambiar el ancho"
              @mousedown.stop.prevent="onResizeStart(col, col.subcolumnas!.length, $event)"
            />
          </th>
        </template>
        <th v-else :style="estiloDe(col)" :class="thBase">
          {{ col.nombre }}
          <div
            class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60"
            title="Arrastrar para cambiar el ancho"
            @mousedown.stop.prevent="onResizeStart(col, 1, $event)"
          />
        </th>
      </template>
      <th class="w-8 border-b border-white/40 bg-brand-700" />
    </tr>
  </template>
  <template v-else>
    <tr class="bg-brand-900">
      <template v-for="(run, ri) in buildRuns()" :key="ri">
        <th
          v-if="run.grupo"
          :colspan="runSpan(run)"
          class="px-2 py-1.5 text-center font-semibold text-white border border-white/40 bg-brand-900 text-[11px] break-words whitespace-normal"
        >
          <input
            v-if="editableGrupos"
            :value="run.grupo.titulo"
            @input="emit('rename-grupo', run.grupo, ($event.target as HTMLInputElement).value)"
            @click.stop
            type="text"
            placeholder="Sin título"
            class="w-full text-center bg-transparent border-b border-transparent hover:border-white/40 focus:border-white focus:outline-none text-[11px] font-semibold text-white placeholder:text-white/50"
          />
          <template v-else>{{ run.grupo.titulo || 'Sin título' }}</template>
        </th>
        <!-- Columnas sin grupo (como "Costo unitario" al lado de cabeceras con padre, ver Excel real):
             en vez de una celda vacía arriba + el nombre abajo, la celda del nombre ocupa las dos
             filas del encabezado (rowspan) — misma altura que las columnas agrupadas de al lado. -->
        <template v-else>
          <template v-for="col in run.cols" :key="col.id">
            <template v-if="col.id === columnaDinamicaId && periodos.length > 0">
              <th
                v-for="(p, pi) in periodos"
                :key="`${col.id}-${pi}`"
                rowspan="2"
                :style="estiloDe(col)"
                class="relative px-1.5 py-1.5 text-left font-medium text-white border-b border-r border-amber-300 bg-brand-700 text-[11px] align-middle break-words whitespace-normal"
              >
                <div class="flex items-start gap-1 min-w-0">
                  <input
                    v-if="editablePeriodos"
                    :value="p"
                    @input="emit('rename-periodo', pi, ($event.target as HTMLInputElement).value)"
                    @click.stop
                    type="text"
                    placeholder="Nombre..."
                    class="min-w-0 flex-1 px-1 py-0.5 rounded border border-amber-300 bg-brand-100 text-gray-900 text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-400/40 focus:border-amber-400"
                  />
                  <span v-else class="underline decoration-amber-400 break-words min-w-0">{{ p }}</span>
                  <button
                    v-if="pi === periodos.length - 1 && showAddPeriodo"
                    @click.stop="emit('add-periodo')"
                    type="button"
                    title="Agregar columna dinámica"
                    class="w-4 h-4 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shrink-0"
                  >
                    <FontAwesomeIcon :icon="faPlus" class="w-2 h-2" />
                  </button>
                </div>
                <div
                  class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60"
                  title="Arrastrar para cambiar el ancho"
                  @mousedown.stop.prevent="onResizeStart(col, periodos.length, $event)"
                />
              </th>
            </template>
            <template v-else-if="col.subcolumnas && col.subcolumnas.length > 0">
              <th
                v-for="(sub, si) in col.subcolumnas"
                :key="`${col.id}-${sub.id}`"
                rowspan="2"
                :style="estiloDe(col)"
                :class="thBaseCentrado"
                :title="`${col.nombre} · ${sub.nombre}`"
              >
                {{ sub.nombre || col.nombre }}
                <div
                  v-if="si === col.subcolumnas!.length - 1"
                  class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60"
                  title="Arrastrar para cambiar el ancho"
                  @mousedown.stop.prevent="onResizeStart(col, col.subcolumnas!.length, $event)"
                />
              </th>
            </template>
            <th v-else rowspan="2" :style="estiloDe(col)" :class="thBaseCentrado">
              {{ col.nombre }}
              <div
                class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60"
                title="Arrastrar para cambiar el ancho"
                @mousedown.stop.prevent="onResizeStart(col, 1, $event)"
              />
            </th>
          </template>
        </template>
      </template>
      <th class="w-8 border-b border-white/40 bg-brand-900" />
    </tr>
    <tr class="bg-brand-700">
      <template v-for="col in cols" :key="col.id">
        <!-- Las columnas sin grupo ya se pintaron arriba con rowspan="2" — aquí solo van las que
             tienen un padre (cabecera), para no duplicarlas. -->
        <template v-if="grupoForKey(col.id)">
          <template v-if="col.id === columnaDinamicaId && periodos.length > 0">
            <th
              v-for="(p, pi) in periodos"
              :key="`${col.id}-${pi}`"
              :style="estiloDe(col)"
              class="relative px-1.5 py-1.5 text-left font-medium text-white border-b border-r border-amber-300 bg-brand-700 text-[11px] align-top break-words whitespace-normal"
            >
              <div class="flex items-start gap-1 min-w-0">
                <input
                  v-if="editablePeriodos"
                  :value="p"
                  @input="emit('rename-periodo', pi, ($event.target as HTMLInputElement).value)"
                  @click.stop
                  type="text"
                  placeholder="Nombre..."
                  class="min-w-0 flex-1 px-1 py-0.5 rounded border border-amber-300 bg-brand-100 text-gray-900 text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-400/40 focus:border-amber-400"
                />
                <span v-else class="underline decoration-amber-400 break-words min-w-0">{{ p }}</span>
                <button
                  v-if="pi === periodos.length - 1 && showAddPeriodo"
                  @click.stop="emit('add-periodo')"
                  type="button"
                  title="Agregar columna dinámica"
                  class="w-4 h-4 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shrink-0"
                >
                  <FontAwesomeIcon :icon="faPlus" class="w-2 h-2" />
                </button>
              </div>
              <div
                class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60"
                title="Arrastrar para cambiar el ancho"
                @mousedown.stop.prevent="onResizeStart(col, periodos.length, $event)"
              />
            </th>
          </template>
          <template v-else-if="col.subcolumnas && col.subcolumnas.length > 0">
            <th
              v-for="(sub, si) in col.subcolumnas"
              :key="`${col.id}-${sub.id}`"
              :style="estiloDe(col)"
              :class="thBase"
              :title="`${col.nombre} · ${sub.nombre}`"
            >
              {{ sub.nombre || col.nombre }}
              <div
                v-if="si === col.subcolumnas!.length - 1"
                class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60"
                title="Arrastrar para cambiar el ancho"
                @mousedown.stop.prevent="onResizeStart(col, col.subcolumnas!.length, $event)"
              />
            </th>
          </template>
          <th v-else :style="estiloDe(col)" :class="thBase">
            {{ col.nombre }}
            <div
              class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60"
              title="Arrastrar para cambiar el ancho"
              @mousedown.stop.prevent="onResizeStart(col, 1, $event)"
            />
          </th>
        </template>
      </template>
      <th class="w-8 border-b border-white/40 bg-brand-700" />
    </tr>
  </template>
</template>
