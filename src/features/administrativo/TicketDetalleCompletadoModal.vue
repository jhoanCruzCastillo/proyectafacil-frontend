<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faVideo, faComments, faCheck, faUserGear, faEnvelope, faListCheck, faWandMagicSparkles, faCopy, faDisplay, faCalendarDays, faHourglassHalf } from '@/lib/icons';
import Avatar from '@/components/Avatar.vue';
import { useTicketDetalleQuery, useHistorialConexionQuery } from '@/composables/useTicketsAsesoria';
import { useUiStore } from '@/stores/ui';
import { ESTADO_ASESORIA_CLASE, ESTADO_ASESORIA_LABEL } from '@/lib/estadoAsesoria';
import { codigoTicketFalso } from '@/lib/ticketsDemoFake';

// Modal de detalle SOLO para tickets ya completados — diseño aparte del genérico
// (TicketDetalleModal) porque acá sí hay contenido real de la sesión que mostrar (video, resumen
// de IA, historial de conexión), y ese contenido no aplica a ningún otro estado.
const props = defineProps<{ isOpen: boolean; ticketId: string | null }>();
const emit = defineEmits<{ close: [] }>();

const ui = useUiStore();
const { data: ticket, isLoading } = useTicketDetalleQuery(() => (props.isOpen ? props.ticketId : null));

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const esVideo = computed(() => ticket.value?.tipo === 'video');

const mostrarHistorialConexion = computed(() => esVideo.value);
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

// Formato "45 minutos 12 segundos" — usado tanto en el encabezado (Duración total) como en el
// historial de conexión, para no mezclar dos precisiones distintas del mismo dato.
function formatDuracion(segundosTotales: number): string {
  const minutos = Math.floor(segundosTotales / 60);
  const segundos = Math.round(segundosTotales % 60);
  if (minutos === 0) return `${segundos} segundo${segundos === 1 ? '' : 's'}`;
  return `${minutos} minuto${minutos === 1 ? '' : 's'} ${segundos} segundo${segundos === 1 ? '' : 's'}`;
}

// El link guardado es el de reproducción (.../file/d/{id}/view) — para embeberlo hace falta la
// variante /preview, que sí funciona dentro de un iframe.
const videoEmbedUrl = computed(() => {
  const link = ticket.value?.linkGrabacion;
  const id = link?.match(/\/file\/d\/([^/]+)/)?.[1];
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
});

function copiarEnlaceReunion() {
  if (!ticket.value?.linkReunion) return;
  navigator.clipboard?.writeText(ticket.value.linkReunion);
  ui.toast('Enlace copiado');
}

interface PasoTimeline {
  titulo: string;
  detalle: string;
}

// Línea de tiempo horizontal — solo con pasos que tienen un dato real detrás (nunca se inventa un
// paso/hora que no ocurrió). "En curso" solo aplica a videollamada (es la única modalidad con una
// fase agendada distinta de la creación). El horario de "Asignado"/"En curso" es una aproximación
// (actualizadoEn, el último cambio conocido) — mismo criterio ya usado en TicketDetalleModal, no
// hay una columna dedicada por transición de estado.
const pasosTimeline = computed<PasoTimeline[]>(() => {
  if (!ticket.value) return [];
  const t = ticket.value;
  const pasos: PasoTimeline[] = [{ titulo: 'Creado', detalle: formatFechaHora(t.creadoEn) }];

  if (t.docentesNotificados.length > 0) {
    pasos.push({ titulo: 'Notificado a asesores', detalle: `Se notificó a ${t.docentesNotificados.length} asesor${t.docentesNotificados.length === 1 ? '' : 'es'}` });
  }
  if (t.docenteId && t.docenteNombre) {
    pasos.push({ titulo: 'Asignado', detalle: t.docenteNombre });
  }
  if (esVideo.value && t.horarioFecha) {
    pasos.push({ titulo: 'En curso', detalle: `${t.horarioHoraInicio} - ${t.horarioHoraFin}` });
  }
  pasos.push({ titulo: 'Completado', detalle: formatFechaHora(t.completadoEn ?? t.actualizadoEn ?? t.creadoEn) });

  return pasos;
});
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-3xl max-h-[85vh] overflow-y-auto" @click.stop>
          <div class="p-5 bg-gradient-to-r from-sidebar to-brand-800 flex items-center justify-between sticky top-0 z-10">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-white/15 text-white flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faListCheck" class="w-4 h-4" />
              </div>
              <h2 class="text-lg font-bold text-white">{{ ticketId ? codigoTicketFalso(ticketId) : '' }}</h2>
              <span v-if="ticket" class="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-400/20 text-emerald-50">
                {{ ESTADO_ASESORIA_LABEL[ticket.estado] }}
              </span>
            </div>
            <button @click="emit('close')" type="button" class="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors duration-100">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <p v-if="isLoading" class="p-6 text-sm text-muted">Cargando…</p>
          <div v-else-if="ticket" class="p-5 space-y-5">
            <div class="rounded-xl border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p class="text-[11px] font-semibold text-muted mb-1.5">Alumno</p>
                <div class="flex items-center gap-2.5">
                  <Avatar :nombre="ticket.clienteNombre ?? '?'" :fotoUrl="ticket.clienteFotoUrl" size="w-9 h-9" />
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-heading truncate">{{ ticket.clienteNombre }}</p>
                    <p v-if="ticket.clienteCorreo" class="text-[11px] text-muted truncate flex items-center gap-1">
                      <FontAwesomeIcon :icon="faEnvelope" class="w-2.5 h-2.5" />
                      {{ ticket.clienteCorreo }}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p class="text-[11px] font-semibold text-muted mb-1.5">Categoría</p>
                <span class="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700">{{ ticket.sectorNombre ?? '—' }}</span>
              </div>

              <div>
                <p class="text-[11px] font-semibold text-muted mb-1.5">Asesor asignado</p>
                <div v-if="ticket.docenteNombre" class="flex items-center gap-2.5">
                  <Avatar :nombre="ticket.docenteNombre" :fotoUrl="ticket.docenteFotoUrl" size="w-9 h-9" />
                  <p class="text-sm font-semibold text-heading truncate">{{ ticket.docenteNombre }}</p>
                </div>
                <p v-else class="text-sm text-muted">Sin asignar</p>
              </div>

              <div>
                <p class="text-[11px] font-semibold text-muted mb-1.5">Modalidad</p>
                <div class="flex items-center gap-2 text-sm text-heading">
                  <FontAwesomeIcon :icon="esVideo ? faVideo : faComments" class="w-3.5 h-3.5 text-indigo-500" />
                  {{ esVideo ? 'Videollamada' : 'Chat' }}
                </div>
              </div>

              <div>
                <p class="text-[11px] font-semibold text-muted mb-1.5">Estado</p>
                <span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-medium" :class="ESTADO_ASESORIA_CLASE[ticket.estado]">{{ ESTADO_ASESORIA_LABEL[ticket.estado] }}</span>
                <p class="text-[11px] text-muted mt-1">Completado el {{ formatFechaHora(ticket.completadoEn ?? ticket.actualizadoEn ?? ticket.creadoEn) }}</p>
              </div>

              <div v-if="esVideo && ticket.horarioFecha">
                <p class="text-[11px] font-semibold text-muted mb-1.5">Fecha y hora</p>
                <p class="text-sm text-heading flex items-center gap-1.5">
                  <FontAwesomeIcon :icon="faCalendarDays" class="w-3 h-3 text-gray-400" />
                  {{ new Date(`${ticket.horarioFecha}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) }}
                  · {{ ticket.horarioHoraInicio }} - {{ ticket.horarioHoraFin }}
                </p>
                <p v-if="mostrarHistorialConexion && tiempoCoincidenteSegundos > 0" class="text-[11px] text-muted mt-1 flex items-center gap-1.5">
                  <FontAwesomeIcon :icon="faHourglassHalf" class="w-2.5 h-2.5" />
                  Duración total: {{ formatDuracion(tiempoCoincidenteSegundos) }}
                </p>
              </div>
            </div>

            <div v-if="esVideo" class="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
              <div class="space-y-4">
                <div>
                  <h3 class="text-sm font-bold text-heading mb-1">Video de la sesión</h3>
                  <p class="text-xs text-muted mb-2">Reproduce la grabación de la videollamada realizada.</p>
                  <div class="rounded-xl overflow-hidden border border-gray-200 bg-gray-900 h-80">
                    <iframe v-if="videoEmbedUrl" :src="videoEmbedUrl" class="w-full h-full block border-0" allow="autoplay" allowfullscreen />
                    <div v-else class="w-full h-full flex items-center justify-center text-center px-4">
                      <p class="text-xs text-gray-400">La grabación todavía no está disponible — Google puede tardar en procesarla después de la llamada.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 class="text-sm font-bold text-heading mb-2">Detalles técnicos de la sesión</h3>
                  <div class="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
                    <div class="p-3 flex items-center gap-2.5">
                      <FontAwesomeIcon :icon="faUserGear" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span class="text-muted shrink-0">Participantes</span>
                      <div class="flex items-center gap-1.5 ml-auto">
                        <Avatar :nombre="ticket.clienteNombre ?? '?'" :fotoUrl="ticket.clienteFotoUrl" size="w-6 h-6" />
                        <Avatar v-if="ticket.docenteNombre" :nombre="ticket.docenteNombre" :fotoUrl="ticket.docenteFotoUrl" size="w-6 h-6" />
                      </div>
                    </div>
                    <div class="p-3 flex items-center gap-2.5">
                      <FontAwesomeIcon :icon="faDisplay" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span class="text-muted">Plataforma</span>
                      <span class="ml-auto font-medium text-heading">Google Meet</span>
                    </div>
                    <div v-if="ticket.linkReunion" class="p-3 flex items-center gap-2.5">
                      <FontAwesomeIcon :icon="faVideo" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span class="text-muted shrink-0">Enlace</span>
                      <a :href="ticket.linkReunion" target="_blank" rel="noopener" class="ml-auto text-brand-600 hover:underline truncate max-w-[160px]">{{ ticket.linkReunion.replace('https://', '') }}</a>
                      <button @click="copiarEnlaceReunion" type="button" class="text-gray-400 hover:text-gray-600 transition-colors duration-75 shrink-0">
                        <FontAwesomeIcon :icon="faCopy" class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex flex-col p-4 rounded-xl bg-purple-50 border border-purple-200">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-6 h-6 rounded-md bg-purple-100 text-purple-500 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3 h-3" />
                  </div>
                  <p class="text-xs font-semibold text-purple-700">Resumen generado por IA</p>
                </div>
                <p v-if="ticket.resumenIaTexto" class="text-sm text-heading leading-relaxed whitespace-pre-line">{{ ticket.resumenIaTexto }}</p>
                <p v-else class="text-sm text-muted italic my-auto text-center">El resumen todavía no está disponible — se genera automáticamente poco después de terminar la llamada.</p>
              </div>
            </div>

            <div v-if="historialConexion.length > 0">
              <h3 class="text-sm font-bold text-heading mb-2">Historial de conexión en la videollamada (Google Meet)</h3>
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

            <div>
              <h3 class="text-sm font-bold text-heading mb-4">Línea de tiempo del ticket</h3>
              <div class="relative flex justify-between">
                <div class="absolute left-0 right-0 top-3 h-px bg-gray-200" />
                <div v-for="(paso, i) in pasosTimeline" :key="i" class="relative flex flex-col items-center text-center flex-1 px-1">
                  <div class="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center z-10 mb-2">
                    <FontAwesomeIcon :icon="faCheck" class="w-3 h-3" />
                  </div>
                  <p class="text-xs font-semibold text-heading">{{ paso.titulo }}</p>
                  <p class="text-[11px] text-muted mt-0.5">{{ paso.detalle }}</p>
                </div>
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
