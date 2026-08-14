<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faGear, faCheck, faPlus, faTrash, faTriangleExclamation, columnTypeLabels, columnTypePrimitivos } from '@/lib/icons';
import type { ColumnaTabla, CabeceraGrupo, SubcolumnaTabla, TipoColumna } from '@/types';

interface SiblingOption {
  id: string;
  nombre: string;
}

const props = defineProps<{
  isOpen: boolean;
  columna: ColumnaTabla | null;
  /** true cuando `columna` es la celda padre de una columna dinámica (matriz_por_periodos) */
  esDinamica?: boolean;
  /** Id que identifica a esta columna para efectos de agrupación bajo cabecera (sentinel reservado si es la dinámica) */
  columnaId: string;
  grupo?: CabeceraGrupo;
  siblingOptions: SiblingOption[];
  /** true = el modal se abrió desde el engranaje de una cabecera ya agrupada — oculta la posición en Excel */
  soloGrupo?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  'update-columna': [updates: Partial<ColumnaTabla>];
  'update-grupo': [grupo: { titulo: string; hijoIds: string[] } | null];
}>();

const agrupado = computed(() => !!props.grupo);
const hijoIds = computed(() => props.grupo?.hijoIds ?? [props.columnaId]);

function toggleAgrupado() {
  emit('update-grupo', agrupado.value ? null : { titulo: '', hijoIds: [props.columnaId] });
}

function toggleSibling(id: string) {
  const next = hijoIds.value.includes(id) ? hijoIds.value.filter((h) => h !== id) : [...hijoIds.value, id];
  emit('update-grupo', { titulo: props.grupo?.titulo ?? '', hijoIds: next });
}

// --- Celdas partidas (subcolumnas, convención 4.8) ---

const subcolumnas = computed<SubcolumnaTabla[]>(() => props.columna?.subcolumnas ?? []);
const tieneSubcolumnas = computed(() => subcolumnas.value.length > 0);

// El ancho declarado de la columna padre es el espacio total a repartir; la suma de las partes
// debería cuadrar con él. Si no cuadra se avisa, pero no se bloquea: un Excel real puede tener
// una distribución que no anticipamos.
const anchoPadre = computed(() => props.columna?.abarcaColumnasExcel ?? 1);
const anchoPartes = computed(() => subcolumnas.value.reduce((t, s) => t + (s.abarcaColumnasExcel ?? 1), 0));
const anchoDescuadrado = computed(() => tieneSubcolumnas.value && anchoPartes.value !== anchoPadre.value);

function siguienteColumnaExcel(letra: string | undefined, offset: number): string {
  if (!letra) return '';
  let n = 0;
  for (const ch of letra.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  n += offset;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Nace con dos partes — es el caso real (un dato + su referencia) y el mínimo con el que partir
// una celda tiene sentido. Se reparten el ancho del padre y las columnas Excel consecutivas.
function toggleSubcolumnas() {
  if (tieneSubcolumnas.value) {
    emit('update-columna', { subcolumnas: undefined });
    return;
  }
  const base = props.columna?.columnaExcel;
  const tipoPadre = props.columna?.tipo ?? 'texto_corto';
  emit('update-columna', {
    subcolumnas: [
      { id: 'parte1', nombre: props.columna?.nombre || 'Parte 1', tipo: tipoPadre, columnaExcel: base, abarcaColumnasExcel: 1 },
      { id: 'parte2', nombre: 'Parte 2', tipo: 'texto_corto', columnaExcel: siguienteColumnaExcel(base, 1), abarcaColumnasExcel: 1 },
    ],
  });
}

function actualizarSub(idx: number, updates: Partial<SubcolumnaTabla>) {
  emit('update-columna', { subcolumnas: subcolumnas.value.map((s, i) => (i === idx ? { ...s, ...updates } : s)) });
}

function agregarSub() {
  const ultima = subcolumnas.value[subcolumnas.value.length - 1];
  const siguiente = siguienteColumnaExcel(ultima?.columnaExcel, ultima?.abarcaColumnasExcel ?? 1);
  emit('update-columna', {
    subcolumnas: [
      ...subcolumnas.value,
      { id: `parte${subcolumnas.value.length + 1}`, nombre: `Parte ${subcolumnas.value.length + 1}`, tipo: 'texto_corto', columnaExcel: siguiente, abarcaColumnasExcel: 1 },
    ],
  });
}

// Quitar hasta dejar una sola parte deshace la partición: una columna con una sola celda no está
// partida, es una celda normal.
function quitarSub(idx: number) {
  const next = subcolumnas.value.filter((_, i) => i !== idx);
  emit('update-columna', { subcolumnas: next.length > 1 ? next : undefined });
}
</script>

<template>
  <Transition name="fade">
    <!-- Sin cierre por click en el backdrop: al seleccionar texto en un input y soltar
         fuera, el click termina en el overlay y cerraba el modal por accidente. -->
    <div v-if="isOpen && columna" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-xs">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <FontAwesomeIcon :icon="faGear" class="w-3.5 h-3.5 text-brand-600" />
              <h2 class="text-sm font-bold text-heading">{{ soloGrupo ? 'Editar grupo de cabecera' : 'Configurar columna' }}</h2>
            </div>
            <button @click="emit('close')" class="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100">
              <FontAwesomeIcon :icon="faXmark" class="w-3.5 h-3.5" />
            </button>
          </div>
          <div class="p-5 space-y-4">
            <div v-if="!soloGrupo" class="space-y-3">
              <p class="text-xs text-muted">
                {{ esDinamica ? `Posición de cada columna dinámica generada por "${columna.nombre}".` : `Posición de "${columna.nombre}" en la hoja de Excel.` }}
              </p>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] font-medium text-muted mb-1">{{ esDinamica ? 'Columna inicial' : 'Columna' }}</label>
                  <input
                    :value="columna.columnaExcel || ''"
                    @input="emit('update-columna', { columnaExcel: ($event.target as HTMLInputElement).value })"
                    type="text"
                    placeholder="Ej. B"
                    class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-medium text-muted mb-1">{{ esDinamica ? 'Abarca (por columna)' : 'Abarca columnas' }}</label>
                  <input
                    :value="columna.abarcaColumnasExcel ?? ''"
                    @input="emit('update-columna', { abarcaColumnasExcel: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined })"
                    type="number"
                    placeholder="1"
                    min="1"
                    class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            <!-- Celdas partidas: no aplica a la columna dinámica (ya se expande por período) -->
            <div v-if="!soloGrupo && !esDinamica" class="pt-3 border-t border-gray-100 space-y-2.5">
              <button @click="toggleSubcolumnas" type="button" class="w-full flex items-center justify-between">
                <span class="text-[10px] font-medium text-muted">Tiene subcolumnas</span>
                <span class="relative w-8 h-4.5 rounded-full transition-colors duration-100" :class="tieneSubcolumnas ? 'bg-brand-600' : 'bg-gray-200'">
                  <span class="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-100" :class="tieneSubcolumnas ? 'translate-x-3.5' : 'translate-x-0.5'" />
                </span>
              </button>

              <div v-if="tieneSubcolumnas" class="space-y-2">
                <p class="text-[10px] text-muted leading-relaxed">
                  El ancho de esta columna se reparte en varias celdas de Excel. En cada fila eliges si va partida o fusionada.
                </p>

                <div
                  v-for="(sub, idx) in subcolumnas"
                  :key="idx"
                  class="rounded-lg border border-gray-200 p-2.5 space-y-2"
                >
                  <div class="flex items-center gap-2">
                    <input
                      :value="sub.nombre"
                      @input="actualizarSub(idx, { nombre: ($event.target as HTMLInputElement).value })"
                      type="text"
                      placeholder="Nombre"
                      class="flex-1 min-w-0 px-2 py-1.5 rounded border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                    />
                    <button
                      v-if="subcolumnas.length > 2"
                      @click="quitarSub(idx)"
                      type="button"
                      title="Quitar subcolumna"
                      class="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors shrink-0"
                    >
                      <FontAwesomeIcon :icon="faTrash" class="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <div class="grid grid-cols-3 gap-1.5">
                    <select
                      :value="sub.tipo"
                      @change="actualizarSub(idx, { tipo: ($event.target as HTMLSelectElement).value as TipoColumna })"
                      class="px-1.5 py-1.5 rounded border border-gray-200 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    >
                      <option v-for="t in columnTypePrimitivos" :key="t" :value="t">{{ columnTypeLabels[t] }}</option>
                    </select>
                    <input
                      :value="sub.columnaExcel || ''"
                      @input="actualizarSub(idx, { columnaExcel: ($event.target as HTMLInputElement).value })"
                      type="text"
                      placeholder="Col."
                      class="px-1.5 py-1.5 rounded border border-gray-200 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    />
                    <input
                      :value="sub.abarcaColumnasExcel ?? ''"
                      @input="actualizarSub(idx, { abarcaColumnasExcel: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined })"
                      type="number"
                      min="1"
                      placeholder="Abarca"
                      class="px-1.5 py-1.5 rounded border border-gray-200 text-[11px] focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    />
                  </div>
                </div>

                <button
                  @click="agregarSub"
                  type="button"
                  class="w-full py-1.5 rounded-lg border border-dashed border-gray-200 text-[11px] font-medium text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors flex items-center justify-center gap-1"
                >
                  <FontAwesomeIcon :icon="faPlus" class="w-2.5 h-2.5" /> Agregar subcolumna
                </button>

                <p v-if="anchoDescuadrado" class="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 rounded-lg p-2">
                  <FontAwesomeIcon :icon="faTriangleExclamation" class="w-2.5 h-2.5 mt-0.5 shrink-0" />
                  <span>Las partes suman {{ anchoPartes }} columna{{ anchoPartes === 1 ? '' : 's' }}, pero la columna abarca {{ anchoPadre }}.</span>
                </p>
              </div>
            </div>

            <div :class="soloGrupo ? 'space-y-2.5' : 'pt-3 border-t border-gray-100 space-y-2.5'">
              <button @click="toggleAgrupado" type="button" class="w-full flex items-center justify-between">
                <span class="text-[10px] font-medium text-muted">
                  {{ esDinamica ? 'Agrupar columnas dinámicas bajo un título' : 'Agrupar bajo un título común' }}
                </span>
                <span class="relative w-8 h-4.5 rounded-full transition-colors duration-100" :class="agrupado ? 'bg-brand-600' : 'bg-gray-200'">
                  <span class="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-100" :class="agrupado ? 'translate-x-3.5' : 'translate-x-0.5'" />
                </span>
              </button>

              <div v-if="agrupado" class="space-y-2.5">
                <div>
                  <label class="block text-[10px] font-medium text-muted mb-1">Título de la cabecera</label>
                  <input
                    :value="grupo?.titulo ?? ''"
                    @input="emit('update-grupo', { titulo: ($event.target as HTMLInputElement).value, hijoIds })"
                    type="text"
                    placeholder="Ej. Costos de inversión"
                    autofocus
                    class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                </div>
                <div v-if="siblingOptions.length > 0">
                  <label class="block text-[10px] font-medium text-muted mb-1">Columnas hijas</label>
                  <div class="max-h-32 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                    <button
                      v-for="opt in siblingOptions"
                      :key="opt.id"
                      @click="toggleSibling(opt.id)"
                      type="button"
                      class="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-gray-50 transition-colors duration-75"
                    >
                      <span
                        class="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border"
                        :class="hijoIds.includes(opt.id) ? 'bg-brand-600 border-brand-600' : 'border-gray-300'"
                      >
                        <FontAwesomeIcon v-if="hijoIds.includes(opt.id)" :icon="faCheck" class="w-2 h-2 text-white" />
                      </span>
                      <span class="text-xs text-heading truncate">{{ opt.nombre }}</span>
                    </button>
                  </div>
                </div>
                <p v-else class="text-[10px] text-muted">No hay otras columnas disponibles para agregar como hijas.</p>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.pop-enter-active,
.pop-leave-active {
  transition: all 0.12s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.97) translateY(10px);
}
</style>
