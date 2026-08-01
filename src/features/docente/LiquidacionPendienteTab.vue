<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faVideo, faComments, faCircleInfo } from '@/lib/icons';
import Avatar from '@/components/Avatar.vue';
import { colorCategoria } from '@/lib/consultaAsesorUI';
import { soles, fechaCorta, antiguedad, diasDesde } from '@/lib/liquidacionUI';
import type { LiquidacionPendiente } from '@/types';

defineProps<{ datos: LiquidacionPendiente }>();

// A partir de ~15 días de espera se resalta en ámbar: es el punto donde al asesor le vale la pena
// reclamar el pago.
const DIAS_ALERTA = 15;
</script>

<template>
  <div class="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-5 flex items-start gap-2.5">
    <FontAwesomeIcon :icon="faCircleInfo" class="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
    <p class="text-sm text-amber-800">
      El pago de estas consultas lo autoriza el área administrativa. Aquí solo puedes hacer seguimiento.
    </p>
  </div>

  <p v-if="datos.detalle.length === 0" class="text-sm text-muted py-10 text-center">
    No tienes consultas pendientes de pago.
  </p>

  <div v-else class="rounded-xl border border-gray-200 overflow-hidden">
    <table class="w-full text-sm border-collapse">
      <thead>
        <tr class="text-left text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
          <th class="py-3 px-4">Alumno</th>
          <th class="py-3 px-4">Categoría</th>
          <th class="py-3 px-4">Modalidad</th>
          <th class="py-3 px-4">Fecha de atención</th>
          <th class="py-3 px-4">Antigüedad</th>
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
          <td class="py-3 px-4 text-sm text-muted whitespace-nowrap">{{ fechaCorta(d.atendidoEn) }}</td>
          <td class="py-3 px-4 text-sm whitespace-nowrap" :class="diasDesde(d.atendidoEn) >= DIAS_ALERTA ? 'text-amber-600 font-medium' : 'text-muted'">
            {{ antiguedad(d.atendidoEn) }}
          </td>
          <td class="py-3 px-4 text-right font-semibold text-heading whitespace-nowrap">{{ soles(d.monto) }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="bg-gray-50">
          <td colspan="4" />
          <td class="py-3 px-4 text-sm font-bold text-heading text-right">Total pendiente</td>
          <td class="py-3 px-4 text-right text-lg font-bold text-amber-600 whitespace-nowrap">{{ soles(datos.totalPendiente) }}</td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
