<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faCircleExclamation, faCircleXmark, faRotate, faUserPlus, faCalendarXmark, faStar } from '@/lib/icons';
import CancelarTicketModal from './CancelarTicketModal.vue';
import Avatar from '@/components/Avatar.vue';
import { useDocentesDisponiblesQuery, useAsignarTicket, useMarcarEnEspera, useReabrirHorario, useCancelarTicketAdmin } from '@/composables/useTicketsAsesoria';
import { useUiStore } from '@/stores/ui';
import { colorCategoria } from '@/lib/consultaAsesorUI';
import type { SolicitudAsesoria } from '@/types';

const props = defineProps<{ isOpen: boolean; ticket: SolicitudAsesoria | null }>();
const emit = defineEmits<{ close: [] }>();

const ui = useUiStore();
const ticketId = computed(() => props.ticket?.id ?? null);
const { data: docentes, isLoading, refetch } = useDocentesDisponiblesQuery(() => (props.isOpen ? ticketId.value : null));

const asignarTicket = useAsignarTicket();
const marcarEnEspera = useMarcarEnEspera();
const reabrirHorario = useReabrirHorario();
const cancelarTicket = useCancelarTicketAdmin();
const showCancelar = ref(false);

const horarioLegible = computed(() => {
  const t = props.ticket;
  if (!t?.horarioFecha) return null;
  const fecha = new Date(`${t.horarioFecha}T00:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  return t.horarioHoraInicio && t.horarioHoraFin ? `${fechaCap}, ${t.horarioHoraInicio} - ${t.horarioHoraFin}` : fechaCap;
});

async function asignar(asesorId: string) {
  if (!ticketId.value) return;
  await asignarTicket.mutateAsync({ id: ticketId.value, asesorId });
  ui.toast('Ticket asignado');
  emit('close');
}

async function marcarComoEnEspera() {
  if (!ticketId.value) return;
  await marcarEnEspera.mutateAsync(ticketId.value);
  ui.toast('Ticket marcado como en espera');
  emit('close');
}

async function reabrir() {
  if (!ticketId.value) return;
  await reabrirHorario.mutateAsync(ticketId.value);
  ui.toast('Se pidió al alumno elegir un nuevo horario');
  emit('close');
}

async function confirmarCancelar() {
  if (!ticketId.value) return;
  await cancelarTicket.mutateAsync(ticketId.value);
  showCancelar.value = false;
  ui.toast('Ticket cancelado');
  emit('close');
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen && ticket" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-lg max-h-[85vh] overflow-y-auto" @click.stop>
          <div class="h-1.5 bg-red-500 rounded-t-2xl" />

          <div class="p-6 pb-4 flex items-start justify-between">
            <div class="flex items-start gap-3.5">
              <div class="w-14 h-14 rounded-full bg-white border border-red-100 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faCircleExclamation" class="w-10 h-10 text-red-500" />
              </div>
              <div>
                <h2 class="text-lg font-bold text-heading">Ningún docente aceptó a tiempo</h2>
                <p class="text-sm text-muted mt-1 leading-relaxed">
                  <template v-if="horarioLegible">
                    El horario <span class="font-semibold text-heading">{{ horarioLegible }}</span> venció sin respuesta.
                  </template>
                  <template v-else>
                    El ticket <span class="font-semibold text-heading">#{{ ticket.id }}</span> venció sin respuesta.
                  </template>
                  <br />
                  Asigna manualmente un docente disponible.
                </p>
              </div>
            </div>
            <button @click="emit('close')" type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100 shrink-0">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <div class="px-6 pb-6 space-y-5 border-t border-gray-100 pt-5">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-heading">Docentes disponibles ahora</h3>
              <button @click="refetch()" type="button" class="text-xs text-brand-600 font-medium hover:underline flex items-center gap-1.5">
                <FontAwesomeIcon :icon="faRotate" class="w-3 h-3" />
                Actualizar
              </button>
            </div>

            <p v-if="isLoading" class="text-sm text-muted">Cargando…</p>
            <div v-else-if="(docentes ?? []).length === 0" class="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <p class="text-sm text-heading font-medium">No hay asesores disponibles ahora mismo.</p>
              <p class="text-xs text-muted mt-1">El ticket puede marcarse "En espera" — no consume ni libera la consulta del alumno hasta que haya cobertura.</p>
              <button
                @click="marcarComoEnEspera"
                :disabled="marcarEnEspera.isPending.value"
                type="button"
                class="mt-3 px-4 py-2 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors duration-75"
              >
                Marcar como "En espera"
              </button>
            </div>
            <div v-else class="space-y-2.5">
              <div v-for="d in docentes" :key="d.id" class="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors duration-75">
                <div class="flex items-center gap-3.5 min-w-0">
                  <Avatar :nombre="d.nombre" :fotoUrl="d.fotoUrl" size="w-14 h-14" />
                  <div class="min-w-0">
                    <p class="font-semibold text-heading text-sm truncate">{{ d.nombre }}</p>
                    <span v-if="d.especialidad" class="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium" :class="colorCategoria(d.especialidad)">
                      {{ d.especialidad }}
                    </span>
                    <p class="text-xs text-muted mt-1 flex items-center gap-1">
                      <FontAwesomeIcon :icon="faStar" class="w-3 h-3 text-amber-400 shrink-0" />
                      <template v-if="d.calificacionPromedio != null">{{ d.calificacionPromedio.toFixed(1) }} ({{ d.consultasAtendidas }} consulta{{ d.consultasAtendidas === 1 ? '' : 's' }})</template>
                      <template v-else>Sin calificaciones aún</template>
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-3.5 shrink-0">
                  <div class="text-right hidden sm:block">
                    <p class="text-xs font-semibold text-green-600 flex items-center gap-1.5 justify-end">
                      <span class="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Disponible
                    </p>
                    <p class="text-[11px] text-muted">Ahora</p>
                  </div>
                  <button
                    @click="asignar(d.id)"
                    :disabled="asignarTicket.isPending.value"
                    type="button"
                    class="px-3.5 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors duration-75 flex items-center gap-1.5"
                  >
                    <FontAwesomeIcon :icon="faUserPlus" class="w-3 h-3" />
                    Asignar
                  </button>
                </div>
              </div>
            </div>

            <div class="border-t border-gray-100 pt-4 grid grid-cols-1 gap-3" :class="ticket.tipo === 'video' ? 'sm:grid-cols-2' : ''">
              <button
                v-if="ticket.tipo === 'video'"
                @click="reabrir"
                :disabled="reabrirHorario.isPending.value"
                type="button"
                class="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors duration-75 flex items-center justify-center gap-2"
              >
                <FontAwesomeIcon :icon="faCalendarXmark" class="w-3.5 h-3.5" />
                Reabrir selección de horario al alumno
              </button>
              <button
                @click="showCancelar = true"
                type="button"
                class="px-4 py-2.5 rounded-lg bg-red-50 border border-red-100 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors duration-75 flex items-center justify-center gap-2"
              >
                <FontAwesomeIcon :icon="faCircleXmark" class="w-3.5 h-3.5" />
                Cancelar ticket
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>

  <CancelarTicketModal :is-open="showCancelar" :ticket-id="ticket?.id ?? ''" @close="showCancelar = false" @confirm="confirmarCancelar" />
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
