<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faHouse, faCheck, faComments, faVideo, faCalendarWeek, faToggleOn, faToggleOff,
  faFilter, faChevronDown, faChevronRight, faFileLines, faCalendarDays,
} from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import Avatar from '@/components/Avatar.vue';
import AsesoriaChatPanel from '@/features/asesoria/AsesoriaChatPanel.vue';
import ResumenConsultaModal from './ResumenConsultaModal.vue';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { useMisSolicitudesQuery, useAceptarSolicitud } from '@/composables/useAsesoria';
import { useUsuariosQuery, useActualizarUsuario } from '@/composables/useUsuarios';
import { tiempoHastaVencer, tiempoRelativo } from '@/lib/tiempoRelativo';
import { ESTADO_ASESORIA_LABEL as ESTADO_LABEL, ESTADO_ASESORIA_CLASE as ESTADO_CLASE } from '@/lib/estadoAsesoria';
import { colorCategoria, formatFechaHoraVideo, ventanaDeLlamada, unirseALlamada } from '@/lib/consultaAsesorUI';
import type { SolicitudAsesoria } from '@/types';

const session = useSessionStore();
const ui = useUiStore();
const docenteId = computed(() => session.sesion?.usuarioId ?? '');

const { data: solicitudes, isLoading } = useMisSolicitudesQuery(docenteId, 'asesor');
const aceptarSolicitud = useAceptarSolicitud();

const { data: usuarios } = useUsuariosQuery();
const actualizarUsuario = useActualizarUsuario();
const yoMismo = computed(() => usuarios.value?.find((u) => u.id === docenteId.value));
const disponible = computed(() => yoMismo.value?.disponible ?? true);

function toggleDisponible() {
  actualizarUsuario.mutate({ id: docenteId.value, data: { disponible: !disponible.value } });
}

// El link de videollamada ya no se pega a mano — el backend lo genera automáticamente al aceptar
// (simulado hasta tener credenciales reales de Zoom/Meet, Módulo 7). El pequeño delay es solo para
// que la generación se sienta real en la UI, no una llamada de red.
const generandoLinkPara = ref<string | null>(null);

async function aceptar(s: SolicitudAsesoria) {
  if (s.tipo === 'video') {
    generandoLinkPara.value = s.id;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  try {
    await aceptarSolicitud.mutateAsync({ solicitudId: s.id, asesorId: docenteId.value });
  } catch (err) {
    ui.toast(err instanceof Error ? err.message : 'No se pudo aceptar la solicitud', 'error');
  } finally {
    generandoLinkPara.value = null;
  }
}

const chatAbiertoId = ref<string | null>(null);
const chatAbierto = computed(() => (solicitudes.value ?? []).find((s) => s.id === chatAbiertoId.value) ?? null);
const resumenAbierto = ref<SolicitudAsesoria | null>(null);

type Tab = 'todas' | 'pendientes' | 'agendadas' | 'completadas';
const TABS: { value: Tab; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'agendadas', label: 'Agendadas' },
  { value: 'completadas', label: 'Completadas' },
];
const tabActiva = ref<Tab>('todas');

const mostrarFiltros = ref(false);
const filtroModalidad = ref<'todas' | 'chat' | 'video'>('todas');
const mostrarOrden = ref(false);
const orden = ref<'recientes' | 'antiguos'>('recientes');

const listaFiltrada = computed(() => {
  let lista = solicitudes.value ?? [];

  if (tabActiva.value === 'pendientes') lista = lista.filter((s) => s.estado === 'pendiente' || s.estado === 'asignado');
  else if (tabActiva.value === 'agendadas') lista = lista.filter((s) => s.estado === 'agendado');
  else if (tabActiva.value === 'completadas') lista = lista.filter((s) => s.estado === 'completado');

  if (filtroModalidad.value !== 'todas') lista = lista.filter((s) => s.tipo === filtroModalidad.value);

  return [...lista].sort((a, b) => {
    const diff = new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime();
    return orden.value === 'recientes' ? diff : -diff;
  });
});
</script>

<template>
  <PageShell :icon="faHouse" title="Mis consultas" description="Gestiona todas las consultas asignadas por los alumnos." content-class="py-5">
    <template #actions>
      <button
        @click="toggleDisponible"
        type="button"
        class="px-5 py-2.5 rounded-lg border text-sm font-medium flex items-center gap-2 transition-colors"
        :class="disponible ? 'bg-brand-600/15 border-brand-500/30 text-brand-300' : 'bg-white/[0.06] border-white/10 text-white/60'"
      >
        <FontAwesomeIcon :icon="disponible ? faToggleOn : faToggleOff" class="w-4 h-4" />
        {{ disponible ? 'Disponible' : 'No disponible' }}
      </button>
      <RouterLink
        :to="{ name: 'docente-horario' }"
        class="px-5 py-2.5 rounded-lg bg-white/[0.06] border border-white/10 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faCalendarWeek" class="w-3.5 h-3.5" />
        Mi disponibilidad
      </RouterLink>
    </template>

    <div class="flex items-center justify-between gap-3 flex-wrap px-6 pt-5 sm:px-8">
      <div class="flex gap-1 border-b border-gray-100 -mb-px">
        <button
          v-for="tab in TABS"
          :key="tab.value"
          @click="tabActiva = tab.value"
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-75"
          :class="tabActiva === tab.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="flex items-center gap-2.5 pb-2">
        <div class="relative">
          <button
            @click="mostrarFiltros = !mostrarFiltros; mostrarOrden = false"
            type="button"
            class="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-2"
          >
            <FontAwesomeIcon :icon="faFilter" class="w-3 h-3" />
            Filtros
          </button>
          <div v-if="mostrarFiltros" class="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white shadow-modal z-10 p-1.5">
            <button
              v-for="op in [{ v: 'todas', l: 'Todas las modalidades' }, { v: 'chat', l: 'Chat' }, { v: 'video', l: 'Videollamada' }] as const"
              :key="op.v"
              @click="filtroModalidad = op.v; mostrarFiltros = false"
              type="button"
              class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors duration-75"
              :class="filtroModalidad === op.v ? 'text-brand-700 font-medium bg-brand-50' : 'text-gray-600'"
            >
              {{ op.l }}
            </button>
          </div>
        </div>

        <div class="relative">
          <button
            @click="mostrarOrden = !mostrarOrden; mostrarFiltros = false"
            type="button"
            class="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-2"
          >
            {{ orden === 'recientes' ? 'Más recientes' : 'Más antiguas' }}
            <FontAwesomeIcon :icon="faChevronDown" class="w-2.5 h-2.5" />
          </button>
          <div v-if="mostrarOrden" class="absolute right-0 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-modal z-10 p-1.5">
            <button
              v-for="op in [{ v: 'recientes', l: 'Más recientes' }, { v: 'antiguos', l: 'Más antiguas' }] as const"
              :key="op.v"
              @click="orden = op.v; mostrarOrden = false"
              type="button"
              class="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors duration-75"
              :class="orden === op.v ? 'text-brand-700 font-medium bg-brand-50' : 'text-gray-600'"
            >
              {{ op.l }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <p v-if="isLoading" class="text-sm text-muted px-6 sm:px-8 pb-6">Cargando…</p>
    <p v-else-if="listaFiltrada.length === 0" class="text-sm text-muted py-10 text-center">No hay consultas en esta categoría.</p>
    <template v-else>
      <div
        v-for="s in listaFiltrada"
        :key="s.id"
        class="flex items-center gap-4 px-6 sm:px-8 py-4 border-b border-gray-50 last:border-0"
      >
        <Avatar :nombre="s.clienteNombre ?? '?'" :fotoUrl="s.clienteFotoUrl" size="w-11 h-11" />

        <div class="w-40 shrink-0 min-w-0">
          <p class="font-semibold text-heading text-sm truncate">{{ s.clienteNombre }}</p>
          <p class="text-xs text-muted">Solicitado {{ tiempoRelativo(s.creadoEn) }}</p>
        </div>

        <div class="w-40 shrink-0">
          <span class="px-2.5 py-1 rounded-full text-xs font-medium" :class="colorCategoria(s.sectorNombre)">{{ s.sectorNombre ?? '—' }}</span>
        </div>

        <div class="w-44 shrink-0">
          <div class="flex items-center gap-1.5 text-sm text-gray-600">
            <FontAwesomeIcon :icon="s.tipo === 'video' ? faVideo : faComments" class="w-3.5 h-3.5" />
            {{ s.tipo === 'video' ? 'Videollamada' : 'Chat' }}
          </div>
          <p v-if="s.tipo === 'video' && s.horarioFecha" class="text-xs text-muted mt-0.5 flex items-center gap-1">
            <FontAwesomeIcon :icon="faCalendarDays" class="w-2.5 h-2.5" />
            {{ formatFechaHoraVideo(s) }}
          </p>
        </div>

        <div class="w-28 shrink-0">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-medium" :class="ESTADO_CLASE[s.estado]">{{ ESTADO_LABEL[s.estado] }}</span>
        </div>

        <div class="ml-auto text-right shrink-0">
          <template v-if="s.estado === 'pendiente'">
            <button
              @click="aceptar(s)"
              :disabled="generandoLinkPara === s.id"
              type="button"
              class="px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors duration-75 flex items-center gap-1.5 ml-auto"
            >
              <FontAwesomeIcon :icon="faCheck" class="w-3 h-3" />
              {{ generandoLinkPara === s.id ? 'Generando enlace…' : 'Aceptar' }}
            </button>
            <p v-if="s.slaVenceEn" class="text-[11px] mt-1.5" :class="tiempoHastaVencer(s.slaVenceEn).vencido ? 'text-red-500 font-medium' : 'text-amber-600'">
              {{ tiempoHastaVencer(s.slaVenceEn).texto }}
            </p>
          </template>

          <button
            v-else-if="s.estado === 'asignado'"
            @click="chatAbiertoId = s.id"
            type="button"
            class="px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors duration-75 inline-flex items-center gap-1.5 ml-auto"
          >
            <FontAwesomeIcon :icon="faComments" class="w-3 h-3" />
            Responder
            <FontAwesomeIcon :icon="faChevronRight" class="w-2.5 h-2.5" />
          </button>

          <template v-else-if="s.estado === 'agendado'">
            <button
              @click="unirseALlamada(s)"
              :disabled="!ventanaDeLlamada(s).disponible"
              type="button"
              class="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 ml-auto transition-colors duration-75"
              :class="ventanaDeLlamada(s).disponible ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'"
            >
              <FontAwesomeIcon :icon="faVideo" class="w-3 h-3" />
              Unirse a la llamada
            </button>
            <p class="text-[11px] text-muted mt-1.5">{{ ventanaDeLlamada(s).texto }}</p>
          </template>

          <button
            v-else-if="s.estado === 'completado'"
            @click="resumenAbierto = s"
            type="button"
            class="px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors duration-75 inline-flex items-center gap-1.5 ml-auto"
          >
            <FontAwesomeIcon :icon="faFileLines" class="w-3 h-3" />
            Ver resumen
            <FontAwesomeIcon :icon="faChevronRight" class="w-2.5 h-2.5" />
          </button>

          <span v-else class="text-xs text-muted">{{ s.estado === 'cancelado' ? 'Cancelada por el alumno' : 'En espera de cobertura' }}</span>
        </div>
      </div>

      <p class="text-xs text-muted text-center py-4">Mostrando 1–{{ listaFiltrada.length }} de {{ listaFiltrada.length }} consulta{{ listaFiltrada.length === 1 ? '' : 's' }}</p>
    </template>

    <AsesoriaChatPanel
      v-if="chatAbierto"
      :solicitud="chatAbierto"
      :usuario-actual-id="docenteId"
      :otra-parte-nombre="chatAbierto.clienteNombre ?? 'Cliente'"
      :otra-parte-foto-url="chatAbierto.clienteFotoUrl"
      @close="chatAbiertoId = null"
      @finalizada="chatAbiertoId = null"
    />
  </PageShell>

  <ResumenConsultaModal :is-open="!!resumenAbierto" :solicitud="resumenAbierto" @close="resumenAbierto = null" />
</template>
