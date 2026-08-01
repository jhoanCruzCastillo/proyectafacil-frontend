<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faVideo, faComments, faCheck, faClock, faChevronDown } from '@/lib/icons';
import Avatar from '@/components/Avatar.vue';
import BarrasSimple from '@/components/BarrasSimple.vue';
import { colorCategoria } from '@/lib/consultaAsesorUI';
import { soles, fechaHora } from '@/lib/liquidacionUI';
import type { GranularidadLiquidacion, LiquidacionHistorico } from '@/types';

defineProps<{ datos: LiquidacionHistorico; granularidad: GranularidadLiquidacion }>();
const emit = defineEmits<{ granularidad: [g: GranularidadLiquidacion]; periodo: [clave: string] }>();

const OPCIONES: { valor: GranularidadLiquidacion; label: string }[] = [
  { valor: 'dia', label: 'Día' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mes' },
  { valor: 'anio', label: 'Año' },
];

// El eje se muestra en miles ("6k") para no repetir "S/ 6,000" cinco veces en vertical.
function ejeCorto(v: number): string {
  return v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v));
}
</script>

<template>
  <div class="flex items-center justify-between gap-3 flex-wrap mb-5">
    <div class="inline-flex gap-1 bg-gray-100 rounded-lg p-1">
      <button
        v-for="op in OPCIONES"
        :key="op.valor"
        @click="emit('granularidad', op.valor)"
        type="button"
        class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-75"
        :class="granularidad === op.valor ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
      >
        {{ op.label }}
      </button>
    </div>
    <div class="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-heading flex items-center gap-2">
      {{ datos.periodoLabel }}
      <FontAwesomeIcon :icon="faChevronDown" class="w-3 h-3 text-gray-400" />
    </div>
  </div>

  <div class="rounded-xl border border-gray-200 p-5 mb-6">
    <p class="text-sm font-bold text-heading">Ingreso por periodo</p>
    <p class="text-xs text-muted mb-3">En soles (S/) · haz clic en una barra para ver su detalle</p>
    <BarrasSimple
      :puntos="datos.serie.map((s) => ({ clave: s.clave, etiqueta: s.etiqueta, valor: s.monto }))"
      :clave-activa="datos.periodoClave"
      :formato="ejeCorto"
      @seleccionar="(c) => emit('periodo', c)"
    />
  </div>

  <div class="flex items-baseline gap-2 mb-3">
    <h2 class="text-sm font-bold text-heading">Alumnos atendidos en {{ datos.periodoLabel }}</h2>
    <span class="text-xs text-muted">{{ datos.detalle.length }} consultas</span>
  </div>

  <p v-if="datos.detalle.length === 0" class="text-sm text-muted py-8 text-center">
    No atendiste consultas en este periodo.
  </p>

  <div v-else class="rounded-xl border border-gray-200 overflow-hidden">
    <table class="w-full text-sm border-collapse">
      <thead>
        <tr class="text-left text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
          <th class="py-3 px-4">Alumno</th>
          <th class="py-3 px-4">Categoría</th>
          <th class="py-3 px-4">Subtema</th>
          <th class="py-3 px-4">Modalidad</th>
          <th class="py-3 px-4">Fecha de atención</th>
          <th class="py-3 px-4">Estado de pago</th>
          <th class="py-3 px-4 text-right">Monto</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="d in datos.detalle" :key="d.id" class="border-b border-gray-100 last:border-b-0">
          <td class="py-3 px-4">
            <div class="flex items-center gap-3">
              <Avatar :nombre="d.clienteNombre" :fotoUrl="d.clienteFotoUrl" size="w-9 h-9" />
              <p class="font-semibold text-heading text-sm truncate">{{ d.clienteNombre }}</p>
            </div>
          </td>
          <td class="py-3 px-4">
            <span class="px-2.5 py-1 rounded-full text-xs font-medium" :class="colorCategoria(d.sectorNombre)">
              {{ d.sectorNombre ?? '—' }}
            </span>
          </td>
          <td class="py-3 px-4 text-sm text-muted">{{ d.subtemaNombre ?? '—' }}</td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-1.5 text-sm text-gray-600">
              <FontAwesomeIcon :icon="d.tipo === 'video' ? faVideo : faComments" class="w-3.5 h-3.5" />
              {{ d.tipo === 'video' ? 'Videollamada' : 'Chat' }}
            </div>
          </td>
          <td class="py-3 px-4 text-sm text-muted whitespace-nowrap">{{ fechaHora(d.atendidoEn) }}</td>
          <td class="py-3 px-4">
            <span
              class="px-2.5 py-1 rounded-full text-[11px] font-medium inline-flex items-center gap-1.5"
              :class="d.pagado ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'"
            >
              <FontAwesomeIcon :icon="d.pagado ? faCheck : faClock" class="w-2.5 h-2.5" />
              {{ d.pagado ? 'Pagado' : 'Pendiente' }}
            </span>
          </td>
          <td class="py-3 px-4 text-right font-semibold text-heading whitespace-nowrap">{{ soles(d.monto) }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="bg-gray-50">
          <td colspan="5" />
          <td class="py-3 px-4 text-sm font-bold text-heading text-right">Total del periodo</td>
          <td class="py-3 px-4 text-right text-lg font-bold text-brand-600 whitespace-nowrap">{{ soles(datos.totalPeriodo) }}</td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
