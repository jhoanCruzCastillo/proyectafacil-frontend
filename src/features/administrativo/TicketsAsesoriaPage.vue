<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faListCheck, faClock, faHourglassHalf, faCircleCheck, faTriangleExclamation, faComments, faVideo } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import Avatar from '@/components/Avatar.vue';
import TicketDetalleModal from './TicketDetalleModal.vue';
import IntervencionManualModal from './IntervencionManualModal.vue';
import { useDashboardAsesoriaQuery, useTicketsAsesoriaQuery } from '@/composables/useTicketsAsesoria';
import { ESTADO_ASESORIA_LABEL, ESTADO_ASESORIA_CLASE } from '@/lib/estadoAsesoria';
import { tiempoHastaVencer } from '@/lib/tiempoRelativo';
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

const tabActiva = ref<Tab>('todos');
const ticketsFiltrados = computed(() => {
  if (tabActiva.value === 'todos') return tickets.value ?? [];
  if (tabActiva.value === 'pendiente') return (tickets.value ?? []).filter((t) => t.estado === 'pendiente' || t.estado === 'asignado' || t.estado === 'agendado');
  return (tickets.value ?? []).filter((t) => t.estado === (tabActiva.value as EstadoSolicitudAsesoria));
});

const detalleId = ref<string | null>(null);
const intervencionTicket = ref<SolicitudAsesoria | null>(null);

function estaVencido(t: SolicitudAsesoria): boolean {
  return (t.estado === 'pendiente' || t.estado === 'en_espera') && !!t.slaVenceEn && tiempoHastaVencer(t.slaVenceEn).vencido;
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}
</script>

<template>
  <PageShell :icon="faListCheck" title="Tickets de asesoría" description="Solicitudes de asesoría 1:1 de todos los alumnos.">
    <template #stats>
      <div class="rounded-xl bg-glass border border-glass-border p-4">
        <p class="text-2xl font-bold text-white">{{ dashboard?.pendientes ?? '—' }}</p>
        <p class="text-xs text-white/60 mt-1 flex items-center gap-1.5"><FontAwesomeIcon :icon="faClock" class="w-3 h-3" /> Pendientes</p>
      </div>
      <div class="rounded-xl bg-glass border border-glass-border p-4">
        <p class="text-2xl font-bold text-white">{{ dashboard?.enEspera ?? '—' }}</p>
        <p class="text-xs text-white/60 mt-1 flex items-center gap-1.5"><FontAwesomeIcon :icon="faHourglassHalf" class="w-3 h-3" /> En espera</p>
      </div>
      <div class="rounded-xl bg-glass border border-glass-border p-4">
        <p class="text-2xl font-bold text-white">{{ dashboard?.completadosHoy ?? '—' }}</p>
        <p class="text-xs text-white/60 mt-1 flex items-center gap-1.5"><FontAwesomeIcon :icon="faCircleCheck" class="w-3 h-3" /> Completados hoy</p>
      </div>
      <div class="rounded-xl border p-4" :class="(dashboard?.slaPorVencer ?? 0) > 0 ? 'bg-red-500/15 border-red-500/30' : 'bg-glass border-glass-border'">
        <p class="text-2xl font-bold" :class="(dashboard?.slaPorVencer ?? 0) > 0 ? 'text-red-300' : 'text-white'">{{ dashboard?.slaPorVencer ?? '—' }}</p>
        <p class="text-xs mt-1 flex items-center gap-1.5" :class="(dashboard?.slaPorVencer ?? 0) > 0 ? 'text-red-300' : 'text-white/60'"><FontAwesomeIcon :icon="faTriangleExclamation" class="w-3 h-3" /> SLA por vencer</p>
      </div>
    </template>

    <div class="flex gap-1 mb-4 border-b border-gray-100 -mt-2">
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
            <th class="pb-2 pr-4 font-semibold">Asesor</th>
            <th class="pb-2 pr-4 font-semibold">SLA</th>
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
            <td class="py-3 pr-4 text-muted">{{ t.sectorNombre ?? '—' }}</td>
            <td class="py-3 pr-4">
              <FontAwesomeIcon :icon="t.tipo === 'video' ? faVideo : faComments" class="w-3.5 h-3.5 text-gray-400" />
            </td>
            <td class="py-3 pr-4">
              <span class="px-2.5 py-1 rounded-full text-[11px] font-medium" :class="ESTADO_ASESORIA_CLASE[t.estado]">{{ ESTADO_ASESORIA_LABEL[t.estado] }}</span>
            </td>
            <td class="py-3 pr-4 text-muted whitespace-nowrap">
              <div v-if="t.docenteNombre" class="flex items-center gap-2">
                <Avatar :nombre="t.docenteNombre" :fotoUrl="t.docenteFotoUrl" size="w-7 h-7" />
                {{ t.docenteNombre }}
              </div>
              <span v-else>Sin asignar</span>
            </td>
            <td class="py-3 pr-4 whitespace-nowrap">
              <span v-if="!t.slaVenceEn" class="text-muted">—</span>
              <span v-else class="text-xs" :class="estaVencido(t) ? 'text-red-600 font-semibold' : 'text-muted'">
                {{ t.estado === 'pendiente' || t.estado === 'en_espera' ? tiempoHastaVencer(t.slaVenceEn).texto : formatFecha(t.slaVenceEn) }}
              </span>
            </td>
            <td class="py-3 text-right whitespace-nowrap">
              <button
                v-if="estaVencido(t)"
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
