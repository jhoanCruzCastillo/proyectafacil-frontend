<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faVideo, faComments, faCheck, faClock, faChevronLeft, faChevronRight, faCalendarDays, faCircleDot } from '@/lib/icons';
import Avatar from '@/components/Avatar.vue';
import BarrasSimple from '@/components/BarrasSimple.vue';
import { colorCategoria } from '@/lib/consultaAsesorUI';
import { soles, fechaHora } from '@/lib/liquidacionUI';
import type { LiquidacionMes } from '@/types';

defineProps<{ datos: LiquidacionMes }>();
const emit = defineEmits<{ mover: [meses: number] }>();
</script>

<template>
  <div class="flex items-center justify-center gap-4 mb-5">
    <button
      @click="emit('mover', -1)"
      type="button"
      class="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-2"
    >
      <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
      Mes anterior
    </button>
    <p class="flex items-center gap-2 text-sm font-bold text-heading">
      <FontAwesomeIcon :icon="faCalendarDays" class="w-3.5 h-3.5 text-muted" />
      {{ datos.periodoLabel }}
    </p>
    <button
      @click="emit('mover', 1)"
      type="button"
      class="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-2"
    >
      Mes siguiente
      <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3" />
    </button>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
    <div class="space-y-5">
      <div class="rounded-xl border border-gray-200 p-4">
        <p class="text-sm font-bold text-heading">Por semana</p>
        <p class="text-xs text-muted mb-2">Consultas atendidas</p>
        <BarrasSimple
          :puntos="datos.porSemana.map((s) => ({ clave: s.etiqueta, etiqueta: s.etiqueta, valor: s.consultas }))"
          :ancho="320"
          :alto="200"
        />
      </div>

      <div class="rounded-xl border border-gray-200 p-4">
        <p class="text-sm font-bold text-heading mb-3">Resumen del mes</p>
        <div class="space-y-2 text-sm">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2 text-gray-600">
              <FontAwesomeIcon :icon="faCircleDot" class="w-3.5 h-3.5 text-gray-400" /> Total de consultas
            </span>
            <span class="font-semibold text-heading">{{ datos.kpis.consultasDelMes }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2 text-gray-600">
              <FontAwesomeIcon :icon="faVideo" class="w-3.5 h-3.5 text-gray-400" /> Videollamadas
            </span>
            <span class="font-semibold text-heading">{{ datos.kpis.videollamadas }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2 text-gray-600">
              <FontAwesomeIcon :icon="faComments" class="w-3.5 h-3.5 text-gray-400" /> Chats
            </span>
            <span class="font-semibold text-heading">{{ datos.kpis.chats }}</span>
          </div>
          <div class="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 mt-1">
            <span class="text-brand-700 font-medium">Ingreso del mes</span>
            <span class="font-bold text-brand-700">{{ soles(datos.kpis.ingresoDelMes) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="lg:col-span-2">
      <p v-if="datos.detalle.length === 0" class="text-sm text-muted py-10 text-center">
        No atendiste consultas en este mes.
      </p>

      <div v-else class="rounded-xl border border-gray-200 overflow-hidden">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="text-left text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
              <th class="py-3 px-4">Alumno</th>
              <th class="py-3 px-4">Categoría</th>
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
                  <div class="min-w-0">
                    <p class="font-semibold text-heading text-sm truncate">{{ d.clienteNombre }}</p>
                    <p class="text-xs text-muted truncate">{{ d.subtemaNombre ?? '—' }}</p>
                  </div>
                </div>
              </td>
              <td class="py-3 px-4">
                <span class="px-2.5 py-1 rounded-full text-xs font-medium" :class="colorCategoria(d.sectorNombre)">
                  {{ d.sectorNombre ?? '—' }}
                </span>
              </td>
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
              <td colspan="4" />
              <td class="py-3 px-4 text-sm font-bold text-heading text-right">Total del mes</td>
              <td class="py-3 px-4 text-right text-lg font-bold text-brand-600 whitespace-nowrap">{{ soles(datos.totalMes) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>
