<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faArrowLeft, faClock, faVideo, faUserGear } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import IntervencionManualModal from './IntervencionManualModal.vue';
import Avatar from '@/components/Avatar.vue';
import { useTicketsMismoHorarioQuery } from '@/composables/useTicketsAsesoria';
import { tiempoHastaVencer, tiempoRelativo } from '@/lib/tiempoRelativo';
import { colorCategoria } from '@/lib/consultaAsesorUI';
import type { SolicitudAsesoria } from '@/types';

// Fase 2 "caso especial" (docs/proyectafacil-asesorias.md §4): varios alumnos esperando el mismo
// horario de video sin asesor disponible — cada solicitud es independiente, se interviene una por
// una. Se llega aquí desde el detalle de un ticket de video (Módulo 5 agregará el mapa de calor
// como entrada principal).
const route = useRoute();
const fecha = computed(() => String(route.query.fecha ?? ''));
const horaInicio = computed(() => String(route.query.horaInicio ?? ''));
const horaFin = computed(() => String(route.query.horaFin ?? ''));

const { data: tickets, isLoading } = useTicketsMismoHorarioQuery(fecha, horaInicio, horaFin);
const intervencionTicket = ref<SolicitudAsesoria | null>(null);

const fechaLegible = computed(() => {
  if (!fecha.value) return '';
  const texto = new Date(`${fecha.value}T00:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
});
</script>

<template>
  <PageShell :icon="faClock" title="Solicitudes en este horario" :description="`Varios alumnos solicitaron el mismo horario de videollamada y aún no tienen asesor asignado.`">
    <template #actions>
      <RouterLink
        :to="{ name: 'tickets-asesoria' }"
        class="px-5 py-2.5 rounded-lg bg-white/[0.06] border border-white/10 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faArrowLeft" class="w-3.5 h-3.5" />
        Volver a tickets
      </RouterLink>
    </template>

    <div class="flex items-center justify-between gap-4 flex-wrap mb-6 pb-5 border-b border-gray-100">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
          <FontAwesomeIcon :icon="faVideo" class="w-4 h-4" />
        </div>
        <div>
          <p class="font-bold text-heading">{{ fechaLegible }}</p>
          <p class="text-sm text-muted">{{ horaInicio }} - {{ horaFin }}</p>
        </div>
      </div>
      <span v-if="!isLoading" class="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
        {{ (tickets ?? []).length }} alumno{{ (tickets ?? []).length === 1 ? '' : 's' }} esperando
      </span>
    </div>

    <p v-if="isLoading" class="text-sm text-muted">Cargando…</p>
    <p v-else-if="(tickets ?? []).length === 0" class="text-sm text-muted py-8 text-center">No hay solicitudes pendientes para este horario.</p>
    <div v-else class="space-y-3">
      <div
        v-for="t in tickets"
        :key="t.id"
        class="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors duration-75"
      >
        <div class="flex items-center gap-3.5 min-w-0">
          <Avatar :nombre="t.clienteNombre ?? '?'" :fotoUrl="t.clienteFotoUrl" size="w-12 h-12" />
          <div class="min-w-0">
            <p class="font-semibold text-heading text-sm truncate">{{ t.clienteNombre }}</p>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <span v-if="t.sectorNombre" class="px-2 py-0.5 rounded-full text-[11px] font-medium" :class="colorCategoria(t.sectorNombre)">{{ t.sectorNombre }}</span>
              <span class="text-[11px] text-muted">Solicitado {{ tiempoRelativo(t.creadoEn) }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span
            v-if="t.slaVenceEn"
            class="px-2.5 py-1 rounded-full text-[11px] font-semibold"
            :class="tiempoHastaVencer(t.slaVenceEn).vencido ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'"
          >
            {{ tiempoHastaVencer(t.slaVenceEn).texto }}
          </span>
          <button
            @click="intervencionTicket = t"
            type="button"
            class="px-4 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors duration-75 flex items-center gap-1.5"
          >
            <FontAwesomeIcon :icon="faUserGear" class="w-3 h-3" />
            Intervenir
          </button>
        </div>
      </div>
    </div>
  </PageShell>

  <IntervencionManualModal :is-open="!!intervencionTicket" :ticket="intervencionTicket" @close="intervencionTicket = null" />
</template>
