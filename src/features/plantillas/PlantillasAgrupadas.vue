<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faPen, faIdCard, faMagnifyingGlass, faStar, faFilter } from '@/lib/icons';
import { instrumentoLabels } from '@/lib/icons';
import PracticaToggle from './PracticaToggle.vue';
import EstadoPlantillaToggle from './EstadoPlantillaToggle.vue';
import NuevaPlantillaModal from './NuevaPlantillaModal.vue';
import { useActualizarPlantilla } from '@/composables/usePlantillas';
import { usePushActividad } from '@/composables/useActividad';
import { useUiStore } from '@/stores/ui';
import type { Plantilla, Sector, TipoInstrumento, TipologiaIoarr } from '@/types';

// Listado de plantillas de UN instrumento, agrupadas por sector, con buscador y filtro de sector.
// Nació como vista exclusiva de fichas técnicas (de ahí el destacado del formato 6A del MEF, que
// solo aplica a ese instrumento) y se generalizó para servir también a Formatos, IOARR y Perfiles.
const props = withDefaults(
  defineProps<{
    plantillas: Plantilla[];
    sectores: Sector[];
    instrumento?: TipoInstrumento;
  }>(),
  { instrumento: 'ficha_tecnica' },
);

const busqueda = ref('');
const sectorFiltro = ref<'todos' | string>('todos');

const delInstrumento = computed(() => props.plantillas.filter((p) => p.instrumento === props.instrumento));

// El formato 6A es la ficha técnica general del MEF: se muestra aparte, arriba de todo, porque
// aplica a cualquier sector. Los demás instrumentos no tienen un equivalente.
const mef = computed(() =>
  props.instrumento === 'ficha_tecnica' ? (delInstrumento.value.find((p) => p.codigo === '6A') ?? null) : null,
);
const resto = computed(() => delInstrumento.value.filter((p) => p.id !== mef.value?.id));

function coincide(p: Plantilla): boolean {
  const q = busqueda.value.trim().toLowerCase();
  if (!q) return true;
  return p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q);
}

// El destacado del MEF ignora el filtro de sector a propósito: no pertenece a un sector concreto.
const mefVisible = computed(() => (mef.value && coincide(mef.value) ? mef.value : null));
const restoFiltrado = computed(() => resto.value.filter(coincide));

const sectoresConAlgo = computed(() => props.sectores.filter((s) => delInstrumento.value.some((p) => p.sectorId === s.id)));

const grupos = computed(() =>
  props.sectores
    .filter((s) => sectorFiltro.value === 'todos' || s.id === sectorFiltro.value)
    .map((s) => ({ sector: s, plantillas: restoFiltrado.value.filter((p) => p.sectorId === s.id) }))
    .filter((g) => g.plantillas.length > 0),
);

const total = computed(() => grupos.value.reduce((n, g) => n + g.plantillas.length, 0));

// IOARR es sigla: se deja tal cual, no en minúscula como el resto de etiquetas.
const placeholder = computed(() => {
  const etiqueta = props.instrumento === 'ioarr' ? 'IOARR' : instrumentoLabels[props.instrumento].toLowerCase();
  return `Buscar ${etiqueta} por nombre, código o descripción...`;
});

/** Los perfiles se editan en su propia pantalla, no en el editor de estructura. */
function rutaEditar(p: Plantilla): string {
  return `/sectores/${p.sectorId}/plantilla/${p.id}/${p.instrumento === 'perfil' ? 'perfil' : 'editar'}`;
}

const ui = useUiStore();
const actualizarPlantilla = useActualizarPlantilla();
const pushActividad = usePushActividad();
const editandoPlantillaId = ref<string | null>(null);
const editandoPlantilla = computed(() => props.plantillas.find((p) => p.id === editandoPlantillaId.value) ?? null);

async function handleActualizarDatos(
  codigo: string,
  nombre: string,
  descripcion: string,
  instrumento: TipoInstrumento,
  tipologiasIoarr: TipologiaIoarr[] | undefined,
) {
  if (!editandoPlantillaId.value) return;
  await actualizarPlantilla.mutateAsync({ id: editandoPlantillaId.value, data: { codigo, nombre, descripcion, instrumento, tipologiasIoarr } });
  await pushActividad.mutateAsync({ mensaje: `Se actualizaron los datos de la plantilla ${codigo} — ${nombre}`, color: 'blue' });
  ui.toast('Datos actualizados');
  editandoPlantillaId.value = null;
}
</script>

<template>
  <div class="p-4 space-y-6">
    <div class="flex flex-col sm:flex-row gap-3">
      <div class="relative flex-1">
        <FontAwesomeIcon :icon="faMagnifyingGlass" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
        <input
          v-model="busqueda"
          type="text"
          :placeholder="placeholder"
          class="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
      </div>
      <div class="relative sm:w-64 shrink-0">
        <FontAwesomeIcon :icon="faFilter" class="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 pointer-events-none" />
        <select
          v-model="sectorFiltro"
          class="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        >
          <option value="todos">Todos los sectores</option>
          <option v-for="s in sectoresConAlgo" :key="s.id" :value="s.id">{{ s.nombre }}</option>
        </select>
      </div>
    </div>

    <div v-if="mefVisible">
      <p class="text-[11px] font-semibold uppercase tracking-widest text-brand-600 mb-2 flex items-center gap-1.5">
        <FontAwesomeIcon :icon="faStar" class="w-2.5 h-2.5" />
        Ficha técnica del MEF
      </p>
      <div class="rounded-lg border-2 border-brand-200 bg-brand-50/40 overflow-hidden">
        <div class="flex items-center justify-between gap-3 px-4 py-2.5">
          <div class="flex items-center gap-3 min-w-0">
            <span class="inline-flex items-center justify-center w-auto min-w-9 px-2 h-7 rounded-md border border-brand-200 text-brand-700 text-xs font-bold bg-brand-50 shrink-0">
              {{ mefVisible.codigo }}
            </span>
            <div class="min-w-0">
              <p class="text-sm font-medium text-heading truncate">{{ mefVisible.nombre }}</p>
              <p class="text-xs text-muted truncate">{{ mefVisible.descripcion }}</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <PracticaToggle :plantilla="mefVisible" />
            <EstadoPlantillaToggle :plantilla="mefVisible" />
            <button
              @click="editandoPlantillaId = mefVisible.id"
              type="button"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              title="Editar código, nombre, tipo y descripción"
            >
              <FontAwesomeIcon :icon="faIdCard" class="w-3 h-3" />
              Datos
            </button>
            <RouterLink
              :to="rutaEditar(mefVisible)"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-white bg-sidebar hover:bg-heading transition-colors"
            >
              <FontAwesomeIcon :icon="faPen" class="w-3 h-3" />
              Edit. plantilla
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-5">
      <div v-for="{ sector, plantillas: delSector } in grupos" :key="sector.id">
        <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2 pb-1 border-b border-gray-100">
          {{ sector.nombre }} <span class="text-gray-300 normal-case font-normal">· {{ delSector.length }}</span>
        </p>
        <div class="rounded-lg border border-gray-100">
          <div
            v-for="p in delSector"
            :key="p.id"
            class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span class="inline-flex items-center justify-center w-auto min-w-9 px-2 h-7 rounded-md border border-brand-200 text-brand-700 text-xs font-bold bg-brand-50 shrink-0">
                {{ p.codigo }}
              </span>
              <div class="min-w-0">
                <p class="text-sm font-medium text-heading truncate">{{ p.nombre }}</p>
                <p class="text-xs text-muted truncate">{{ p.descripcion }}</p>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <PracticaToggle :plantilla="p" />
              <EstadoPlantillaToggle :plantilla="p" />
              <button
                @click="editandoPlantillaId = p.id"
                type="button"
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                title="Editar código, nombre, tipo y descripción"
              >
                <FontAwesomeIcon :icon="faIdCard" class="w-3 h-3" />
                Datos
              </button>
              <RouterLink
                :to="rutaEditar(p)"
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-white bg-sidebar hover:bg-heading transition-colors"
              >
                <FontAwesomeIcon :icon="faPen" class="w-3 h-3" />
                Edit. plantilla
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
      <p v-if="total === 0 && !mefVisible" class="text-center text-sm text-muted py-8">
        No se encontraron resultados.
      </p>
    </div>

    <NuevaPlantillaModal
      :is-open="!!editandoPlantilla"
      :plantilla="editandoPlantilla"
      @close="editandoPlantillaId = null"
      @update="handleActualizarDatos"
    />
  </div>
</template>
