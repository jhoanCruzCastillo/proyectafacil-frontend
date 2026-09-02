<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faListCheck } from '@/lib/icons';
import DetalleSesionAsesoria from '@/features/asesoria/DetalleSesionAsesoria.vue';
import { useTicketDetalleQuery, useHistorialConexionQuery, useGrabacionesQuery } from '@/composables/useTicketsAsesoria';
import { useMensajesQuery } from '@/composables/useAsesoria';
import { ESTADO_ASESORIA_LABEL } from '@/lib/estadoAsesoria';
import { codigoTicketFalso } from '@/lib/ticketsDemoFake';

// Modal de detalle para tickets completados u observados (ambos ya tuvieron una sesión real) —
// diseño aparte del genérico (TicketDetalleModal) porque acá sí hay contenido real de la sesión
// que mostrar (video, resumen de IA, historial de conexión), y ese contenido no aplica a ningún
// otro estado. El cuerpo (ficha + video/resumen + historial de conexión + línea de tiempo) vive en
// DetalleSesionAsesoria — compartido con ResumenConsultaModal.vue del lado del asesor, para que
// vea exactamente la misma interfaz en sus propias consultas atendidas (pedido explícito del
// usuario). Acá solo queda el encabezado/modal propios del Administrativo y la carga de datos.
const props = defineProps<{ isOpen: boolean; ticketId: string | null }>();
const emit = defineEmits<{ close: [] }>();

const { data: ticket, isLoading } = useTicketDetalleQuery(() => (props.isOpen ? props.ticketId : null));

const esVideo = computed(() => ticket.value?.tipo === 'video');
const esChat = computed(() => ticket.value?.tipo === 'chat');

// Igual maquetado que "Historial de asesoría" del docente (ResumenConsultaModal.vue), vía
// HistorialChatMensajes — acá el administrativo es un tercero ajeno a la conversación, así que se
// usa el docenteId de la propia solicitud como referencia de "lado derecho" (misma convención que
// ya ve el docente: sus mensajes a la derecha, los del alumno a la izquierda). visorId vacío a
// propósito — un '' no manda el query param (ver asesoria.http.ts) y evita marcar mensajes ajenos
// como leídos solo por haberlos mirado el administrativo.
const { data: mensajesChat } = useMensajesQuery(() => (esChat.value ? props.ticketId : null), () => '');

const { data: historialConexionData } = useHistorialConexionQuery(() => (esVideo.value ? props.ticketId : null));
const historialConexion = computed(() => historialConexionData.value?.participantes ?? []);
const tiempoCoincidenteSegundos = computed(() => historialConexionData.value?.tiempoCoincidenteSegundos ?? 0);

const { data: grabaciones } = useGrabacionesQuery(() => (esVideo.value ? props.ticketId : null));
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
          <div v-else-if="ticket" class="p-5">
            <DetalleSesionAsesoria
              :solicitud="ticket"
              :cliente-correo="ticket.clienteCorreo"
              :docentes-notificados="ticket.docentesNotificados"
              :historial-conexion="historialConexion"
              :tiempo-coincidente-segundos="tiempoCoincidenteSegundos"
              :mensajes-chat="mensajesChat ?? []"
              :usuario-actual-id="ticket.docenteId ?? ''"
              :grabaciones="grabaciones ?? []"
            />
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
