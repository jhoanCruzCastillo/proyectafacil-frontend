<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faListCheck, faClock, faHourglassHalf, faCircleCheck, faTriangleExclamation, faUserCheck, faComments, faVideo } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import Avatar from '@/components/Avatar.vue';
import TicketDetalleModal from './TicketDetalleModal.vue';
import IntervencionManualModal from './IntervencionManualModal.vue';
import { useDashboardAsesoriaQuery, useTicketsAsesoriaQuery } from '@/composables/useTicketsAsesoria';
import { ESTADO_ASESORIA_LABEL, ESTADO_ASESORIA_CLASE } from '@/lib/estadoAsesoria';
import { etiquetaDocenteFalsa, claseCategoria, slaFalsoConfig, slaFalsoEstado } from '@/lib/ticketsDemoFake';
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
        @click="tabActiva = tab.value"
        type="button"
        class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-75"
        :class="tabActiva === tab.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'"
      >
        {{ tab.label }}
      </button>
    </div>

    <p v-if="isLoading" class="text-sm text-muted">Cargando…</p>
    <p v-else-if="ticketsFiltrados.length === 0" class="text-sm text-muted py-8 text-center">No hay tickets en esta categoría.</p>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-[11px] uppercase tracking-widest text-muted border-b border-gray-100">
            <th class="pb-2 pr-4 font-semibold">Ticket</th>
            <th class="pb-2 pr-4 font-semibold">Alumno</th>
            <th class="pb-2 pr-4 font-semibold">Categoría</th>
            <th class="pb-2 pr-4 font-semibold">Modalidad</th>
            <th class="pb-2 pr-4 font-semibold">Estado</th>
            <th class="pb-2 pr-4 font-semibold">Docente</th>
            <th class="pb-2 pr-4 font-semibold">SLA (tiempo restante)</th>
            <th class="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in ticketsFiltrados" :key="t.id" class="border-b border-gray-50">
            <td class="py-3 pr-4 font-mono text-xs text-heading whitespace-nowrap">#{{ t.id }}</td>
            <td class="py-3 pr-4 text-heading whitespace-nowrap">
              <div class="flex items-center gap-2">
                <Avatar :nombre="t.clienteNombre ?? '?'" :fotoUrl="t.clienteFotoUrl" size="w-7 h-7" />
                {{ t.clienteNombre }}
              </div>
            </td>
            <td class="py-3 pr-4">
              <span v-if="t.sectorNombre" class="px-2.5 py-1 rounded-full text-[11px] font-medium" :class="claseCategoria(t.sectorNombre)">{{ t.sectorNombre }}</span>
              <span v-else class="text-muted">—</span>
            </td>
            <td class="py-3 pr-4">
              <span
                class="w-7 h-7 rounded-full flex items-center justify-center"
                :class="t.tipo === 'video' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'"
                :title="t.tipo === 'video' ? 'Videollamada' : 'Chat'"
              >
                <FontAwesomeIcon :icon="t.tipo === 'video' ? faVideo : faComments" class="w-3.5 h-3.5" />
              </span>
            </td>
            <td class="py-3 pr-4">
              <span class="px-2.5 py-1 rounded-full text-[11px] font-medium" :class="ESTADO_ASESORIA_CLASE[t.estado]">{{ ESTADO_ASESORIA_LABEL[t.estado] }}</span>
            </td>
            <td class="py-3 pr-4 text-muted whitespace-nowrap">
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
            <td class="py-3 pr-4 whitespace-nowrap min-w-[160px]">
              <div class="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div class="h-full rounded-full transition-all duration-1000 ease-linear" :class="slaDe(t).barraClase" :style="{ width: slaDe(t).pct + '%' }" />
              </div>
              <span class="text-xs" :class="slaDe(t).textoClase">{{ slaDe(t).texto }}</span>
            </td>
            <td class="py-3 text-right whitespace-nowrap">
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
  </PageShell>

  <TicketDetalleModal :is-open="!!detalleId" :ticket-id="detalleId" @close="detalleId = null" />
  <IntervencionManualModal :is-open="!!intervencionTicket" :ticket="intervencionTicket" @close="intervencionTicket = null" />
</template>
