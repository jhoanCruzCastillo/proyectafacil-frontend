<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faXmark, faStar, faComments, faVideo,
} from '@/lib/icons';
import Avatar from '@/components/Avatar.vue';
import HistorialChatMensajes from '@/features/asesoria/HistorialChatMensajes.vue';
import DetalleSesionAsesoria from '@/features/asesoria/DetalleSesionAsesoria.vue';
import { colorCategoria, formatFechaHoraVideo } from '@/lib/consultaAsesorUI';
import { formatHora } from '@/lib/tiempoRelativo';
import { useMensajesQuery } from '@/composables/useAsesoria';
import { useHistorialConexionQuery, useGrabacionesQuery } from '@/composables/useTicketsAsesoria';
import type { SolicitudAsesoria } from '@/types';

// Resumen de solo lectura de una consulta. Tres variantes:
// - Chat ya completado: "Historial de asesoría" — la conversación real (solo lectura, sin poder
//   escribir) más el panel de detalles a la derecha. Pedido explícito del usuario, sin "Duración
//   total" porque el sistema no trackea esa información hoy.
// - Video ya atendida (completado u observado): mismo diseño que ve el Administrativo en "Ver
//   detalle" (TicketDetalleCompletadoModal) — video, resumen de IA, historial de conexión — vía el
//   componente compartido DetalleSesionAsesoria. Pedido explícito del usuario: el asesor debe ver
//   la misma interfaz, no una versión reducida.
// - Cualquier otro caso (pendiente, o video todavía no terminada): el resumen chico de siempre.
const props = defineProps<{ isOpen: boolean; solicitud: SolicitudAsesoria | null; usuarioActualId: string; clienteCorreo?: string | null }>();
const emit = defineEmits<{ close: [] }>();

const esHistorialChat = computed(() => !!props.solicitud && props.solicitud.estado === 'completado' && props.solicitud.tipo === 'chat');
const esVideoAtendida = computed(() => !!props.solicitud && props.solicitud.tipo === 'video' && (props.solicitud.estado === 'completado' || props.solicitud.estado === 'observado'));

const solicitudIdParaMensajes = computed(() => (props.isOpen && esHistorialChat.value ? props.solicitud!.id : null));
const { data: mensajes } = useMensajesQuery(solicitudIdParaMensajes, () => props.usuarioActualId);

const solicitudIdParaConexion = computed(() => (props.isOpen && esVideoAtendida.value ? props.solicitud!.id : null));
const { data: historialConexionData } = useHistorialConexionQuery(solicitudIdParaConexion);
const historialConexion = computed(() => historialConexionData.value?.participantes ?? []);
const tiempoCoincidenteSegundos = computed(() => historialConexionData.value?.tiempoCoincidenteSegundos ?? 0);

const { data: grabaciones } = useGrabacionesQuery(solicitudIdParaConexion);

// Chat no tiene horarioFecha/horarioHoraInicio (eso es solo de videollamada agendada) — el rango
// mostrado sale de cuándo se creó la solicitud (primer mensaje) hasta que se finalizó.
function formatFechaHoraChat(s: SolicitudAsesoria): string {
  const fecha = new Date(s.creadoEn).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  const desde = new Date(s.creadoEn).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
  const hasta = s.actualizadoEn ? new Date(s.actualizadoEn).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' }) : null;
  return hasta ? `${fecha} · ${desde} - ${hasta}` : fecha;
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen && solicitud" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <!-- Historial de asesoría (chat completado) -->
      <div v-if="esHistorialChat" class="bg-white rounded-2xl shadow-modal w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden" @click.stop>
        <div class="flex items-start justify-between gap-3 p-5 bg-gradient-to-r from-sidebar to-brand-800">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-white text-brand-600 flex items-center justify-center shrink-0">
              <FontAwesomeIcon :icon="faComments" class="w-4 h-4" />
            </div>
            <div>
              <h2 class="text-lg font-bold text-white leading-tight">Historial de asesoría</h2>
              <p class="text-sm text-white/60 mt-0.5">Revisa la conversación y los detalles de esta asesoría.</p>
            </div>
          </div>
          <button @click="emit('close')" type="button" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors duration-100 shrink-0">
            <FontAwesomeIcon :icon="faXmark" />
          </button>
        </div>

        <div class="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 flex-wrap">
          <div class="flex items-center gap-3 min-w-0">
            <Avatar :nombre="solicitud.clienteNombre ?? '?'" :fotoUrl="solicitud.clienteFotoUrl" size="w-10 h-10" />
            <div class="min-w-0">
              <p class="font-semibold text-heading text-sm truncate">{{ solicitud.clienteNombre }}</p>
              <p v-if="clienteCorreo" class="text-xs text-muted truncate">{{ clienteCorreo }}</p>
            </div>
          </div>
          <div class="flex items-center gap-6 text-xs shrink-0">
            <div>
              <p class="text-muted font-medium mb-0.5">Categoría</p>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-medium" :class="colorCategoria(solicitud.sectorNombre)">{{ solicitud.sectorNombre ?? '—' }}</span>
            </div>
            <div>
              <p class="text-muted font-medium mb-0.5">Modalidad</p>
              <span class="flex items-center gap-1.5 text-heading font-medium"><FontAwesomeIcon :icon="faComments" class="w-3 h-3" /> Chat</span>
            </div>
            <div>
              <p class="text-muted font-medium mb-0.5">Fecha</p>
              <span class="text-heading font-medium">{{ new Date(solicitud.creadoEn).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) }}</span>
            </div>
          </div>
        </div>

        <div class="flex-1 min-h-0 flex overflow-hidden">
          <div class="flex-1 min-w-0 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
            <HistorialChatMensajes :mensajes="mensajes ?? []" :usuario-actual-id="usuarioActualId" />
            <p class="flex justify-center pt-1">
              <span class="text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full px-3 py-1">
                Asesoría finalizada por el asesor · {{ solicitud.actualizadoEn ? formatHora(solicitud.actualizadoEn) : '' }}
              </span>
            </p>
          </div>

          <div class="w-64 shrink-0 border-l border-gray-100 overflow-y-auto p-5 space-y-4">
            <h3 class="text-sm font-bold text-heading">Detalles de la asesoría</h3>

            <div>
              <p class="text-[11px] font-medium text-muted mb-1">Estado</p>
              <span class="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">Completado</span>
            </div>
            <div>
              <p class="text-[11px] font-medium text-muted mb-1">Fecha y hora</p>
              <p class="text-sm text-heading">{{ formatFechaHoraChat(solicitud) }}</p>
            </div>
            <div>
              <p class="text-[11px] font-medium text-muted mb-1">Solicitado por</p>
              <div class="flex items-center gap-2">
                <Avatar :nombre="solicitud.clienteNombre ?? '?'" :fotoUrl="solicitud.clienteFotoUrl" size="w-6 h-6" />
                <div class="min-w-0">
                  <p class="text-sm text-heading truncate">{{ solicitud.clienteNombre }}</p>
                  <p v-if="clienteCorreo" class="text-[11px] text-muted truncate">{{ clienteCorreo }}</p>
                </div>
              </div>
            </div>
            <div>
              <p class="text-[11px] font-medium text-muted mb-1">Categoría</p>
              <span class="px-2.5 py-1 rounded-full text-[11px] font-medium" :class="colorCategoria(solicitud.sectorNombre)">{{ solicitud.sectorNombre ?? '—' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Detalle de videollamada atendida (completado u observado) — mismo diseño que ve el
           Administrativo en "Ver detalle", vía DetalleSesionAsesoria. -->
      <div v-else-if="esVideoAtendida" class="bg-white rounded-2xl shadow-modal w-full max-w-3xl max-h-[88vh] overflow-y-auto" @click.stop>
        <div class="p-5 bg-gradient-to-r from-sidebar to-brand-800 flex items-center justify-between sticky top-0 z-10">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-white/15 text-white flex items-center justify-center shrink-0">
              <FontAwesomeIcon :icon="faVideo" class="w-4 h-4" />
            </div>
            <h2 class="text-lg font-bold text-white">Detalle de la videollamada</h2>
          </div>
          <button @click="emit('close')" type="button" class="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors duration-100">
            <FontAwesomeIcon :icon="faXmark" />
          </button>
        </div>
        <div class="p-5">
          <DetalleSesionAsesoria
            :solicitud="solicitud"
            :cliente-correo="clienteCorreo"
            :historial-conexion="historialConexion"
            :tiempo-coincidente-segundos="tiempoCoincidenteSegundos"
            :grabaciones="grabaciones ?? []"
          />
        </div>
      </div>

      <!-- Resumen chico (pendiente sin aceptar, o video agendada todavía sin terminar) -->
      <div v-else class="bg-white rounded-2xl shadow-modal w-full max-w-sm p-6 relative" @click.stop>
        <button
          @click="emit('close')"
          type="button"
          class="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100"
        >
          <FontAwesomeIcon :icon="faXmark" />
        </button>

        <div class="flex items-center gap-3 mb-4">
          <Avatar :nombre="solicitud.clienteNombre ?? '?'" :fotoUrl="solicitud.clienteFotoUrl" size="w-11 h-11" />
          <div class="min-w-0">
            <p class="font-semibold text-heading text-sm truncate">{{ solicitud.clienteNombre }}</p>
            <span class="px-2 py-0.5 rounded-full text-[11px] font-medium" :class="colorCategoria(solicitud.sectorNombre)">{{ solicitud.sectorNombre ?? '—' }}</span>
          </div>
        </div>

        <p v-if="solicitud.tipo === 'video' && solicitud.horarioFecha" class="text-xs text-muted flex items-center gap-1.5 mb-3">
          <FontAwesomeIcon :icon="faVideo" class="w-3 h-3" />
          {{ formatFechaHoraVideo(solicitud) }}
        </p>

        <p v-if="solicitud.mensajeInicial" class="text-sm text-heading bg-gray-50 rounded-lg p-3 leading-relaxed mb-4">
          "{{ solicitud.mensajeInicial }}"
        </p>

        <template v-if="solicitud.estado === 'completado'">
          <div v-if="solicitud.calificacion" class="border-t border-gray-100 pt-4">
            <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-2">Calificación del alumno</p>
            <div class="flex items-center gap-1">
              <FontAwesomeIcon v-for="n in 5" :key="n" :icon="faStar" class="w-4 h-4" :class="n <= solicitud.calificacion ? 'text-amber-400' : 'text-gray-200'" />
            </div>
            <p v-if="solicitud.calificacionComentario" class="text-sm text-muted mt-2 italic">"{{ solicitud.calificacionComentario }}"</p>
          </div>
          <p v-else class="text-xs text-muted border-t border-gray-100 pt-4">El alumno todavía no calificó esta consulta.</p>
        </template>
      </div>
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
</style>
