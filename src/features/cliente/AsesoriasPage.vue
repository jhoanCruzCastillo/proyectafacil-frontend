<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faUserTie, faCalendarCheck, faComments, faVideo, faXmark,
  faTriangleExclamation, faCartShopping, faClock, faStar, faHeadset,
  faChevronLeft, faChevronRight,
} from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import Avatar from '@/components/Avatar.vue';
import SolicitarAsesoriaModal from './SolicitarAsesoriaModal.vue';
import RatingModal from './RatingModal.vue';
import VideollamadaConfirmadaModal from './VideollamadaConfirmadaModal.vue';
import ConsultaEnviadaModal from './ConsultaEnviadaModal.vue';
import ResumenSolicitudCard from './ResumenSolicitudCard.vue';
import ComprarAddOnModal from '@/features/settings/ComprarAddOnModal.vue';
import AsesoriaChatPanel from '@/features/asesoria/AsesoriaChatPanel.vue';
import { useSessionStore } from '@/stores/session';
import { useUsuariosQuery } from '@/composables/useUsuarios';
import { useTicketsConsultaQuery } from '@/composables/useTicketsConsulta';
import { useMisSolicitudesQuery, useCancelarSolicitud } from '@/composables/useAsesoria';
import { cuentaEfectivaDe } from '@/lib/permisos';
import { ESTADO_ASESORIA_LABEL as ESTADO_LABEL, ESTADO_ASESORIA_CLASE as ESTADO_CLASE } from '@/lib/estadoAsesoria';
import { addOns } from '@/data/planes';
import type { SolicitudAsesoria } from '@/types';

const ADDON_CONSULTA = addOns.find((a) => a.id === 'consultoria-1a1') ?? null;

const session = useSessionStore();
const { data: usuariosData } = useUsuariosQuery();
const cuentaId = computed(() => (session.sesion ? cuentaEfectivaDe(usuariosData.value ?? [], session.sesion) : ''));
const clienteId = computed(() => session.sesion?.usuarioId ?? '');

const { data: tickets } = useTicketsConsultaQuery(cuentaId);
const disponibles = computed(() => (tickets.value ?? []).filter((t) => t.estado === 'disponible'));
const ticketsDisponibles = computed(() => disponibles.value.length);
const fichasChat = computed(() => disponibles.value.filter((t) => t.modalidad === 'chat'));
const fichasVideo = computed(() => disponibles.value.filter((t) => t.modalidad === 'video'));
// Duración fija por modalidad al emitirse — todas las fichas de un mismo tipo comparten valor,
// así que basta con la primera disponible para mostrarla.
const duracionChat = computed(() => fichasChat.value[0]?.duracionMinutos ?? null);
const duracionVideo = computed(() => fichasVideo.value[0]?.duracionMinutos ?? null);

const { data: solicitudes, isLoading } = useMisSolicitudesQuery(clienteId, 'cliente');
const cancelarSolicitud = useCancelarSolicitud();

const showSolicitar = ref(false);
const showComprarAddon = ref(false);
const detalle = ref<SolicitudAsesoria | null>(null);
const chatAbierto = ref<SolicitudAsesoria | null>(null);
const videollamadaConfirmada = ref<SolicitudAsesoria | null>(null);
const showConfirmarCancelar = ref(false);
const calificando = ref<SolicitudAsesoria | null>(null);
const consultaEnviada = ref<SolicitudAsesoria | null>(null);

function handleCreada(s: SolicitudAsesoria) {
  showSolicitar.value = false;
  consultaEnviada.value = s;
}

const POR_PAGINA = 5;
const pagina = ref(1);
const totalPaginas = computed(() => Math.max(1, Math.ceil((solicitudes.value ?? []).length / POR_PAGINA)));
const solicitudesPagina = computed(() => {
  const inicio = (pagina.value - 1) * POR_PAGINA;
  return (solicitudes.value ?? []).slice(inicio, inicio + POR_PAGINA);
});
watch(solicitudes, () => { pagina.value = 1; });

function verDetalle(s: SolicitudAsesoria) {
  if (s.estado === 'completado' && s.calificacion == null) {
    calificando.value = s;
  } else if (s.estado === 'agendado') {
    videollamadaConfirmada.value = s;
  } else if (s.estado === 'asignado') {
    chatAbierto.value = s;
  } else {
    detalle.value = s;
  }
}

function confirmarCancelar() {
  if (!detalle.value) return;
  cancelarSolicitud.mutate(detalle.value.id);
  showConfirmarCancelar.value = false;
  detalle.value = null;
}

// Fechas sin hora ("YYYY-MM-DD", ej. horarioFecha) las parsea `new Date()` como medianoche UTC —
// en timezones detrás de UTC (ej. Perú, UTC-5) eso cae en el día calendario ANTERIOR al mostrarlo
// en hora local. Se arma la fecha en local explícitamente para evitar el corrimiento.
function formatFecha(iso: string): string {
  const fecha = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFechaHoraAgendada(s: SolicitudAsesoria): string | null {
  if (!s.horarioFecha) return null;
  const fecha = formatFecha(s.horarioFecha);
  return s.horarioHoraInicio ? `${fecha}, ${s.horarioHoraInicio}` : fecha;
}
</script>

<template>
  <PageShell :icon="faUserTie" title="Asesorías" description="Solicita orientación personalizada para tus fichas técnicas.">
    <div class="rounded-2xl p-8 mb-8 relative overflow-hidden" :class="ticketsDisponibles > 0 ? 'bg-brand-50 border border-brand-100' : 'bg-amber-50 border border-amber-200'">
      <div v-if="ticketsDisponibles > 0" class="relative flex items-center gap-6 flex-wrap">
        <div class="flex items-center gap-3 flex-1 min-w-[220px]">
          <div class="w-12 h-12 rounded-xl bg-white text-brand-600 flex items-center justify-center shadow-sm shrink-0">
            <FontAwesomeIcon :icon="faHeadset" class="w-5 h-5" />
          </div>
          <div>
            <p class="font-bold text-brand-700">
              {{ ticketsDisponibles }} ficha{{ ticketsDisponibles === 1 ? '' : 's' }} de consulta disponible{{ ticketsDisponibles === 1 ? '' : 's' }} este mes
            </p>
            <p class="text-xs text-brand-600/70 mt-0.5">Cada ficha es para una modalidad específica — úsalas cuando las necesites.</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div
            class="rounded-xl bg-white px-4 py-3 flex items-center gap-3 transition-opacity"
            :class="fichasChat.length > 0 ? 'border border-brand-200' : 'border border-gray-200 opacity-50'"
          >
            <div class="w-9 h-9 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
              <FontAwesomeIcon :icon="faComments" class="w-4 h-4" />
            </div>
            <div>
              <p class="text-2xl font-bold text-heading leading-tight">{{ fichasChat.length }}</p>
              <p class="text-xs text-muted whitespace-nowrap">Ficha{{ fichasChat.length === 1 ? '' : 's' }} de chat</p>
              <p v-if="duracionChat" class="text-[11px] text-muted mt-0.5 flex items-center gap-1">
                <FontAwesomeIcon :icon="faClock" class="w-2.5 h-2.5" />
                {{ duracionChat }} min c/u
              </p>
            </div>
          </div>
          <div
            class="rounded-xl bg-white px-4 py-3 flex items-center gap-3 transition-opacity"
            :class="fichasVideo.length > 0 ? 'border border-violet-200' : 'border border-gray-200 opacity-50'"
          >
            <div class="w-9 h-9 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
              <FontAwesomeIcon :icon="faVideo" class="w-4 h-4" />
            </div>
            <div>
              <p class="text-2xl font-bold text-heading leading-tight">{{ fichasVideo.length }}</p>
              <p class="text-xs text-muted whitespace-nowrap">Ficha{{ fichasVideo.length === 1 ? '' : 's' }} de videoconferencia</p>
              <p v-if="duracionVideo" class="text-[11px] text-muted mt-0.5 flex items-center gap-1">
                <FontAwesomeIcon :icon="faClock" class="w-2.5 h-2.5" />
                {{ duracionVideo }} min c/u
              </p>
            </div>
          </div>
        </div>

        <button
          @click="showSolicitar = true"
          type="button"
          class="px-6 py-3 rounded-lg bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors flex items-center gap-2 shrink-0"
        >
          <FontAwesomeIcon :icon="faCalendarCheck" class="w-3.5 h-3.5" />
          Solicitar asesoría
        </button>
      </div>
      <div v-else class="relative flex items-start gap-4">
        <FontAwesomeIcon :icon="faTriangleExclamation" class="w-6 h-6 text-amber-500 mt-1 shrink-0" />
        <div class="flex-1">
          <p class="font-semibold text-heading">No tienes consultas disponibles</p>
          <p class="text-sm text-muted mt-1">Ya usaste todas tus consultas disponibles.</p>
          <button
            v-if="ADDON_CONSULTA"
            @click="showComprarAddon = true"
            type="button"
            class="mt-3 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors flex items-center gap-2"
          >
            <FontAwesomeIcon :icon="faCartShopping" class="w-3.5 h-3.5" />
            Comprar consulta adicional · ${{ ADDON_CONSULTA.precio }}
          </button>
        </div>
      </div>
    </div>

    <h2 class="text-lg font-bold text-heading mb-1">Mis consultas</h2>
    <p class="text-sm text-muted mb-4">Historial de todas tus consultas y su estado actual.</p>

    <p v-if="isLoading" class="text-sm text-muted">Cargando…</p>
    <p v-else-if="(solicitudes ?? []).length === 0" class="text-sm text-muted py-8 text-center">Todavía no has solicitado ninguna asesoría.</p>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-[11px] uppercase tracking-widest text-muted border-b border-gray-100">
            <th class="pb-2 pr-4 font-semibold">Fecha</th>
            <th class="pb-2 pr-4 font-semibold">Categoría</th>
            <th class="pb-2 pr-4 font-semibold">Modalidad</th>
            <th class="pb-2 pr-4 font-semibold">Docente asignado</th>
            <th class="pb-2 pr-4 font-semibold">Estado</th>
            <th class="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in solicitudesPagina" :key="s.id" class="border-b border-gray-50">
            <td class="py-3 pr-4 text-heading whitespace-nowrap">{{ formatFecha(s.creadoEn) }}</td>
            <td class="py-3 pr-4">
              <span class="px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">{{ s.sectorNombre ?? '—' }}</span>
            </td>
            <td class="py-3 pr-4">
              <span class="inline-flex items-center gap-1.5 text-xs text-gray-600">
                <FontAwesomeIcon :icon="s.tipo === 'video' ? faVideo : faComments" class="w-3 h-3" />
                {{ s.tipo === 'video' ? 'Videollamada' : 'Chat' }}
              </span>
            </td>
            <td class="py-3 pr-4">
              <div v-if="s.docenteNombre" class="flex items-center gap-2 whitespace-nowrap">
                <Avatar :nombre="s.docenteNombre" :fotoUrl="s.docenteFotoUrl" size="w-7 h-7" />
                <span class="text-heading text-sm">{{ s.docenteNombre }}</span>
              </div>
              <span v-else class="text-muted text-xs">Sin asignar</span>
            </td>
            <td class="py-3 pr-4">
              <span class="px-2.5 py-1 rounded-full text-[11px] font-medium" :class="ESTADO_CLASE[s.estado]">{{ ESTADO_LABEL[s.estado] }}</span>
              <p v-if="s.estado === 'agendado' && formatFechaHoraAgendada(s)" class="text-[11px] text-muted mt-1 flex items-center gap-1">
                <FontAwesomeIcon :icon="faClock" class="w-2.5 h-2.5" />
                {{ formatFechaHoraAgendada(s) }}
              </p>
            </td>
            <td class="py-3 text-right whitespace-nowrap">
              <button
                v-if="s.estado === 'agendado'"
                @click="verDetalle(s)"
                type="button"
                class="px-3.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors duration-75 inline-flex items-center gap-1.5"
              >
                <FontAwesomeIcon :icon="faVideo" class="w-3 h-3" />
                Unirse a la llamada
              </button>
              <button
                v-else-if="s.estado === 'asignado'"
                @click="verDetalle(s)"
                type="button"
                class="px-3.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors duration-75 inline-flex items-center gap-1.5"
              >
                <FontAwesomeIcon :icon="faComments" class="w-3 h-3" />
                Unirse a la conversación
              </button>
              <button
                v-else
                @click="verDetalle(s)"
                type="button"
                class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors duration-75"
                :class="s.estado === 'completado' && s.calificacion == null ? 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
              >
                <template v-if="s.estado === 'completado' && s.calificacion == null">
                  <FontAwesomeIcon :icon="faStar" class="w-3 h-3 mr-1" />Calificar
                </template>
                <template v-else>Ver detalle</template>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="totalPaginas > 1" class="flex items-center justify-between pt-5">
        <p class="text-xs text-muted">
          {{ (pagina - 1) * POR_PAGINA + 1 }}–{{ Math.min(pagina * POR_PAGINA, (solicitudes ?? []).length) }} de {{ (solicitudes ?? []).length }}
        </p>
        <div class="flex items-center gap-2">
          <button
            @click="pagina -= 1"
            :disabled="pagina <= 1"
            type="button"
            class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors duration-75"
          >
            <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
          </button>
          <span class="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 text-xs font-semibold flex items-center justify-center">{{ pagina }}</span>
          <button
            @click="pagina += 1"
            :disabled="pagina >= totalPaginas"
            type="button"
            class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors duration-75"
          >
            <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  </PageShell>

  <SolicitarAsesoriaModal :is-open="showSolicitar" @close="showSolicitar = false" @creada="handleCreada" />

  <ConsultaEnviadaModal
    :is-open="!!consultaEnviada"
    :solicitud="consultaEnviada"
    @close="consultaEnviada = null"
    @ver-consultas="consultaEnviada = null"
  />
  <ComprarAddOnModal :is-open="showComprarAddon" :usuario-id="cuentaId" :addon="ADDON_CONSULTA" @close="showComprarAddon = false" />

  <Transition name="fade">
    <div v-if="detalle" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="detalle = null">
      <div class="bg-white rounded-2xl shadow-modal w-full max-w-md relative" @click.stop>
        <button
          @click="detalle = null"
          type="button"
          class="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100"
        >
          <FontAwesomeIcon :icon="faXmark" />
        </button>

        <div class="pt-8 pb-5 px-8 text-center">
          <div class="w-14 h-14 mx-auto rounded-full bg-amber-100 text-amber-500 flex items-center justify-center mb-4">
            <FontAwesomeIcon :icon="faClock" class="w-6 h-6" />
          </div>
          <h3 class="text-lg font-bold text-heading mb-1">
            {{ detalle?.estado === 'pendiente' ? 'Buscando un asesor disponible' : detalle ? ESTADO_LABEL[detalle.estado] : '' }}
          </h3>
          <p v-if="detalle?.estado === 'pendiente'" class="text-sm text-muted">Te notificaremos en cuanto un asesor confirme tu consulta.</p>
        </div>

        <div class="mx-6 mb-6">
          <ResumenSolicitudCard v-if="detalle" :solicitud="detalle" />
        </div>

        <div v-if="detalle?.estado === 'pendiente'" class="px-6 pb-6 text-center">
          <button @click="showConfirmarCancelar = true" type="button" class="text-sm text-red-600 font-medium hover:underline">
            Cancelar solicitud
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <ConfirmModal
    :is-open="showConfirmarCancelar"
    title="¿Cancelar esta solicitud?"
    message="Se liberará tu consulta y podrás usarla de nuevo más adelante. Esta acción no se puede deshacer."
    confirm-label="Sí, cancelar"
    @confirm="confirmarCancelar"
    @close="showConfirmarCancelar = false"
  />

  <RatingModal :is-open="!!calificando" :solicitud="calificando" @close="calificando = null" />

  <VideollamadaConfirmadaModal
    :is-open="!!videollamadaConfirmada"
    :solicitud="videollamadaConfirmada"
    @close="videollamadaConfirmada = null"
  />

  <AsesoriaChatPanel
    v-if="chatAbierto"
    :solicitud="chatAbierto"
    :usuario-actual-id="clienteId"
    :otra-parte-nombre="chatAbierto.docenteNombre ?? 'Asesor'"
    :otra-parte-foto-url="chatAbierto.docenteFotoUrl"
    @close="chatAbierto = null"
    @finalizada="chatAbierto = null"
  />
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
