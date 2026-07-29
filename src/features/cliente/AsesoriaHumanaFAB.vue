<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faUserTie, faClock } from '@/lib/icons';
import SolicitarAsesoriaModal from './SolicitarAsesoriaModal.vue';
import VideollamadaConfirmadaModal from './VideollamadaConfirmadaModal.vue';
import ConsultaEnviadaModal from './ConsultaEnviadaModal.vue';
import AsesoriaChatPanel from '@/features/asesoria/AsesoriaChatPanel.vue';
import { useSessionStore } from '@/stores/session';
import { useMisSolicitudesQuery } from '@/composables/useAsesoria';
import type { SolicitudAsesoria } from '@/types';

// Botón flotante para pedirle ayuda a un docente humano (asesoría 1:1) — sibling de AsesorIAChat,
// en la esquina opuesta para no superponerse. Bifurca según el estado de la solicitud más
// reciente: sin solicitud → abre SolicitarAsesoriaModal; pendiente → indicador de espera;
// asignado (chat) → abre el chat compartido; agendado (video) → pantalla de confirmación con
// botón para unirse a la videollamada (no hay conversación de chat que abrir en ese caso).
const props = defineProps<{ ejemploId?: string }>();

const router = useRouter();
const session = useSessionStore();
const clienteId = computed(() => session.sesion?.usuarioId ?? '');
const { data: solicitudes } = useMisSolicitudesQuery(clienteId, 'cliente');

const activasOPendientes = computed(() =>
  (solicitudes.value ?? []).filter((s) => s.estado === 'asignado' || s.estado === 'agendado' || s.estado === 'pendiente'),
);
const solicitudActiva = computed(() => activasOPendientes.value.find((s) => s.estado === 'asignado' || s.estado === 'agendado') ?? null);
const solicitudPendiente = computed(() => (!solicitudActiva.value ? activasOPendientes.value.find((s) => s.estado === 'pendiente') ?? null : null));

const showModal = ref(false);
const chatAbierto = ref(false);
const videollamadaAbierta = ref(false);
const consultaEnviada = ref<SolicitudAsesoria | null>(null);

function handleClick() {
  if (solicitudActiva.value?.estado === 'agendado') {
    videollamadaAbierta.value = true;
  } else if (solicitudActiva.value) {
    chatAbierto.value = true;
  } else if (!solicitudPendiente.value) {
    showModal.value = true;
  }
}

function handleCreada(s: SolicitudAsesoria) {
  showModal.value = false;
  consultaEnviada.value = s;
}

function verMisConsultas() {
  consultaEnviada.value = null;
  router.push({ name: 'asesorias' });
}
</script>

<template>
  <button
    v-if="!chatAbierto && !videollamadaAbierta"
    @click="handleClick"
    :title="solicitudPendiente ? 'Esperando que un docente acepte tu solicitud' : 'Solicitar asesoría a un docente'"
    type="button"
    class="fixed bottom-6 left-64 w-14 h-14 rounded-full text-white flex items-center justify-center shadow-lg transition-colors z-40"
    :class="solicitudPendiente ? 'bg-amber-500 cursor-default' : 'bg-brand-600 hover:bg-brand-700'"
  >
    <FontAwesomeIcon :icon="solicitudPendiente ? faClock : faUserTie" class="w-5 h-5" />
    <span v-if="solicitudActiva" class="absolute top-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
  </button>

  <AsesoriaChatPanel
    v-if="chatAbierto && solicitudActiva"
    :solicitud="solicitudActiva"
    :usuario-actual-id="clienteId"
    :otra-parte-nombre="solicitudActiva.docenteNombre ?? 'Docente'"
    :otra-parte-foto-url="solicitudActiva.docenteFotoUrl"
    @close="chatAbierto = false"
    @finalizada="chatAbierto = false"
  />

  <VideollamadaConfirmadaModal
    :is-open="videollamadaAbierta && !!solicitudActiva"
    :solicitud="solicitudActiva"
    @close="videollamadaAbierta = false"
  />

  <SolicitarAsesoriaModal :is-open="showModal" :ejemplo-id="props.ejemploId" @close="showModal = false" @creada="handleCreada" />

  <ConsultaEnviadaModal
    :is-open="!!consultaEnviada"
    :solicitud="consultaEnviada"
    @close="consultaEnviada = null"
    @ver-consultas="verMisConsultas"
  />
</template>
