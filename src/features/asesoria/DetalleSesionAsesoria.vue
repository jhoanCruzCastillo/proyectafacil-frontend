<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faVideo, faComments, faCheck, faUserGear, faEnvelope, faCopy, faDisplay, faCalendarDays, faHourglassHalf } from '@/lib/icons';
import Avatar from '@/components/Avatar.vue';
import VideoSesionCard from './VideoSesionCard.vue';
import ResumenIaCard from './ResumenIaCard.vue';
import HistorialChatMensajes from './HistorialChatMensajes.vue';
import { useUiStore } from '@/stores/ui';
import { ESTADO_ASESORIA_CLASE, ESTADO_ASESORIA_LABEL } from '@/lib/estadoAsesoria';
import type { DocenteNotificado, GrabacionSesion, HistorialConexionParticipante, MensajeAsesoria, SolicitudAsesoria } from '@/types';

// Cuerpo de detalle de una sesión ya atendida (completado u observado) — extraído de
// TicketDetalleCompletadoModal.vue (Administrativo) para que el asesor vea exactamente la misma
// interfaz al revisar sus propias consultas atendidas (ResumenConsultaModal.vue), pedido explícito
// del usuario. Cada consumidor pone su propio encabezado/modal alrededor; esto es solo el cuerpo:
// ficha de datos, video + lista de grabaciones + resumen de IA (o historial de chat), historial de
// conexión y línea de tiempo. `docentesNotificados`/`mensajesChat`+`usuarioActualId`/`grabaciones`
// son opcionales — sin ellos, esos bloques simplemente no aparecen (el asesor viendo su propia
// consulta no necesita ver a quién más se notificó, por ejemplo).
const props = defineProps<{
  solicitud: SolicitudAsesoria;
  clienteCorreo?: string | null;
  docentesNotificados?: DocenteNotificado[];
  historialConexion?: HistorialConexionParticipante[];
  tiempoCoincidenteSegundos?: number;
  mensajesChat?: MensajeAsesoria[];
  usuarioActualId?: string;
  grabaciones?: GrabacionSesion[];
}>();

const ui = useUiStore();

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const esVideo = computed(() => props.solicitud.tipo === 'video');
const esChat = computed(() => props.solicitud.tipo === 'chat' && !!props.usuarioActualId);

const historialConexion = computed(() => props.historialConexion ?? []);
const tiempoCoincidenteSegundos = computed(() => props.tiempoCoincidenteSegundos ?? 0);

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

const grabaciones = computed(() => props.grabaciones ?? []);

function formatRangoGrabacion(g: GrabacionSesion): string {
  if (!g.inicio) return 'Procesando…';
  const inicio = new Date(g.inicio).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
  if (!g.fin) return `Desde las ${inicio}`;
  const fin = new Date(g.fin).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
  return `${inicio} - ${fin}`;
}

// 'Desconocido' = alguien entró con el link sin ser el alumno ni el asesor de este ticket (posible
// porque el acceso a la reunión es abierto) — ámbar para que se note distinto de los dos roles
// esperados, no rojo (no es necesariamente un problema, solo alguien no identificado).
const ROL_CLASE: Record<string, string> = {
  Alumno: 'text-emerald-600',
  Docente: 'text-blue-600',
  Desconocido: 'text-amber-600',
};

function copiarEnlaceReunion() {
  if (!props.solicitud.linkReunion) return;
  navigator.clipboard?.writeText(props.solicitud.linkReunion);
  ui.toast('Enlace copiado');
}

interface PasoTimeline {
  titulo: string;
  detalle: string;
}

// Línea de tiempo horizontal — solo con pasos que tienen un dato real detrás (nunca se inventa un
// paso/hora que no ocurrió). "En curso" solo aplica a videollamada (es la única modalidad con una
// fase agendada distinta de la creación).
const pasosTimeline = computed<PasoTimeline[]>(() => {
  const t = props.solicitud;
  const pasos: PasoTimeline[] = [{ titulo: 'Creado', detalle: formatFechaHora(t.creadoEn) }];

  if (props.docentesNotificados && props.docentesNotificados.length > 0) {
    pasos.push({ titulo: 'Notificado a asesores', detalle: `Se notificó a ${props.docentesNotificados.length} asesor${props.docentesNotificados.length === 1 ? '' : 'es'}` });
  }
  if (t.docenteId && t.docenteNombre) {
    pasos.push({ titulo: 'Asignado', detalle: t.docenteNombre });
  }
  if (esVideo.value && t.horarioFecha) {
    pasos.push({ titulo: 'En curso', detalle: `${t.horarioHoraInicio} - ${t.horarioHoraFin}` });
  }
  pasos.push({ titulo: ESTADO_ASESORIA_LABEL[t.estado], detalle: formatFechaHora(t.completadoEn ?? t.actualizadoEn ?? t.creadoEn) });

  return pasos;
});
</script>

<template>
  <div class="space-y-5">
    <div class="rounded-xl border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div>
        <p class="text-[11px] font-semibold text-muted mb-1.5">Alumno</p>
        <div class="flex items-center gap-2.5">
          <Avatar :nombre="solicitud.clienteNombre ?? '?'" :fotoUrl="solicitud.clienteFotoUrl" size="w-9 h-9" />
          <div class="min-w-0">
            <p class="text-sm font-semibold text-heading truncate">{{ solicitud.clienteNombre }}</p>
            <p v-if="clienteCorreo" class="text-[11px] text-muted truncate flex items-center gap-1">
              <FontAwesomeIcon :icon="faEnvelope" class="w-2.5 h-2.5" />
              {{ clienteCorreo }}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p class="text-[11px] font-semibold text-muted mb-1.5">Categoría</p>
        <span class="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700">{{ solicitud.sectorNombre ?? '—' }}</span>
      </div>

      <div>
        <p class="text-[11px] font-semibold text-muted mb-1.5">Asesor asignado</p>
        <div v-if="solicitud.docenteNombre" class="flex items-center gap-2.5">
          <Avatar :nombre="solicitud.docenteNombre" :fotoUrl="solicitud.docenteFotoUrl" size="w-9 h-9" />
          <p class="text-sm font-semibold text-heading truncate">{{ solicitud.docenteNombre }}</p>
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
        <span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-medium" :class="ESTADO_ASESORIA_CLASE[solicitud.estado]">{{ ESTADO_ASESORIA_LABEL[solicitud.estado] }}</span>
        <p class="text-[11px] text-muted mt-1">{{ ESTADO_ASESORIA_LABEL[solicitud.estado] }} el {{ formatFechaHora(solicitud.completadoEn ?? solicitud.actualizadoEn ?? solicitud.creadoEn) }}</p>
      </div>

      <div v-if="esVideo && solicitud.horarioFecha">
        <p class="text-[11px] font-semibold text-muted mb-1.5">Fecha y hora</p>
        <p class="text-sm text-heading flex items-center gap-1.5">
          <FontAwesomeIcon :icon="faCalendarDays" class="w-3 h-3 text-gray-400" />
          {{ new Date(`${solicitud.horarioFecha}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) }}
          · {{ solicitud.horarioHoraInicio }} - {{ solicitud.horarioHoraFin }}
        </p>
        <p v-if="tiempoCoincidenteSegundos > 0" class="text-[11px] text-muted mt-1 flex items-center gap-1.5">
          <FontAwesomeIcon :icon="faHourglassHalf" class="w-2.5 h-2.5" />
          Duración total: {{ formatDuracion(tiempoCoincidenteSegundos) }}
        </p>
      </div>
    </div>

    <div v-if="esVideo" class="space-y-5">
      <VideoSesionCard :link-grabacion="solicitud.linkGrabacion" />

      <div v-if="grabaciones.length > 0">
        <h3 class="text-sm font-bold text-heading mb-2">Grabaciones de esta reunión</h3>
        <div class="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
          <div v-for="(g, i) in grabaciones" :key="i" class="p-3 flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
              <FontAwesomeIcon :icon="faVideo" class="w-3.5 h-3.5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-heading">Grabación {{ i + 1 }}</p>
              <p class="text-[11px] text-muted">{{ formatRangoGrabacion(g) }}</p>
            </div>
            <span
              class="px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
              :class="g.estado === 'FILE_GENERATED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
            >
              {{ g.estado === 'FILE_GENERATED' ? 'Lista' : 'Procesando' }}
            </span>
            <a v-if="g.url" :href="g.url" target="_blank" rel="noopener" class="text-brand-600 hover:underline text-xs font-semibold shrink-0">Ver</a>
          </div>
        </div>
      </div>

      <ResumenIaCard :resumen-ia-texto="solicitud.resumenIaTexto" />

      <div>
        <h3 class="text-sm font-bold text-heading mb-2">Detalles técnicos de la sesión</h3>
        <div class="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
          <div class="p-3 flex items-center gap-2.5">
            <FontAwesomeIcon :icon="faUserGear" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span class="text-muted shrink-0">Participantes</span>
            <div class="flex items-center gap-1.5 ml-auto">
              <Avatar :nombre="solicitud.clienteNombre ?? '?'" :fotoUrl="solicitud.clienteFotoUrl" size="w-6 h-6" />
              <Avatar v-if="solicitud.docenteNombre" :nombre="solicitud.docenteNombre" :fotoUrl="solicitud.docenteFotoUrl" size="w-6 h-6" />
            </div>
          </div>
          <div class="p-3 flex items-center gap-2.5">
            <FontAwesomeIcon :icon="faDisplay" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span class="text-muted">Plataforma</span>
            <span class="ml-auto font-medium text-heading">Google Meet</span>
          </div>
          <div v-if="solicitud.linkReunion" class="p-3 flex items-center gap-2.5">
            <FontAwesomeIcon :icon="faVideo" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span class="text-muted shrink-0">Enlace</span>
            <a :href="solicitud.linkReunion" target="_blank" rel="noopener" class="ml-auto text-brand-600 hover:underline truncate max-w-[240px]">{{ solicitud.linkReunion.replace('https://', '') }}</a>
            <button @click="copiarEnlaceReunion" type="button" class="text-gray-400 hover:text-gray-600 transition-colors duration-75 shrink-0">
              <FontAwesomeIcon :icon="faCopy" class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="esChat">
      <h3 class="text-sm font-bold text-heading mb-1">Historial de la conversación</h3>
      <p class="text-xs text-muted mb-2">Misma conversación que ven el alumno y el asesor — de solo lectura acá.</p>
      <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 h-80 overflow-y-auto space-y-3">
        <HistorialChatMensajes :mensajes="mensajesChat ?? []" :usuario-actual-id="usuarioActualId ?? ''" />
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
                    <Avatar :nombre="participante.nombre" :fotoUrl="participante.fotoUrl" size="w-9 h-9" :sin-foto-ilustrada="participante.rol === 'Desconocido'" />
                    <div>
                      <p class="font-medium text-heading text-sm">{{ participante.nombre }}</p>
                      <p v-if="participante.correo" class="text-[11px] text-muted">{{ participante.correo }}</p>
                      <p class="text-[11px] font-medium" :class="ROL_CLASE[participante.rol] ?? 'text-gray-500'">{{ participante.rol }}</p>
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
</template>
