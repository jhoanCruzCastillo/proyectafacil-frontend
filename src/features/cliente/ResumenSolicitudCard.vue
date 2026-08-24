<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faComments, faVideo, faCalendarDays } from '@/lib/icons';
import { colorCategoria, formatFechaHoraVideo } from '@/lib/consultaAsesorUI';
import { ESTADO_ASESORIA_LABEL as ESTADO_LABEL, ESTADO_ASESORIA_CLASE as ESTADO_CLASE } from '@/lib/estadoAsesoria';
import type { SolicitudAsesoria } from '@/types';

// Tarjeta "Resumen de tu consulta" — compartida entre la confirmación al enviar (ConsultaEnviadaModal)
// y el "Ver detalle" de una consulta ya existente en Mis consultas (AsesoriasPage), para que ambas
// vistas muestren exactamente la misma información (ticket, categoría, estado, horario agendado).
defineProps<{ solicitud: SolicitudAsesoria }>();
</script>

<template>
  <div class="rounded-xl bg-gray-50 p-5">
    <p class="text-sm font-semibold text-heading mb-3">Resumen de tu consulta</p>
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-lg bg-white text-brand-600 flex items-center justify-center shrink-0 shadow-sm">
          <FontAwesomeIcon :icon="solicitud.tipo === 'video' ? faVideo : faComments" class="w-3.5 h-3.5" />
        </div>
        <div>
          <p class="text-xs text-muted">Ticket N.°</p>
          <p class="font-semibold text-heading text-sm">#{{ solicitud.id }}</p>
        </div>
      </div>
      <div>
        <p class="text-xs text-muted mb-1">Categoría</p>
        <span class="px-2.5 py-1 rounded-full text-xs font-medium" :class="colorCategoria(solicitud.sectorNombre)">{{ solicitud.sectorNombre ?? '—' }}</span>
      </div>
      <div>
        <p class="text-xs text-muted mb-1">Estado actual</p>
        <span class="px-2.5 py-1 rounded-full text-xs font-medium" :class="ESTADO_CLASE[solicitud.estado]">{{ ESTADO_LABEL[solicitud.estado] }}</span>
      </div>
    </div>

    <div v-if="solicitud.tipo === 'video' && solicitud.horarioFecha" class="flex items-center gap-2.5 mt-4 pt-4 border-t border-gray-200">
      <div class="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
        <FontAwesomeIcon :icon="faCalendarDays" class="w-3.5 h-3.5" />
      </div>
      <div>
        <p class="text-xs text-muted">Horario agendado</p>
        <p class="font-semibold text-heading text-sm">{{ formatFechaHoraVideo(solicitud) }}</p>
      </div>
    </div>
  </div>
</template>
