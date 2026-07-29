<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCalendarWeek, faChevronLeft, faChevronRight, faTriangleExclamation, faRotate } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import Avatar from '@/components/Avatar.vue';
import { useSectoresQuery } from '@/composables/useSectores';
import { useCoberturaHorariosQuery } from '@/composables/useCoberturaHorarios';

// Fase 2 "caso especial" (docs/proyectafacil-asesorias.md §4): franjas con ⚠ llevan a
// tickets-mismo-horario (Módulo 4) para intervenir uno por uno.
const router = useRouter();
const { data: sectores } = useSectoresQuery();

const sectorId = ref<string | undefined>(undefined);
const semanaOffset = ref(0);

function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const fechaAncla = computed(() => {
  const d = new Date();
  d.setDate(d.getDate() + semanaOffset.value * 7);
  return fechaLocal(d);
});

const { data: cobertura, isLoading, refetch } = useCoberturaHorariosQuery(fechaAncla, sectorId);

const dias = computed(() =>
  (cobertura.value?.dias ?? []).map((fecha) => {
    const d = new Date(`${fecha}T00:00:00`);
    return { fecha, diaLabel: d.toLocaleDateString('es-PE', { weekday: 'short' }), numero: d.getDate() };
  }),
);

function celda(fecha: string, hora: string) {
  return cobertura.value?.celdas.find((c) => c.fecha === fecha && c.horaInicio === hora);
}

function claseColor(count: number): string {
  if (count === 0) return 'bg-gray-100';
  if (count === 1) return 'bg-green-100';
  if (count <= 3) return 'bg-green-300';
  return 'bg-green-600';
}

function sumar30min(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + 30;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function irAMismoHorario(fecha: string, horaInicio: string) {
  router.push({ name: 'tickets-mismo-horario', query: { fecha, horaInicio, horaFin: sumar30min(horaInicio) } });
}

const rangoLegible = computed(() => {
  if (!cobertura.value) return '';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const inicio = new Date(`${cobertura.value.lunes}T00:00:00`).toLocaleDateString('es-PE', opts);
  const fin = new Date(`${cobertura.value.domingo}T00:00:00`).toLocaleDateString('es-PE', { ...opts, year: 'numeric' });
  return `${inicio} - ${fin}`;
});
</script>

<template>
  <PageShell :icon="faCalendarWeek" title="Cobertura de horarios" description="Visualiza qué franjas tienen pocos o ningún asesor disponible.">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div class="flex items-center gap-3">
        <label class="text-xs font-semibold uppercase tracking-widest text-muted">Categoría</label>
        <select
          v-model="sectorId"
          class="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        >
          <option :value="undefined">Todas</option>
          <option v-for="s in sectores" :key="s.id" :value="s.id">{{ s.nombre }}</option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="semanaOffset -= 1"
          type="button"
          class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors duration-75"
        >
          <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
        </button>
        <span class="text-sm font-medium text-heading px-2 min-w-[10rem] text-center">{{ rangoLegible }}</span>
        <button
          @click="semanaOffset += 1"
          type="button"
          class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors duration-75"
        >
          <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3" />
        </button>
        <button
          @click="refetch()"
          type="button"
          class="ml-2 w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors duration-75"
          title="Actualizar"
        >
          <FontAwesomeIcon :icon="faRotate" class="w-3 h-3" />
        </button>
      </div>
    </div>

    <p v-if="isLoading" class="text-sm text-muted">Cargando…</p>
    <div v-else-if="cobertura" class="overflow-x-auto">
      <table class="w-full text-xs border-separate" style="border-spacing: 2px">
        <thead>
          <tr>
            <th class="text-left text-[11px] uppercase tracking-widest text-muted pr-3 pb-2 sticky left-0 bg-surface-card">Hora</th>
            <th v-for="d in dias" :key="d.fecha" class="text-center text-[11px] uppercase tracking-widest text-muted pb-2 min-w-[4.5rem]">
              {{ d.diaLabel }}<br /><span class="text-heading font-semibold normal-case text-xs">{{ d.numero }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="hora in cobertura.franjas" :key="hora">
            <td class="text-right text-muted pr-3 whitespace-nowrap sticky left-0 bg-surface-card">{{ hora }}</td>
            <td v-for="d in dias" :key="d.fecha" class="p-0">
              <div v-if="celda(d.fecha, hora)" class="relative group">
                <button
                  type="button"
                  @click="celda(d.fecha, hora)!.pendiente && irAMismoHorario(d.fecha, hora)"
                  class="w-full h-8 rounded flex items-center justify-center transition-colors duration-75"
                  :class="[claseColor(celda(d.fecha, hora)!.docentes.length), celda(d.fecha, hora)!.pendiente ? 'cursor-pointer ring-2 ring-red-400' : 'cursor-default']"
                >
                  <FontAwesomeIcon v-if="celda(d.fecha, hora)!.pendiente" :icon="faTriangleExclamation" class="w-3 h-3 text-red-600" />
                </button>

                <div
                  class="pointer-events-none absolute z-20 top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block w-max max-w-[14rem]"
                >
                  <div class="w-2 h-2 bg-gray-900 rotate-45 mx-auto mb-[-4px] relative z-10" />
                  <div class="rounded-lg bg-gray-900 text-white text-xs shadow-lg px-3 py-2">
                    <p class="font-semibold mb-1">{{ d.diaLabel }} {{ d.numero }}, {{ hora }}</p>
                    <div v-if="celda(d.fecha, hora)!.docentes.length > 0" class="space-y-1">
                      <div v-for="doc in celda(d.fecha, hora)!.docentes" :key="doc.id" class="flex items-center gap-1.5">
                        <Avatar :nombre="doc.nombre" :fotoUrl="doc.fotoUrl" size="w-4 h-4" />
                        <span>{{ doc.nombre }}</span>
                      </div>
                    </div>
                    <p v-else class="text-white/70">Sin cobertura</p>
                    <p v-if="celda(d.fecha, hora)!.pendiente" class="text-red-300 font-medium mt-1">Ticket pendiente sin resolver</p>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap items-center gap-5 mt-6 pt-4 border-t border-gray-100 text-xs text-muted">
      <span class="flex items-center gap-1.5"><span class="w-3.5 h-3.5 rounded bg-gray-100 inline-block" /> Sin cobertura</span>
      <span class="flex items-center gap-1.5"><span class="w-3.5 h-3.5 rounded bg-green-100 inline-block" /> 1 asesor</span>
      <span class="flex items-center gap-1.5"><span class="w-3.5 h-3.5 rounded bg-green-300 inline-block" /> 2-3 asesores</span>
      <span class="flex items-center gap-1.5"><span class="w-3.5 h-3.5 rounded bg-green-600 inline-block" /> 4+ asesores</span>
      <span class="flex items-center gap-1.5"><FontAwesomeIcon :icon="faTriangleExclamation" class="w-3 h-3 text-red-600" /> Con ticket pendiente</span>
    </div>
  </PageShell>
</template>
