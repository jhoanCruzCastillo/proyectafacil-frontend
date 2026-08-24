<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faVideo, faComments, faCheck, faUserGear, faTrash, faEnvelope, faListCheck, faWandMagicSparkles } from '@/lib/icons';
import IntervencionManualModal from './IntervencionManualModal.vue';
import CancelarTicketModal from './CancelarTicketModal.vue';
import Avatar from '@/components/Avatar.vue';
import { useTicketDetalleQuery, useCancelarTicketAdmin, useHistorialConexionQuery } from '@/composables/useTicketsAsesoria';
import { useUiStore } from '@/stores/ui';
import { ESTADO_ASESORIA_LABEL, ESTADO_ASESORIA_CLASE } from '@/lib/estadoAsesoria';
import { codigoTicketFalso, nivelFalso, estadoNotificacionFalso } from '@/lib/ticketsDemoFake';

const props = defineProps<{ isOpen: boolean; ticketId: string | null }>();
const emit = defineEmits<{ close: [] }>();

const ui = useUiStore();
const { data: ticket, isLoading } = useTicketDetalleQuery(() => (props.isOpen ? props.ticketId : null));
const cancelarTicket = useCancelarTicketAdmin();

const showIntervencion = ref(false);
const showCancelar = ref(false);

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
}

interface PasoTimeline {
  titulo: string;
  detalle: string;
  completado: boolean;
}

const pasosTimeline = computed<PasoTimeline[]>(() => {
  if (!ticket.value) return [];
  const t = ticket.value;
  const pasos: PasoTimeline[] = [
    { titulo: 'Creado', detalle: formatFechaHora(t.creadoEn), completado: true },
  ];

  if (t.docentesNotificados.length > 0) {
    pasos.push({
      titulo: 'Notificado a asesores',
      detalle: `Se notificó a ${t.docentesNotificados.length} asesor${t.docentesNotificados.length === 1 ? '' : 'es'} disponible${t.docentesNotificados.length === 1 ? '' : 's'}.`,
      completado: true,
    });
  }

  if (t.estado === 'pendiente') {
    pasos.push({ titulo: 'Esperando aceptación…', detalle: 'El ticket está pendiente de aceptación por parte de algún asesor.', completado: false });
  } else if (t.estado === 'asignado' || t.estado === 'agendado') {
    pasos.push({ titulo: ESTADO_ASESORIA_LABEL[t.estado], detalle: `Asignado a ${t.docenteNombre} · ${formatFechaHora(t.actualizadoEn ?? t.creadoEn)}`, completado: true });
  } else {
    pasos.push({ titulo: ESTADO_ASESORIA_LABEL[t.estado], detalle: formatFechaHora(t.actualizadoEn ?? t.creadoEn), completado: true });
  }

  return pasos;
});

// Una vez que el ticket ya llegó a un desenlace final, intervenir o cancelar ya no tiene efecto —
// la asesoría (o su cancelación) ya ocurrió.
const ESTADOS_TERMINALES = new Set(['completado', 'cancelado', 'observado', 'vencido']);
const puedeIntervenir = computed(() => !!ticket.value && !ESTADOS_TERMINALES.has(ticket.value.estado));

const mostrarHistorialConexion = computed(() => ticket.value?.estado === 'completado' && ticket.value?.tipo === 'video');
const { data: historialConexionData } = useHistorialConexionQuery(() => (mostrarHistorialConexion.value ? props.ticketId : null));
const historialConexion = computed(() => historialConexionData.value?.participantes ?? []);
const tiempoCoincidenteSegundos = computed(() => historialConexionData.value?.tiempoCoincidenteSegundos ?? 0);

function formatHoraConexion(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' }) : '—';
}

function duracionSesion(entrada: string | null, salida: string | null): string {
  if (!entrada || !salida) return '—';
  const minutos = Math.round((new Date(salida).getTime() - new Date(entrada).getTime()) / 60_000);
  return `${minutos} min`;
}

function formatDuracionTotal(segundos: number): string {
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
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
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-3xl max-h-[85vh] overflow-y-auto" @click.stop>
          <div class="p-6 pb-4 flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faListCheck" class="w-4 h-4" />
              </div>
              <h2 class="text-lg font-bold text-heading">{{ ticketId ? codigoTicketFalso(ticketId) : '' }}</h2>
              <span v-if="ticket" class="px-2.5 py-1 rounded-full text-[11px] font-medium" :class="ESTADO_ASESORIA_CLASE[ticket.estado]">
                {{ ESTADO_ASESORIA_LABEL[ticket.estado] }}
              </span>
            </div>
            <button @click="emit('close')" type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <p v-if="isLoading" class="px-6 pb-6 text-sm text-muted">Cargando…</p>
          <div v-else-if="ticket" class="px-6 pb-6">
          <div class="rounded-xl border border-gray-200 overflow-hidden">
          <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
            <div class="p-5 space-y-5">
              <div>
                <h3 class="text-sm font-bold text-heading mb-2">Datos del alumno</h3>
                <div class="flex items-center gap-3">
                  <Avatar :nombre="ticket.clienteNombre ?? '?'" :fotoUrl="ticket.clienteFotoUrl" size="w-16 h-16" />
                  <div>
                    <p class="font-bold text-heading">{{ ticket.clienteNombre }}</p>
                    <span class="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700">{{ nivelFalso(ticket.id) }}</span>
                    <p v-if="ticket.clienteCorreo" class="text-xs text-muted mt-1.5 flex items-center gap-1.5">
                      <FontAwesomeIcon :icon="faEnvelope" class="w-2.5 h-2.5" />
                      {{ ticket.clienteCorreo }}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-sm font-bold text-heading mb-2">Categoría de la consulta</h3>
                <span class="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700">{{ ticket.sectorNombre ?? '—' }}</span>
              </div>

              <div v-if="ticket.mensajeInicial">
                <div class="flex items-start gap-2.5 p-3 rounded-lg bg-purple-50 border border-purple-200">
                  <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-500 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p class="text-xs font-semibold text-purple-700 mb-1">Resumen generado por IA</p>
                    <p class="text-sm text-heading leading-relaxed">{{ ticket.mensajeInicial }}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-sm font-bold text-heading mb-2">Modalidad{{ ticket.horarioFecha ? ' y horario elegido' : '' }}</h3>
                <div class="flex items-center gap-3 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                  <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon :icon="ticket.tipo === 'video' ? faVideo : faComments" class="w-4 h-4" />
                  </div>
                  <div class="text-sm">
                    <p class="font-medium text-heading">{{ ticket.tipo === 'video' ? 'Videollamada' : 'Chat' }}</p>
                    <p v-if="ticket.horarioFecha" class="text-xs text-muted">
                      {{ new Date(`${ticket.horarioFecha}T00:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }) }},
                      {{ ticket.horarioHoraInicio }} - {{ ticket.horarioHoraFin }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div class="p-5 space-y-5">
              <div>
                <h3 class="text-sm font-bold text-heading mb-2">Docentes notificados</h3>
                <p v-if="ticket.docentesNotificados.length === 0" class="text-sm text-muted">Nadie fue notificado (sin cobertura elegible).</p>
                <div v-else class="grid grid-cols-2 gap-2">
                  <div v-for="d in ticket.docentesNotificados" :key="d.id" class="flex flex-col items-center text-center gap-1 p-2 rounded-lg border border-gray-200">
                    <Avatar :nombre="d.nombre" :fotoUrl="d.fotoUrl" size="w-10 h-10" />
                    <p class="text-xs font-medium text-heading truncate w-full">{{ d.nombre }}</p>
                    <p class="text-[11px] flex items-center gap-1" :class="estadoNotificacionFalso(d.id).textoClase">
                      <span class="w-1.5 h-1.5 rounded-full" :class="estadoNotificacionFalso(d.id).dotClase" />
                      {{ estadoNotificacionFalso(d.id).texto }}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-sm font-bold text-heading mb-3">Línea de tiempo</h3>
                <div class="relative">
                  <div class="absolute left-3 top-2 bottom-2 w-px bg-gray-200" />
                  <div class="space-y-4">
                    <div v-for="(paso, i) in pasosTimeline" :key="i" class="flex gap-3 relative">
                      <div
                        class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 relative"
                        :class="paso.completado ? 'bg-emerald-500 text-white' : 'bg-white border-2 border-blue-400'"
                      >
                        <FontAwesomeIcon v-if="paso.completado" :icon="faCheck" class="w-3 h-3" />
                        <template v-else>
                          <span class="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
                          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                        </template>
                      </div>
                      <div>
                        <p class="text-sm font-semibold" :class="paso.completado ? 'text-heading' : 'text-blue-600'">{{ paso.titulo }}</p>
                        <p class="text-xs text-muted mt-0.5">{{ paso.detalle }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="historialConexion.length > 0" class="border-t border-gray-200 p-5">
            <div class="flex items-center gap-2.5 mb-3 flex-wrap">
              <h3 class="text-sm font-bold text-heading">Historial de conexión en la videollamada (Google Meet)</h3>
              <span class="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700">
                Tiempo coincidente: {{ formatDuracionTotal(tiempoCoincidenteSegundos) }}
              </span>
            </div>
            <div class="rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="text-left text-[11px] font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
                    <th class="py-2.5 px-4">Participante</th>
                    <th class="py-2.5 px-4">Entrada</th>
                    <th class="py-2.5 px-4">Salida</th>
                    <th class="py-2.5 px-4">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="participante in historialConexion" :key="participante.nombre">
                    <tr v-for="(sesion, i) in participante.sesiones" :key="i" class="border-b border-gray-100 last:border-b-0">
                      <td v-if="i === 0" :rowspan="participante.sesiones.length" class="py-3 px-4 align-top border-r border-gray-100">
                        <div class="flex items-center gap-2.5">
                          <Avatar :nombre="participante.nombre" :fotoUrl="participante.fotoUrl" size="w-9 h-9" />
                          <div>
                            <p class="font-medium text-heading text-sm">{{ participante.nombre }}</p>
                            <p v-if="participante.correo" class="text-[11px] text-muted">{{ participante.correo }}</p>
                            <p v-if="participante.rol" class="text-[11px] font-medium" :class="participante.rol === 'Alumno' ? 'text-emerald-600' : 'text-blue-600'">{{ participante.rol }}</p>
                          </div>
                        </div>
                      </td>
                      <td class="py-3 px-4 text-heading whitespace-nowrap">{{ formatHoraConexion(sesion.entrada) }}</td>
                      <td class="py-3 px-4 text-heading whitespace-nowrap">{{ formatHoraConexion(sesion.salida) }}</td>
                      <td class="py-3 px-4 text-muted whitespace-nowrap">{{ duracionSesion(sesion.entrada, sesion.salida) }}</td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="puedeIntervenir" class="flex justify-end gap-3 border-t border-gray-200 p-4 bg-gray-50">
            <button
              @click="showIntervencion = true"
              type="button"
              class="px-4 py-2.5 rounded-lg border border-amber-300 text-sm font-medium text-amber-700 hover:bg-amber-50 transition-colors duration-75 flex items-center gap-2"
            >
              <FontAwesomeIcon :icon="faUserGear" class="w-3.5 h-3.5" />
              Intervenir manualmente
            </button>
            <button
              @click="showCancelar = true"
              type="button"
              class="px-4 py-2.5 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-75 flex items-center gap-2"
            >
              <FontAwesomeIcon :icon="faTrash" class="w-3.5 h-3.5" />
              Cancelar ticket
            </button>
          </div>
          </div>
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
