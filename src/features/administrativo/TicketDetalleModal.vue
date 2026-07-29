<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faVideo, faComments, faCircleCheck, faCircle, faUserGear, faTrash, faEnvelope } from '@/lib/icons';
import IntervencionManualModal from './IntervencionManualModal.vue';
import CancelarTicketModal from './CancelarTicketModal.vue';
import Avatar from '@/components/Avatar.vue';
import { useTicketDetalleQuery, useCancelarTicketAdmin } from '@/composables/useTicketsAsesoria';
import { useUiStore } from '@/stores/ui';
import { ESTADO_ASESORIA_LABEL, ESTADO_ASESORIA_CLASE } from '@/lib/estadoAsesoria';

const props = defineProps<{ isOpen: boolean; ticketId: string | null }>();
const emit = defineEmits<{ close: [] }>();

const ui = useUiStore();
const { data: ticket, isLoading } = useTicketDetalleQuery(() => (props.isOpen ? props.ticketId : null));
const cancelarTicket = useCancelarTicketAdmin();

const puedeIntervenir = computed(() => ticket.value?.estado === 'pendiente' || ticket.value?.estado === 'en_espera');

const showIntervencion = ref(false);
const showCancelar = ref(false);

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
}

async function confirmarCancelar() {
  if (!ticket.value) return;
  await cancelarTicket.mutateAsync(ticket.value.id);
  showCancelar.value = false;
  ui.toast('Ticket cancelado');
  emit('close');
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[85vh] overflow-y-auto" @click.stop>
          <div class="p-6 pb-4 flex items-start justify-between">
            <div class="flex items-center gap-3">
              <h2 class="text-lg font-bold text-heading">Ticket #{{ ticketId }}</h2>
              <span v-if="ticket" class="px-2.5 py-1 rounded-full text-[11px] font-medium" :class="ESTADO_ASESORIA_CLASE[ticket.estado]">
                {{ ESTADO_ASESORIA_LABEL[ticket.estado] }}
              </span>
            </div>
            <button @click="emit('close')" type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <p v-if="isLoading" class="px-6 pb-6 text-sm text-muted">Cargando…</p>
          <div v-else-if="ticket" class="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-5">
              <div>
                <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-2">Datos del alumno</h3>
                <div class="flex items-center gap-3">
                  <Avatar :nombre="ticket.clienteNombre ?? '?'" :fotoUrl="ticket.clienteFotoUrl" size="w-10 h-10" />
                  <div>
                    <p class="font-semibold text-heading text-sm">{{ ticket.clienteNombre }}</p>
                    <p v-if="ticket.clienteCorreo" class="text-xs text-muted mt-0.5 flex items-center gap-1.5">
                      <FontAwesomeIcon :icon="faEnvelope" class="w-2.5 h-2.5" />
                      {{ ticket.clienteCorreo }}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-2">Categoría de la consulta</h3>
                <span class="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700">{{ ticket.sectorNombre ?? '—' }}</span>
              </div>

              <div v-if="ticket.mensajeInicial">
                <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-2">Duda del alumno</h3>
                <p class="text-sm text-heading bg-gray-50 rounded-lg p-3 leading-relaxed">{{ ticket.mensajeInicial }}</p>
              </div>

              <div>
                <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-2">Modalidad{{ ticket.horarioFecha ? ' y horario elegido' : '' }}</h3>
                <div class="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <FontAwesomeIcon :icon="ticket.tipo === 'video' ? faVideo : faComments" class="w-4 h-4 text-brand-600 shrink-0" />
                  <div class="text-sm">
                    <p class="font-medium text-heading">{{ ticket.tipo === 'video' ? 'Videollamada' : 'Chat' }}</p>
                    <p v-if="ticket.horarioFecha" class="text-xs text-muted">
                      {{ new Date(`${ticket.horarioFecha}T00:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }) }},
                      {{ ticket.horarioHoraInicio }} - {{ ticket.horarioHoraFin }}
                    </p>
                  </div>
                </div>
                <RouterLink
                  v-if="ticket.horarioFecha"
                  :to="{ name: 'tickets-mismo-horario', query: { fecha: ticket.horarioFecha, horaInicio: ticket.horarioHoraInicio, horaFin: ticket.horarioHoraFin } }"
                  class="inline-block mt-2 text-xs text-brand-600 font-medium hover:underline"
                >
                  Ver otras solicitudes en este horario →
                </RouterLink>
              </div>
            </div>

            <div class="space-y-5">
              <div>
                <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-2">Asesores notificados</h3>
                <p v-if="ticket.docentesNotificados.length === 0" class="text-sm text-muted">Nadie fue notificado (sin cobertura elegible).</p>
                <div v-else class="flex flex-wrap gap-2">
                  <span v-for="d in ticket.docentesNotificados" :key="d.id" class="pl-1 pr-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 flex items-center gap-1.5">
                    <Avatar :nombre="d.nombre" :fotoUrl="d.fotoUrl" size="w-5 h-5" />
                    {{ d.nombre }}
                  </span>
                </div>
              </div>

              <div>
                <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Línea de tiempo</h3>
                <div class="space-y-3">
                  <div class="flex gap-3">
                    <FontAwesomeIcon :icon="faCircleCheck" class="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
                    <div>
                      <p class="text-sm font-medium text-heading">Creado</p>
                      <p class="text-xs text-muted">{{ formatFechaHora(ticket.creadoEn) }}</p>
                    </div>
                  </div>
                  <div v-if="ticket.docentesNotificados.length > 0" class="flex gap-3">
                    <FontAwesomeIcon :icon="faCircleCheck" class="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
                    <div>
                      <p class="text-sm font-medium text-heading">Notificado a asesores</p>
                      <p class="text-xs text-muted">Se notificó a {{ ticket.docentesNotificados.length }} asesor{{ ticket.docentesNotificados.length === 1 ? '' : 'es' }} disponible{{ ticket.docentesNotificados.length === 1 ? '' : 's' }}.</p>
                    </div>
                  </div>
                  <div class="flex gap-3">
                    <FontAwesomeIcon :icon="ticket.estado === 'pendiente' ? faCircle : faCircleCheck" class="w-4 h-4 mt-0.5 shrink-0" :class="ticket.estado === 'pendiente' ? 'text-gray-300' : 'text-brand-600'" />
                    <div>
                      <p class="text-sm font-medium text-heading">{{ ESTADO_ASESORIA_LABEL[ticket.estado] }}</p>
                      <p class="text-xs text-muted">
                        <template v-if="ticket.estado === 'pendiente'">El ticket está pendiente de aceptación por parte de algún asesor.</template>
                        <template v-else-if="ticket.estado === 'asignado' || ticket.estado === 'agendado'">Asignado a {{ ticket.docenteNombre }} · {{ formatFechaHora(ticket.actualizadoEn ?? ticket.creadoEn) }}</template>
                        <template v-else>{{ formatFechaHora(ticket.actualizadoEn ?? ticket.creadoEn) }}</template>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="ticket && puedeIntervenir" class="px-6 pb-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              @click="showCancelar = true"
              type="button"
              class="px-4 py-2.5 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-75 flex items-center gap-2"
            >
              <FontAwesomeIcon :icon="faTrash" class="w-3.5 h-3.5" />
              Cancelar ticket
            </button>
            <button
              @click="showIntervencion = true"
              type="button"
              class="px-4 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors duration-75 flex items-center gap-2"
            >
              <FontAwesomeIcon :icon="faUserGear" class="w-3.5 h-3.5" />
              Intervenir manualmente
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>

  <IntervencionManualModal :is-open="showIntervencion" :ticket="ticket ?? null" @close="showIntervencion = false; emit('close')" />
  <CancelarTicketModal :is-open="showCancelar" :ticket-id="ticketId ?? ''" @close="showCancelar = false" @confirm="confirmarCancelar" />
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
