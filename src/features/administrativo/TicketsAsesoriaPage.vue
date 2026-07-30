<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faListCheck, faClock, faHourglassHalf, faCircleCheck, faTriangleExclamation, faUserCheck, faComments, faVideo, faChevronLeft, faChevronRight, faAnglesLeft, faAnglesRight } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import Avatar from '@/components/Avatar.vue';
import TicketDetalleModal from './TicketDetalleModal.vue';
import IntervencionManualModal from './IntervencionManualModal.vue';
import { useDashboardAsesoriaQuery, useTicketsAsesoriaQuery } from '@/composables/useTicketsAsesoria';
import { ESTADO_ASESORIA_LABEL, ESTADO_ASESORIA_CLASE } from '@/lib/estadoAsesoria';
import { etiquetaDocenteFalsa, claseCategoria, codigoTicketFalso, slaFalsoConfig, slaFalsoEstado } from '@/lib/ticketsDemoFake';
import type { EstadoSolicitudAsesoria, SolicitudAsesoria } from '@/types';

type Tab = 'todos' | 'pendiente' | 'en_espera' | 'completado' | 'cancelado';
const TABS: { value: Tab; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'en_espera', label: 'En espera' },
  { value: 'completado', label: 'Completados' },
  { value: 'cancelado', label: 'Cancelados' },
];

const { data: dashboard } = useDashboardAsesoriaQuery();
const { data: tickets, isLoading } = useTicketsAsesoriaQuery();

const asignadosADocente = computed(() => (tickets.value ?? []).filter((t) => t.estado === 'asignado').length);

const kpis = computed(() => [
  { key: 'pendientes', icon: faClock, label: 'Pendientes', valor: dashboard.value?.pendientes ?? '—', caption: 'Requieren atención', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
  { key: 'asignados', icon: faUserCheck, label: 'Esperando aceptación docente', valor: asignadosADocente.value, caption: 'Asignados a docentes', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
  { key: 'en_espera', icon: faHourglassHalf, label: 'En espera', valor: dashboard.value?.enEspera ?? '—', caption: 'Sin docente disponible', iconBg: 'bg-gray-100', iconColor: 'text-gray-500' },
  { key: 'completados', icon: faCircleCheck, label: 'Completados hoy', valor: dashboard.value?.completadosHoy ?? '—', caption: 'Consultas finalizadas', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  { key: 'sla', icon: faTriangleExclamation, label: 'SLA por vencer', valor: dashboard.value?.slaPorVencer ?? '—', caption: 'Riesgo de vencimiento', iconBg: 'bg-red-100', iconColor: 'text-red-600', destacado: (dashboard.value?.slaPorVencer ?? 0) > 0 },
]);

const tabActiva = ref<Tab>('todos');
const ticketsFiltrados = computed(() => {
  if (tabActiva.value === 'todos') return tickets.value ?? [];
  if (tabActiva.value === 'pendiente') return (tickets.value ?? []).filter((t) => t.estado === 'pendiente' || t.estado === 'asignado' || t.estado === 'agendado');
  return (tickets.value ?? []).filter((t) => t.estado === (tabActiva.value as EstadoSolicitudAsesoria));
});

const PORCIONES = [10, 25, 50];
const porPagina = ref(10);
const paginaActual = ref(1);

function cambiarTab(tab: Tab) {
  tabActiva.value = tab;
  paginaActual.value = 1;
}

const totalPaginas = computed(() => Math.max(1, Math.ceil(ticketsFiltrados.value.length / porPagina.value)));

const ticketsPagina = computed(() => {
  const inicio = (paginaActual.value - 1) * porPagina.value;
  return ticketsFiltrados.value.slice(inicio, inicio + porPagina.value);
});

const rangoDesde = computed(() => (ticketsFiltrados.value.length === 0 ? 0 : (paginaActual.value - 1) * porPagina.value + 1));
const rangoHasta = computed(() => Math.min(paginaActual.value * porPagina.value, ticketsFiltrados.value.length));

// Lista de páginas a mostrar en la paginación, con "…" cuando hay más de 7 páginas — ej. 1 … 4 5 6 … 12.
const paginasVisibles = computed<(number | '…')[]>(() => {
  const total = totalPaginas.value;
  const actual = paginaActual.value;
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const paginas: (number | '…')[] = [1];
  if (actual > 3) paginas.push('…');
  for (let p = Math.max(2, actual - 1); p <= Math.min(total - 1, actual + 1); p++) paginas.push(p);
  if (actual < total - 2) paginas.push('…');
  paginas.push(total);
  return paginas;
});

function irAPagina(p: number) {
  paginaActual.value = Math.min(Math.max(1, p), totalPaginas.value);
}

function cambiarPorPagina(valor: number) {
  porPagina.value = valor;
  paginaActual.value = 1;
}

const detalleId = ref<string | null>(null);
const intervencionTicket = ref<SolicitudAsesoria | null>(null);

// Reloj compartido para que las barras de SLA (ficticias, ver ticketsDemoFake.ts) avancen de
// verdad segundo a segundo en vez de quedar estáticas al cargar la página.
const ahora = ref(Date.now());
let intervalo: ReturnType<typeof setInterval> | undefined;
onMounted(() => { intervalo = setInterval(() => { ahora.value = Date.now(); }, 1000); });
onUnmounted(() => clearInterval(intervalo));

const slaConfigPorTicket = new Map<string, ReturnType<typeof slaFalsoConfig>>();
function slaDe(t: SolicitudAsesoria) {
  let cfg = slaConfigPorTicket.get(t.id);
  if (!cfg) {
    cfg = slaFalsoConfig(t.id);
    slaConfigPorTicket.set(t.id, cfg);
  }
  return slaFalsoEstado(cfg, ahora.value);
}
</script>

<template>
  <PageShell compact :icon="faListCheck" title="Tickets de asesoría" description="Solicitudes de asesoría 1:1 de todos los alumnos.">
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <div
        v-for="kpi in kpis"
        :key="kpi.key"
        class="rounded-xl border bg-white p-4 flex items-center gap-3"
        :class="kpi.destacado ? 'border-red-200 bg-red-50/60' : 'border-gray-100 shadow-sm'"
      >
        <div class="w-11 h-11 rounded-full flex items-center justify-center shrink-0" :class="kpi.iconBg">
          <FontAwesomeIcon :icon="kpi.icon" class="w-4.5 h-4.5" :class="kpi.iconColor" />
        </div>
        <div class="min-w-0">
          <p class="text-xs font-medium text-muted leading-tight">{{ kpi.label }}</p>
          <p class="text-2xl font-bold leading-tight" :class="kpi.destacado ? 'text-red-600' : 'text-heading'">{{ kpi.valor }}</p>
          <p class="text-[11px] text-muted">{{ kpi.caption }}</p>
        </div>
      </div>
    </div>

    <div class="flex gap-1 mb-4 border-b border-gray-100">
      <button
        v-for="tab in TABS"
        :key="tab.value"
        @click="cambiarTab(tab.value)"
        type="button"
        class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-75"
        :class="tabActiva === tab.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'"
      >
        {{ tab.label }}
      </button>
    </div>

    <p v-if="isLoading" class="text-sm text-muted">Cargando…</p>
    <p v-else-if="ticketsFiltrados.length === 0" class="text-sm text-muted py-8 text-center">No hay tickets en esta categoría.</p>
    <div v-else class="overflow-x-auto rounded-xl border border-gray-200">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="text-left text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
            <th class="py-3 px-4">Ticket</th>
            <th class="py-3 px-4">Alumno</th>
            <th class="py-3 px-4">Categoría</th>
            <th class="py-3 px-4">Modalidad</th>
            <th class="py-3 px-4">Estado</th>
            <th class="py-3 px-4">Docente</th>
            <th class="py-3 px-4">SLA (tiempo restante)</th>
            <th class="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in ticketsPagina" :key="t.id" class="border-b border-gray-200 last:border-b-0">
            <td class="py-4 px-4 font-mono text-xs whitespace-nowrap" :class="slaDe(t).vencido ? 'text-red-600 font-semibold' : 'text-heading'">{{ codigoTicketFalso(t.id) }}</td>
            <td class="py-4 px-4 text-heading whitespace-nowrap">
              <div class="flex items-center gap-2">
                <Avatar :nombre="t.clienteNombre ?? '?'" :fotoUrl="t.clienteFotoUrl" size="w-7 h-7" />
                {{ t.clienteNombre }}
              </div>
            </td>
            <td class="py-4 px-4">
              <span v-if="t.sectorNombre" class="px-2.5 py-1 rounded-full text-[11px] font-medium" :class="claseCategoria(t.sectorNombre)">{{ t.sectorNombre }}</span>
              <span v-else class="text-muted">—</span>
            </td>
            <td class="py-4 px-4">
              <span
                class="w-7 h-7 rounded-full flex items-center justify-center"
                :class="t.tipo === 'video' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'"
                :title="t.tipo === 'video' ? 'Videollamada' : 'Chat'"
              >
                <FontAwesomeIcon :icon="t.tipo === 'video' ? faVideo : faComments" class="w-3.5 h-3.5" />
              </span>
            </td>
            <td class="py-4 px-4">
              <span class="px-2.5 py-1 rounded-full text-[11px] font-medium" :class="ESTADO_ASESORIA_CLASE[t.estado]">{{ ESTADO_ASESORIA_LABEL[t.estado] }}</span>
            </td>
            <td class="py-4 px-4 text-muted whitespace-nowrap">
              <div v-if="t.docenteNombre" class="flex items-center gap-2">
                <Avatar :nombre="t.docenteNombre" :fotoUrl="t.docenteFotoUrl" size="w-7 h-7" />
                <div class="leading-tight">
                  <div class="text-heading">{{ t.docenteNombre }}</div>
                  <div class="text-[11px] text-muted">{{ etiquetaDocenteFalsa(t.id) }}</div>
                </div>
              </div>
              <span v-else class="flex items-center gap-1.5">
                Sin asignar
                <span class="text-[11px] text-muted">· {{ etiquetaDocenteFalsa(t.id) }}</span>
              </span>
            </td>
            <td class="py-4 px-4 whitespace-nowrap min-w-[160px]">
              <div class="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div class="h-full rounded-full transition-all duration-1000 ease-linear" :class="slaDe(t).barraClase" :style="{ width: slaDe(t).pct + '%' }" />
              </div>
              <span class="text-xs" :class="slaDe(t).textoClase">{{ slaDe(t).texto }}</span>
            </td>
            <td class="py-4 px-4 text-right whitespace-nowrap">
              <button
                v-if="slaDe(t).vencido"
                @click="intervencionTicket = t"
                type="button"
                class="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors duration-75 mr-2"
              >
                Intervenir
              </button>
              <button
                @click="detalleId = t.id"
                type="button"
                class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75"
              >
                Ver detalle
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!isLoading && ticketsFiltrados.length > 0" class="flex flex-wrap items-center justify-between gap-4 mt-4">
      <p class="text-xs text-muted">Mostrando {{ rangoDesde }} a {{ rangoHasta }} de {{ ticketsFiltrados.length }} tickets</p>

      <div class="flex items-center gap-1">
        <button type="button" :disabled="paginaActual === 1" @click="irAPagina(1)" class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-75">
          <FontAwesomeIcon :icon="faAnglesLeft" class="w-3 h-3" />
        </button>
        <button type="button" :disabled="paginaActual === 1" @click="irAPagina(paginaActual - 1)" class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-75">
          <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
        </button>

        <template v-for="(p, i) in paginasVisibles" :key="i">
          <span v-if="p === '…'" class="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
          <button
            v-else
            type="button"
            @click="irAPagina(p)"
            class="w-8 h-8 rounded-lg text-sm font-medium flex items-center justify-center transition-colors duration-75"
            :class="p === paginaActual ? 'border-2 border-brand-600 text-brand-700' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'"
          >
            {{ p }}
          </button>
        </template>

        <button type="button" :disabled="paginaActual === totalPaginas" @click="irAPagina(paginaActual + 1)" class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-75">
          <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3" />
        </button>
        <button type="button" :disabled="paginaActual === totalPaginas" @click="irAPagina(totalPaginas)" class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-75">
          <FontAwesomeIcon :icon="faAnglesRight" class="w-3 h-3" />
        </button>
      </div>

      <label class="flex items-center gap-2 text-xs text-muted">
        Mostrar:
        <select
          :value="porPagina"
          @change="cambiarPorPagina(Number(($event.target as HTMLSelectElement).value))"
          class="rounded-lg border border-gray-200 text-sm text-heading px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        >
          <option v-for="n in PORCIONES" :key="n" :value="n">{{ n }} por página</option>
        </select>
      </label>
    </div>
  </PageShell>

  <TicketDetalleModal :is-open="!!detalleId" :ticket-id="detalleId" @close="detalleId = null" />
  <IntervencionManualModal :is-open="!!intervencionTicket" :ticket="intervencionTicket" @close="intervencionTicket = null" />
</template>
