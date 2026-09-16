<script setup lang="ts">
import { computed } from 'vue';
import { faHouse, faLayerGroup, faFileAlt, faPencil, faComments, faUserCheck, faClock } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import StatCard from '@/components/StatCard.vue';
import QuickAccessItem from './QuickAccessItem.vue';
import ActivityFeed from './ActivityFeed.vue';
import { useMetricas } from '@/composables/useMetricas';
import { useSessionStore } from '@/stores/session';
import { useDashboardAsesoriaQuery, useTicketsAsesoriaQuery } from '@/composables/useTicketsAsesoria';
import { useUsuariosQuery } from '@/composables/useUsuarios';

const metricas = useMetricas();
const session = useSessionStore();
const primerNombre = computed(() => session.sesion?.nombre.split(' ')[0] ?? '');

// Manual de diseño v1.0: badge de rol sólido en la esquina del hero. Solo superusuario y
// coordinador (administrativo_asesorias) tienen uno definido — "administrador" no lo tiene en el
// manual, se deja sin badge.
const BADGE_ROL: Partial<Record<string, { label: string; clase: string }>> = {
  superusuario: { label: 'SUPERUSUARIO', clase: 'bg-warning' },
  administrativo_asesorias: { label: 'COORDINADOR', clase: 'bg-ai-blue' },
};
const badgeRol = computed(() => (session.sesion ? BADGE_ROL[session.sesion.rol] : undefined));
const esCoordinador = computed(() => session.sesion?.rol === 'administrativo_asesorias');

// --- KPIs del coordinador — todos reales, ninguno inventado. El manual también pide
//     "Satisfacción 4.8★" pero no hay ninguna fuente de calificaciones en la app todavía, así que
//     se omite en vez de mostrar un número inventado. Tampoco hay presencia en vivo por asesor:
//     "asesores en línea" se aproxima con `disponible` (el mismo toggle real de Mis consultas). ---
const { data: dashboardAsesoria } = useDashboardAsesoriaQuery();
const { data: ticketsData } = useTicketsAsesoriaQuery();
const { data: usuariosData } = useUsuariosQuery();

const asesoresEnLinea = computed(() => (usuariosData.value ?? []).filter((u) => u.rol === 'asesor' && u.disponible).length);
const HORA_MS = 60 * 60_000;
const porVencerSla = computed(() =>
  (ticketsData.value ?? []).filter((s) => {
    if (s.estado !== 'pendiente' || !s.slaVenceEn) return false;
    const restante = new Date(s.slaVenceEn).getTime() - Date.now();
    return restante > 0 && restante <= HORA_MS;
  }).length,
);
</script>

<template>
  <PageShell
    :icon="faHouse"
    :title="`Bienvenido/a, ${primerNombre}`"
    :description="esCoordinador
      ? 'Gestiona la agenda de asesores y la cobertura de consultas en tiempo real.'
      : 'Administra los sectores, plantillas y ejemplos que alimentan el asistente de formulación.'"
  >
    <template v-if="badgeRol" #actions>
      <span class="text-[11px] font-bold tracking-wide text-white px-3 py-1.5 rounded-full" :class="badgeRol.clase">
        {{ badgeRol.label }}
      </span>
    </template>

    <template v-if="esCoordinador" #stats>
      <StatCard :icon="faComments" :value="dashboardAsesoria?.completadosHoy ?? 0" label="Consultas atendidas hoy" color="#16A34A" />
      <StatCard :icon="faUserCheck" :value="asesoresEnLinea" label="Asesores disponibles ahora" color="#38B6FF" />
      <StatCard :icon="faClock" :value="porVencerSla" label="Por vencer SLA (< 1h)" color="#F59E0B" />
      <StatCard :icon="faPencil" :value="dashboardAsesoria?.pendientes ?? 0" label="Pendientes por asignar" color="#EF4444" />
    </template>
    <template v-else #stats>
      <StatCard :icon="faLayerGroup" :value="metricas.totalSectores" label="Sectores activos" color="#0d9488" />
      <StatCard :icon="faFileAlt" :value="metricas.totalPlantillas" label="Plantillas creadas" color="#2563eb" />
      <StatCard :icon="faPencil" :value="metricas.totalEjemplos" label="Ejemplos cargados" color="#d97706" />
    </template>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">
      <div class="lg:col-span-3">
        <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-4">Accesos directos</h3>
        <div v-if="esCoordinador" class="space-y-3">
          <QuickAccessItem
            :icon="faComments"
            icon-color="#38B6FF"
            icon-bg="#dbeefe"
            title="Tickets de asesoría"
            :description="`${dashboardAsesoria?.pendientes ?? 0} pendientes por asignar`"
            to="/asesoria/tickets"
          />
          <QuickAccessItem
            :icon="faLayerGroup"
            icon-color="#F59E0B"
            icon-bg="#fef3c7"
            title="Cobertura de horarios"
            description="Mapa de calor de cobertura por sector y horario"
            to="/asesoria/cobertura-horarios"
          />
          <QuickAccessItem
            :icon="faUserCheck"
            icon-color="#16A34A"
            icon-bg="#dcfce7"
            title="Docentes"
            :description="`${asesoresEnLinea} disponible${asesoresEnLinea === 1 ? '' : 's'} ahora`"
            to="/asesoria/docentes"
          />
        </div>
        <div v-else class="space-y-3">
          <QuickAccessItem
            :icon="faLayerGroup"
            icon-color="#0d9488"
            icon-bg="#ccfbf1"
            title="Sectores"
            description="6 sectores · agrupan las plantillas por ámbito del Estado"
            to="/sectores"
          />
          <QuickAccessItem
            :icon="faFileAlt"
            icon-color="#2563eb"
            icon-bg="#dbeafe"
            title="Plantillas"
            description="Fichas técnicas 6A, 6B y formatos sectoriales"
            to="/sectores"
          />
          <QuickAccessItem
            :icon="faPencil"
            icon-color="#d97706"
            icon-bg="#fef3c7"
            title="Ejemplos cargados"
            description="Casos resueltos que alimentan el contexto de la IA"
            to="/sectores"
          />
        </div>
      </div>
      <div class="lg:col-span-2">
        <ActivityFeed />
      </div>
    </div>
  </PageShell>
</template>
