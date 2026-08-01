<script setup lang="ts">
import { computed, ref } from 'vue';
import { faMoneyBillTransfer } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import LiquidacionKpis from './LiquidacionKpis.vue';
import LiquidacionHistoricoTab from './LiquidacionHistoricoTab.vue';
import LiquidacionPendienteTab from './LiquidacionPendienteTab.vue';
import LiquidacionMesTab from './LiquidacionMesTab.vue';
import { useSessionStore } from '@/stores/session';
import { useLiquidacionHistoricoQuery, useLiquidacionPendienteQuery, useLiquidacionMesQuery } from '@/composables/useMiLiquidacion';
import { soles } from '@/lib/liquidacionUI';
import type { GranularidadLiquidacion } from '@/types';

const TABS = [
  { value: 'historico', label: 'S/ Atendido todos los tiempos' },
  { value: 'pendiente', label: 'S/ Pendiente de pago' },
  { value: 'mes', label: 'S/ Atendido en el mes' },
] as const;
type Tab = (typeof TABS)[number]['value'];

const session = useSessionStore();
const docenteId = computed(() => session.sesion?.usuarioId ?? '');

const tabActiva = ref<Tab>('historico');
const granularidad = ref<GranularidadLiquidacion>('mes');
// `undefined` = que el backend elija el periodo por defecto (su último mes con actividad).
const anclaHistorico = ref<string | undefined>(undefined);
const anclaMes = ref<string | undefined>(undefined);

const { data: historico, isLoading: cargandoHistorico } = useLiquidacionHistoricoQuery(
  docenteId, granularidad, anclaHistorico, () => tabActiva.value === 'historico',
);
const { data: pendiente, isLoading: cargandoPendiente } = useLiquidacionPendienteQuery(
  docenteId, () => tabActiva.value === 'pendiente',
);
const { data: mes, isLoading: cargandoMes } = useLiquidacionMesQuery(
  docenteId, anclaMes, () => tabActiva.value === 'mes',
);

const kpis = computed(() => {
  if (tabActiva.value === 'pendiente' && pendiente.value) {
    const k = pendiente.value.kpis;
    return [
      { label: 'Consultas por cobrar', valor: k.consultasPorCobrar },
      { label: 'Monto pendiente', valor: soles(k.montoPendiente), tono: 'ambar' as const },
      { label: 'Consulta más antigua', valor: `${k.diasMasAntigua} días` },
      { label: 'Tarifa por consulta', valor: soles(k.tarifaPorConsulta) },
    ];
  }
  if (tabActiva.value === 'mes' && mes.value) {
    const k = mes.value.kpis;
    return [
      { label: 'Consultas este mes', valor: k.consultasDelMes },
      { label: 'Ingreso del mes', valor: soles(k.ingresoDelMes), tono: 'verde' as const },
      { label: 'Videollamadas', valor: k.videollamadas },
      { label: 'Chats', valor: k.chats },
    ];
  }
  if (historico.value) {
    const k = historico.value.kpis;
    return [
      { label: 'Consultas atendidas', valor: k.consultasAtendidas },
      { label: 'Ingreso histórico', valor: soles(k.ingresoHistorico) },
      { label: 'Promedio mensual', valor: soles(k.promedioMensual) },
      { label: 'Pagado a la fecha', valor: soles(k.pagadoALaFecha), tono: 'verde' as const },
    ];
  }
  return [];
});

// El gráfico devuelve la clave del bucket ('2026-07', '2026', '15'…); se traduce a una fecha ancla
// porque es lo único que entiende el backend, sea cual sea la granularidad.
function seleccionarPeriodo(clave: string) {
  if (granularidad.value === 'mes') anclaHistorico.value = `${clave}-01`;
  else if (granularidad.value === 'anio') anclaHistorico.value = `${clave}-01-01`;
  else if (granularidad.value === 'semana') anclaHistorico.value = clave;
  else if (historico.value) anclaHistorico.value = `${historico.value.periodo.slice(0, 8)}${clave.padStart(2, '0')}`;
}

function cambiarGranularidad(g: GranularidadLiquidacion) {
  granularidad.value = g;
  // Se conserva el ancla: cambiar de "Mes" a "Año" debe mostrar el año del mes que estabas viendo.
  anclaHistorico.value = historico.value?.periodo ?? anclaHistorico.value;
}

function moverMes(meses: number) {
  const base = new Date(`${mes.value?.periodo ?? new Date().toISOString().slice(0, 10)}T00:00:00`);
  base.setDate(1);
  base.setMonth(base.getMonth() + meses);
  anclaMes.value = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-01`;
}
</script>

<template>
  <PageShell
    :icon="faMoneyBillTransfer"
    title="Mi Liquidación"
    description="Revisa cuánto has ganado, qué está pendiente de pago y cómo evoluciona tu desempeño."
    content-class="py-5"
    compact
  >
    <template #stats>
      <LiquidacionKpis :items="kpis" />
    </template>

    <div class="px-6 sm:px-8">
      <div class="flex gap-1 border-b border-gray-100 mb-5">
        <button
          v-for="tab in TABS"
          :key="tab.value"
          @click="tabActiva = tab.value"
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-75 flex items-center gap-2"
          :class="tabActiva === tab.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'"
        >
          {{ tab.label }}
          <span
            v-if="tab.value === 'pendiente' && pendiente"
            class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
            :class="tabActiva === tab.value ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'"
          >
            {{ pendiente.kpis.consultasPorCobrar }}
          </span>
        </button>
      </div>

      <template v-if="tabActiva === 'historico'">
        <p v-if="cargandoHistorico || !historico" class="text-sm text-muted py-10 text-center">Cargando…</p>
        <LiquidacionHistoricoTab
          v-else
          :datos="historico"
          :granularidad="granularidad"
          @granularidad="cambiarGranularidad"
          @periodo="seleccionarPeriodo"
        />
      </template>

      <template v-else-if="tabActiva === 'pendiente'">
        <p v-if="cargandoPendiente || !pendiente" class="text-sm text-muted py-10 text-center">Cargando…</p>
        <LiquidacionPendienteTab v-else :datos="pendiente" />
      </template>

      <template v-else>
        <p v-if="cargandoMes || !mes" class="text-sm text-muted py-10 text-center">Cargando…</p>
        <LiquidacionMesTab v-else :datos="mes" @mover="moverMes" />
      </template>
    </div>
  </PageShell>
</template>
