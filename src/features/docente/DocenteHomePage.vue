<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faCalendarCheck, faMoneyBillTransfer, faStar, faBell, faComments, faVideo,
  faChevronRight, faFileLines, faCalendarDays, faInbox, faCircleInfo,
} from '@/lib/icons';
import Avatar from '@/components/Avatar.vue';
import AsesoriaChatPanel from '@/features/asesoria/AsesoriaChatPanel.vue';
import ResumenConsultaModal from './ResumenConsultaModal.vue';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { useMisSolicitudesQuery, useAceptarSolicitud } from '@/composables/useAsesoria';
import { useUsuariosQuery, useActualizarUsuario } from '@/composables/useUsuarios';
import { tiempoRelativo } from '@/lib/tiempoRelativo';
import { ESTADO_ASESORIA_LABEL as ESTADO_LABEL, ESTADO_ASESORIA_CLASE as ESTADO_CLASE } from '@/lib/estadoAsesoria';
import { colorCategoria, horaAmPm, ventanaDeLlamada, unirseALlamada } from '@/lib/consultaAsesorUI';
import type { SolicitudAsesoria } from '@/types';

// Dashboard de bienvenida del asesor (pedido explícito del usuario, con mockup de referencia) —
// distinto del resto de la app: fondo claro de punta a punta en vez de la cabecera oscura +
// contenido blanco de PageShell, porque acá la cabecera ES una tarjeta clara con el saludo y el
// toggle de disponibilidad, no una franja de navegación. El listado completo con tabs/filtros vive
// en MisConsultasPage.vue (ruta "docente-consultas"), enlazado desde "Ver todas".
const session = useSessionStore();
const ui = useUiStore();
const docenteId = computed(() => session.sesion?.usuarioId ?? '');

const { data: solicitudes } = useMisSolicitudesQuery(docenteId, 'asesor');
const aceptarSolicitud = useAceptarSolicitud();

const { data: usuarios } = useUsuariosQuery();
const actualizarUsuario = useActualizarUsuario();
const yoMismo = computed(() => usuarios.value?.find((u) => u.id === docenteId.value));
const disponible = computed(() => yoMismo.value?.disponible ?? true);

function toggleDisponible() {
  actualizarUsuario.mutate({ id: docenteId.value, data: { disponible: !disponible.value } });
}

function esMismoMes(fechaIso: string, offsetMeses: number): boolean {
  const fecha = new Date(fechaIso);
  const ahora = new Date();
  const objetivo = new Date(ahora.getFullYear(), ahora.getMonth() + offsetMeses, 1);
  return fecha.getFullYear() === objetivo.getFullYear() && fecha.getMonth() === objetivo.getMonth();
}

const completadosEsteMes = computed(() => (solicitudes.value ?? []).filter((s) => s.estado === 'completado' && esMismoMes(s.actualizadoEn ?? s.creadoEn, 0)).length);
const completadosMesPasado = computed(() => (solicitudes.value ?? []).filter((s) => s.estado === 'completado' && esMismoMes(s.actualizadoEn ?? s.creadoEn, -1)).length);
const deltaTexto = computed(() => {
  const delta = completadosEsteMes.value - completadosMesPasado.value;
  if (delta === 0) return 'Igual que el mes pasado';
  return `${delta > 0 ? '+' : ''}${delta} vs. el mes pasado`;
});

// Mismo honorario fijo por consulta que usa Liquidaciones (Módulo 6) — ver
// TicketsAsesoriaController::HONORARIO_POR_TICKET en el backend.
const HONORARIO_POR_TICKET = 550;
const honorarioEsteMes = computed(() => completadosEsteMes.value * HONORARIO_POR_TICKET);

const calificaciones = computed(() => (solicitudes.value ?? []).map((s) => s.calificacion).filter((c): c is number => c != null));
const calificacionPromedio = computed(() => (calificaciones.value.length === 0 ? null : calificaciones.value.reduce((a, b) => a + b, 0) / calificaciones.value.length));

// "Ignorar" no existe como acción real en el backend (el modelo de broadcast no tiene rechazo
// por-asesor, ver docs — cualquier otro asesor notificado igual puede aceptarla) — acá solo oculta
// la tarjeta de ESTA sesión; si sigue pendiente, puede reaparecer en una recarga o en "Ver todas".
const ignoradas = ref<Set<string>>(new Set());
const solicitudDestacada = computed(() => (solicitudes.value ?? []).find((s) => s.estado === 'pendiente' && !ignoradas.value.has(s.id)) ?? null);

function ignorar(s: SolicitudAsesoria) {
  ignoradas.value = new Set([...ignoradas.value, s.id]);
}

function tituloSolicitud(s: SolicitudAsesoria): string {
  if (s.tipo === 'video' && s.horarioFecha) {
    const fecha = new Date(`${s.horarioFecha}T00:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
    const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);
    const rango = s.horarioHoraInicio && s.horarioHoraFin ? `${horaAmPm(s.horarioHoraInicio)} - ${horaAmPm(s.horarioHoraFin)}` : '';
    return `${fechaCap}${rango ? `, ${rango}` : ''} · ${s.sectorNombre ?? 'Consulta'}`;
  }
  return s.sectorNombre ?? 'Nueva consulta';
}

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

const asignadas = computed(() => (solicitudes.value ?? []).filter((s) => s.estado !== 'pendiente').slice(0, 5));

const chatAbiertoId = ref<string | null>(null);
const chatAbierto = computed(() => (solicitudes.value ?? []).find((s) => s.id === chatAbiertoId.value) ?? null);
const resumenAbierto = ref<SolicitudAsesoria | null>(null);
</script>

<template>
  <div class="min-h-screen bg-surface p-6 sm:p-8">
    <div class="rounded-2xl bg-white shadow-card p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 mb-6">
      <div class="flex items-center gap-4 min-w-0">
        <Avatar :nombre="session.sesion?.nombre ?? '?'" :fotoUrl="yoMismo?.fotoUrl" size="w-16 h-16" />
        <div class="min-w-0">
          <h1 class="text-2xl font-bold text-heading truncate">Hola, {{ session.sesion?.nombre }}</h1>
          <p class="text-sm text-muted mt-0.5">Bienvenido a tu panel de asesorías</p>
        </div>
      </div>
      <div class="flex flex-col items-end gap-1.5 shrink-0">
        <button @click="toggleDisponible" type="button" class="relative w-14 h-8 rounded-full transition-colors duration-150" :class="disponible ? 'bg-brand-600' : 'bg-gray-300'">
          <span class="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform duration-150" :class="disponible ? 'translate-x-6' : 'translate-x-0'" />
        </button>
        <p class="text-sm font-semibold" :class="disponible ? 'text-brand-700' : 'text-gray-500'">{{ disponible ? 'Disponible' : 'No disponible' }}</p>
        <p class="text-xs text-muted">{{ disponible ? 'Recibiendo solicitudes' : 'No recibirás nuevas solicitudes' }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
      <div class="rounded-2xl bg-white shadow-card p-6 flex items-start gap-4">
        <div class="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <FontAwesomeIcon :icon="faCalendarCheck" class="w-4 h-4" />
        </div>
        <div class="min-w-0">
          <p class="text-sm text-muted leading-tight">Consultas atendidas este mes</p>
          <p class="text-2xl font-bold text-heading mt-1">{{ completadosEsteMes }}</p>
          <p class="text-xs text-muted mt-1">{{ deltaTexto }}</p>
        </div>
      </div>

      <div class="rounded-2xl bg-white shadow-card p-6 flex items-start gap-4">
        <div class="w-11 h-11 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
          <FontAwesomeIcon :icon="faMoneyBillTransfer" class="w-4 h-4" />
        </div>
        <div class="min-w-0">
          <p class="text-sm text-muted leading-tight">Honorario acumulado</p>
          <p class="text-2xl font-bold text-green-700 mt-1">${{ honorarioEsteMes.toLocaleString('es-PE') }}</p>
          <p class="text-xs text-muted mt-1">Este mes</p>
        </div>
      </div>

      <div class="rounded-2xl bg-white shadow-card p-6 flex items-start gap-4">
        <div class="w-11 h-11 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
          <FontAwesomeIcon :icon="faStar" class="w-4 h-4" />
        </div>
        <div class="min-w-0">
          <p class="text-sm text-muted leading-tight">Calificación promedio</p>
          <p class="text-2xl font-bold text-heading mt-1 flex items-center gap-1.5">
            {{ calificacionPromedio !== null ? calificacionPromedio.toFixed(1) : '—' }}
            <FontAwesomeIcon v-if="calificacionPromedio !== null" :icon="faStar" class="w-4 h-4 text-amber-400" />
          </p>
          <p class="text-xs text-muted mt-1">Basado en {{ calificaciones.length }} calificaci{{ calificaciones.length === 1 ? 'ón' : 'ones' }}</p>
        </div>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="solicitudDestacada" class="rounded-2xl bg-amber-50 border border-amber-200 p-6 flex flex-wrap items-center justify-between gap-4 mb-6">
        <div class="flex items-start gap-4 min-w-0">
          <div class="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <FontAwesomeIcon :icon="faBell" class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-400 text-white">Nueva</span>
            <p class="font-semibold text-heading text-sm mt-1">Nueva solicitud disponible</p>
            <p class="text-sm text-heading mt-0.5">{{ tituloSolicitud(solicitudDestacada) }}</p>
            <p class="text-xs text-muted mt-1">Un alumno solicitó tu asesoría por {{ solicitudDestacada.tipo === 'video' ? 'videollamada' : 'chat' }}.</p>
          </div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <button
            @click="aceptar(solicitudDestacada)"
            :disabled="generandoLinkPara === solicitudDestacada.id"
            type="button"
            class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors duration-75"
          >
            {{ generandoLinkPara === solicitudDestacada.id ? 'Generando enlace…' : 'Aceptar' }}
          </button>
          <button
            @click="ignorar(solicitudDestacada)"
            type="button"
            class="px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75"
          >
            Ignorar
          </button>
        </div>
      </div>
    </Transition>

    <div class="rounded-2xl bg-white shadow-card overflow-hidden">
      <div class="flex items-center justify-between px-6 py-5">
        <h2 class="font-bold text-heading flex items-center gap-2">
          <FontAwesomeIcon :icon="faInbox" class="w-4 h-4 text-brand-600" />
          Mis consultas asignadas
        </h2>
        <RouterLink :to="{ name: 'docente-consultas' }" class="text-sm text-brand-600 font-medium hover:underline flex items-center gap-1">
          Ver todas
          <FontAwesomeIcon :icon="faChevronRight" class="w-2.5 h-2.5" />
        </RouterLink>
      </div>

      <p v-if="asignadas.length === 0" class="text-sm text-muted py-10 text-center">Todavía no tienes consultas asignadas.</p>
      <div v-for="s in asignadas" :key="s.id" class="flex items-center gap-4 px-6 py-4 border-t border-gray-50">
        <Avatar :nombre="s.clienteNombre ?? '?'" :fotoUrl="s.clienteFotoUrl" size="w-11 h-11" />

        <div class="w-40 shrink-0 min-w-0">
          <p class="font-semibold text-heading text-sm truncate">{{ s.clienteNombre }}</p>
          <p v-if="s.tipo === 'video' && s.horarioFecha" class="text-xs text-muted mt-0.5 flex items-center gap-1">
            <FontAwesomeIcon :icon="faCalendarDays" class="w-2.5 h-2.5" />
            {{ new Date(`${s.horarioFecha}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) }}
          </p>
          <p v-else class="text-xs text-muted">Solicitado {{ tiempoRelativo(s.creadoEn) }}</p>
        </div>

        <div class="w-40 shrink-0">
          <span class="px-2.5 py-1 rounded-full text-xs font-medium" :class="colorCategoria(s.sectorNombre)">{{ s.sectorNombre ?? '—' }}</span>
        </div>

        <div class="w-32 shrink-0 flex items-center gap-1.5 text-sm text-gray-600">
          <FontAwesomeIcon :icon="s.tipo === 'video' ? faVideo : faComments" class="w-3.5 h-3.5" />
          {{ s.tipo === 'video' ? 'Videollamada' : 'Chat' }}
        </div>

        <div class="w-28 shrink-0">
          <span class="px-2.5 py-1 rounded-full text-[11px] font-medium" :class="ESTADO_CLASE[s.estado]">{{ ESTADO_LABEL[s.estado] }}</span>
        </div>

        <div class="ml-auto shrink-0">
          <button
            v-if="s.estado === 'asignado'"
            @click="chatAbiertoId = s.id"
            type="button"
            class="px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors duration-75 inline-flex items-center gap-1.5"
          >
            <FontAwesomeIcon :icon="faComments" class="w-3 h-3" />
            Responder
          </button>
          <button
            v-else-if="s.estado === 'agendado'"
            @click="unirseALlamada(s)"
            :disabled="!ventanaDeLlamada(s).disponible"
            type="button"
            class="px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors duration-75"
            :class="ventanaDeLlamada(s).disponible ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'"
          >
            <FontAwesomeIcon :icon="faVideo" class="w-3 h-3" />
            Unirse a la llamada
          </button>
          <button
            v-else-if="s.estado === 'completado'"
            @click="resumenAbierto = s"
            type="button"
            class="px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors duration-75 inline-flex items-center gap-1.5"
          >
            <FontAwesomeIcon :icon="faFileLines" class="w-3 h-3" />
            Ver resumen
          </button>
          <span v-else class="text-xs text-muted">{{ s.estado === 'cancelado' ? 'Cancelada' : 'En espera' }}</span>
        </div>
      </div>
    </div>

    <p class="text-xs text-muted text-center mt-6 flex items-center justify-center gap-1.5">
      <FontAwesomeIcon :icon="faCircleInfo" class="w-3 h-3" />
      Los horarios se muestran en tu zona horaria: Lima (GMT-5)
    </p>

    <AsesoriaChatPanel
      v-if="chatAbierto"
      :solicitud="chatAbierto"
      :usuario-actual-id="docenteId"
      :otra-parte-nombre="chatAbierto.clienteNombre ?? 'Cliente'"
      :otra-parte-foto-url="chatAbierto.clienteFotoUrl"
      @close="chatAbiertoId = null"
      @finalizada="chatAbiertoId = null"
    />

    <ResumenConsultaModal :is-open="!!resumenAbierto" :solicitud="resumenAbierto" @close="resumenAbierto = null" />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
