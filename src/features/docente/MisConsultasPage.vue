<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faHouse, faCheck, faComments, faVideo, faCalendarWeek, faToggleOn, faToggleOff,
  faFilter, faChevronDown, faChevronLeft, faChevronRight, faAnglesLeft, faAnglesRight,
  faFileLines, faCalendarDays, faCircleInfo,
} from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import Avatar from '@/components/Avatar.vue';
import ResumenConsultaModal from './ResumenConsultaModal.vue';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { useChatAsesoriaStore } from '@/stores/chatAsesoria';
import { useMisSolicitudesQuery, useAceptarSolicitud, useCompletarVideo } from '@/composables/useAsesoria';
import { useUsuariosQuery, useActualizarUsuario } from '@/composables/useUsuarios';
import { tiempoHastaVencer, tiempoRelativo } from '@/lib/tiempoRelativo';
import { ESTADO_ASESORIA_LABEL as ESTADO_LABEL, ESTADO_ASESORIA_CLASE as ESTADO_CLASE } from '@/lib/estadoAsesoria';
import { colorCategoria, formatFechaHoraVideo, ventanaDeLlamada, unirseALlamada, puedeCompletarAsesoria } from '@/lib/consultaAsesorUI';
import { solicitudesFalsasPedroRios } from '@/lib/misConsultasDemoFake';
import type { SolicitudAsesoria } from '@/types';

const session = useSessionStore();
const ui = useUiStore();
const docenteId = computed(() => session.sesion?.usuarioId ?? '');

const { data: solicitudesReales, isLoading } = useMisSolicitudesQuery(docenteId, 'asesor');
// DEMO (frontend, no backend): Pedro Ríos (docente_id=6) ya tiene datos reales de sobra en
// "Atendidas", pero cero en "Por Agendar"/"Agendadas" — se agregan unas cuantas solicitudes
// ficticias solo para ÉL, para poder revisar el diseño de esas dos pestañas. Ver
// lib/misConsultasDemoFake.ts — pedido explícito del usuario, quitar cuando ya no haga falta.
const solicitudes = computed(() => (
  docenteId.value === '6'
    ? [...solicitudesFalsasPedroRios(docenteId.value), ...(solicitudesReales.value ?? [])]
    : solicitudesReales.value
));
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

const completarVideo = useCompletarVideo();
const completandoId = ref<string | null>(null);

async function completar(s: SolicitudAsesoria) {
  completandoId.value = s.id;
  try {
    await completarVideo.mutateAsync(s.id);
  } catch (err) {
    ui.toast(err instanceof Error ? err.message : 'No se pudo completar la asesoría', 'error');
  } finally {
    completandoId.value = null;
  }
}

const chatAsesoria = useChatAsesoriaStore();
const resumenAbierto = ref<SolicitudAsesoria | null>(null);

// "Reprogramadas" pedido explícito del cliente — todavía no existe ese estado/bandera en el
// modelo de datos (ver docs), así que por ahora ese tab no filtra nada real (lista vacía) hasta
// que se defina cómo se modela una reprogramación.
type Tab = 'por_agendar' | 'agendadas' | 'reprogramadas' | 'atendidas';
const TABS: { value: Tab; label: string }[] = [
  { value: 'por_agendar', label: 'Por Agendar' },
  { value: 'agendadas', label: 'Agendadas' },
  { value: 'reprogramadas', label: 'Reprogramadas' },
  { value: 'atendidas', label: 'Atendidas' },
];
const tabActiva = ref<Tab>('por_agendar');

const mostrarFiltros = ref(false);
const filtroModalidad = ref<'todas' | 'chat' | 'video'>('todas');
const mostrarOrden = ref(false);
const orden = ref<'recientes' | 'antiguos'>('recientes');

const PORCIONES = [10, 25, 50];
const porPagina = ref(10);
const paginaActual = ref(1);

function cambiarTab(tab: Tab) {
  tabActiva.value = tab;
  paginaActual.value = 1;
}

const listaFiltrada = computed(() => {
  let lista = solicitudes.value ?? [];

  // "Por Agendar" = el asesor todavía NO acepta (sin asignar) — "Agendadas" = ya aceptada
  // (chat en curso o video con horario) pero todavía sin terminar. "asignado" es justamente eso:
  // un chat YA aceptado, por eso va en Agendadas, no en Por Agendar.
  if (tabActiva.value === 'por_agendar') lista = lista.filter((s) => s.estado === 'pendiente' || s.estado === 'en_espera');
  else if (tabActiva.value === 'agendadas') lista = lista.filter((s) => s.estado === 'asignado' || s.estado === 'agendado');
  else if (tabActiva.value === 'atendidas') lista = lista.filter((s) => s.estado === 'completado');
  else if (tabActiva.value === 'reprogramadas') lista = [];

  if (filtroModalidad.value !== 'todas') lista = lista.filter((s) => s.tipo === filtroModalidad.value);

  return [...lista].sort((a, b) => {
    const diff = new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime();
    return orden.value === 'recientes' ? diff : -diff;
  });
});

const totalPaginas = computed(() => Math.max(1, Math.ceil(listaFiltrada.value.length / porPagina.value)));

const listaPaginada = computed(() => {
  const inicio = (paginaActual.value - 1) * porPagina.value;
  return listaFiltrada.value.slice(inicio, inicio + porPagina.value);
});

const rangoDesde = computed(() => (listaFiltrada.value.length === 0 ? 0 : (paginaActual.value - 1) * porPagina.value + 1));
const rangoHasta = computed(() => Math.min(paginaActual.value * porPagina.value, listaFiltrada.value.length));

// Lista de páginas a mostrar en la paginación, con "…" cuando hay más de 7 páginas.
const paginasVisibles = computed<(number | '…')[]>(() => {
  const total = totalPaginas.value;
  const actual = paginaActual.value;
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const paginas: (number | '…')[] = [1];
  if (actual > 3) paginas.push('…');
  for (let p = Math.max(2, actual - 1); p <= Math.min(total - 1, actual + 1); p++) paginas.push(p);
  if (actual < total - 2) paginas.push('…');
  paginas.push(total);
  return paginas;
});

function irAPagina(p: number) {
  paginaActual.value = Math.min(Math.max(1, p), totalPaginas.value);
}

function cambiarPorPagina(valor: number) {
  porPagina.value = valor;
  paginaActual.value = 1;
}
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
          @click="cambiarTab(tab.value)"
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
              @click="filtroModalidad = op.v; mostrarFiltros = false; paginaActual = 1"
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
      <div class="px-6 sm:px-8">
        <div class="rounded-xl border border-gray-200 overflow-hidden">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="text-left text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
                <th class="py-3 px-4">Alumno</th>
                <th class="py-3 px-4">Categoría</th>
                <th class="py-3 px-4">Modalidad</th>
                <th class="py-3 px-4">Fecha / Hora solicitada</th>
                <th class="py-3 px-4">Estado</th>
                <th class="py-3 px-4">SLA</th>
                <th class="py-3 px-4">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in listaPaginada" :key="s.id" class="border-b border-gray-100 last:border-b-0">
                <td class="py-4 px-4">
                  <div class="flex items-center gap-3">
                    <Avatar :nombre="s.clienteNombre ?? '?'" :fotoUrl="s.clienteFotoUrl" size="w-11 h-11" />
                    <div class="min-w-0">
                      <p class="font-semibold text-heading text-sm truncate">{{ s.clienteNombre }}</p>
                      <p class="text-xs text-muted">Solicitado {{ tiempoRelativo(s.creadoEn) }}</p>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-4">
                  <span class="px-2.5 py-1 rounded-full text-xs font-medium" :class="colorCategoria(s.sectorNombre)">{{ s.sectorNombre ?? '—' }}</span>
                </td>
                <td class="py-4 px-4">
                  <div class="flex items-center gap-1.5 text-sm text-gray-600">
                    <FontAwesomeIcon :icon="s.tipo === 'video' ? faVideo : faComments" class="w-3.5 h-3.5" />
                    {{ s.tipo === 'video' ? 'Videollamada' : 'Chat' }}
                  </div>
                </td>
                <td class="py-4 px-4 text-sm text-muted">
                  <span v-if="s.tipo === 'video' && s.horarioFecha" class="flex items-center gap-1">
                    <FontAwesomeIcon :icon="faCalendarDays" class="w-2.5 h-2.5" />
                    {{ formatFechaHoraVideo(s) }}
                  </span>
                  <span v-else>—</span>
                </td>
                <td class="py-4 px-4">
                  <span class="px-2.5 py-1 rounded-full text-[11px] font-medium" :class="ESTADO_CLASE[s.estado]">{{ ESTADO_LABEL[s.estado] }}</span>
                </td>
                <td class="py-4 px-4 text-xs">
                  <span v-if="s.estado === 'pendiente' && s.slaVenceEn" :class="tiempoHastaVencer(s.slaVenceEn).vencido ? 'text-red-500 font-medium' : 'text-amber-600'">
                    {{ tiempoHastaVencer(s.slaVenceEn).texto }}
                  </span>
                  <span v-else class="text-muted">—</span>
                </td>
                <td class="py-4 px-4 whitespace-nowrap">
                  <template v-if="s.estado === 'pendiente'">
                    <div class="flex items-center gap-2">
                      <button
                        @click="aceptar(s)"
                        :disabled="generandoLinkPara === s.id"
                        type="button"
                        class="px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors duration-75 flex items-center gap-1.5"
                      >
                        <FontAwesomeIcon :icon="faCheck" class="w-3 h-3" />
                        {{ generandoLinkPara === s.id ? 'Generando enlace…' : 'Aceptar' }}
                      </button>
                      <button
                        @click="resumenAbierto = s"
                        type="button"
                        class="px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-1.5"
                      >
                        <FontAwesomeIcon :icon="faCircleInfo" class="w-3 h-3" />
                        Detalles
                      </button>
                    </div>
                  </template>

                  <button
                    v-else-if="s.estado === 'asignado'"
                    @click="chatAsesoria.abrir(s.id)"
                    type="button"
                    class="px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors duration-75 inline-flex items-center gap-1.5"
                  >
                    <FontAwesomeIcon :icon="faComments" class="w-3 h-3" />
                    Responder
                    <FontAwesomeIcon :icon="faChevronRight" class="w-2.5 h-2.5" />
                  </button>

                  <template v-else-if="s.estado === 'agendado'">
                    <button
                      v-if="puedeCompletarAsesoria(s)"
                      @click="completar(s)"
                      :disabled="completandoId === s.id"
                      type="button"
                      class="px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors duration-75 flex items-center gap-1.5"
                    >
                      <FontAwesomeIcon :icon="faCheck" class="w-3 h-3" />
                      {{ completandoId === s.id ? 'Completando…' : 'Completar' }}
                    </button>
                    <template v-else>
                      <button
                        @click="unirseALlamada(s)"
                        :disabled="!ventanaDeLlamada(s).disponible"
                        type="button"
                        class="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors duration-75"
                        :class="ventanaDeLlamada(s).disponible ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'"
                      >
                        <FontAwesomeIcon :icon="faVideo" class="w-3 h-3" />
                        Unirse
                      </button>
                      <p class="text-[11px] text-muted mt-1">{{ ventanaDeLlamada(s).texto }}</p>
                    </template>
                  </template>

                  <button
                    v-else-if="s.estado === 'completado'"
                    @click="resumenAbierto = s"
                    type="button"
                    class="px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors duration-75 inline-flex items-center gap-1.5"
                  >
                    <FontAwesomeIcon :icon="faFileLines" class="w-3 h-3" />
                    Ver resumen
                    <FontAwesomeIcon :icon="faChevronRight" class="w-2.5 h-2.5" />
                  </button>

                  <span v-else class="text-xs text-muted">{{ s.estado === 'cancelado' ? 'Cancelada por el alumno' : 'En espera de cobertura' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-4 mt-10">
          <p class="text-xs text-muted">Mostrando {{ rangoDesde }} a {{ rangoHasta }} de {{ listaFiltrada.length }} consulta{{ listaFiltrada.length === 1 ? '' : 's' }}</p>

          <div class="flex items-center gap-1">
            <button type="button" :disabled="paginaActual === 1" @click="irAPagina(1)" class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-75">
              <FontAwesomeIcon :icon="faAnglesLeft" class="w-3 h-3" />
            </button>
            <button type="button" :disabled="paginaActual === 1" @click="irAPagina(paginaActual - 1)" class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-75">
              <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
            </button>

            <template v-for="(p, i) in paginasVisibles" :key="i">
              <span v-if="p === '…'" class="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
              <button
                v-else
                type="button"
                @click="irAPagina(p)"
                class="w-8 h-8 rounded-lg text-sm font-medium flex items-center justify-center transition-colors duration-75"
                :class="p === paginaActual ? 'border-2 border-brand-600 text-brand-700' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'"
              >
                {{ p }}
              </button>
            </template>

            <button type="button" :disabled="paginaActual === totalPaginas" @click="irAPagina(paginaActual + 1)" class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-75">
              <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3" />
            </button>
            <button type="button" :disabled="paginaActual === totalPaginas" @click="irAPagina(totalPaginas)" class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-75">
              <FontAwesomeIcon :icon="faAnglesRight" class="w-3 h-3" />
            </button>
          </div>

          <label class="flex items-center gap-2 text-xs text-muted">
            Mostrar:
            <select
              :value="porPagina"
              @change="cambiarPorPagina(Number(($event.target as HTMLSelectElement).value))"
              class="rounded-lg border border-gray-200 text-sm text-heading px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            >
              <option v-for="n in PORCIONES" :key="n" :value="n">{{ n }} por página</option>
            </select>
          </label>
        </div>

        <p class="flex items-center justify-center gap-1.5 text-xs text-muted text-center py-6">
          <FontAwesomeIcon :icon="faCircleInfo" class="w-3 h-3" />
          Los tiempos de atención se calculan según tu configuración de SLA.
        </p>
      </div>
    </template>
  </PageShell>

  <ResumenConsultaModal :is-open="!!resumenAbierto" :solicitud="resumenAbierto" @close="resumenAbierto = null" />
</template>
