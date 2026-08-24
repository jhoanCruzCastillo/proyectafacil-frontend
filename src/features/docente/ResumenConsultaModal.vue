<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faStar } from '@/lib/icons';
import Avatar from '@/components/Avatar.vue';
import { colorCategoria } from '@/lib/consultaAsesorUI';
import type { SolicitudAsesoria } from '@/types';

// Resumen de solo lectura de una consulta — mensaje inicial del alumno y, solo cuando ya está
// completada, su calificación (si la dejó). Compartido entre el dashboard (DocenteHomePage) y el
// listado completo (MisConsultasPage) del lado asesor, tanto para "Ver resumen" de una atendida
// como para "Detalles" de una pendiente todavía sin aceptar.
defineProps<{ isOpen: boolean; solicitud: SolicitudAsesoria | null }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen && solicitud" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <div class="bg-white rounded-2xl shadow-modal w-full max-w-sm p-6 relative" @click.stop>
        <button
          @click="emit('close')"
          type="button"
          class="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100"
        >
          <FontAwesomeIcon :icon="faXmark" />
        </button>

        <div class="flex items-center gap-3 mb-4">
          <Avatar :nombre="solicitud.clienteNombre ?? '?'" :fotoUrl="solicitud.clienteFotoUrl" size="w-11 h-11" />
          <div class="min-w-0">
            <p class="font-semibold text-heading text-sm truncate">{{ solicitud.clienteNombre }}</p>
            <span class="px-2 py-0.5 rounded-full text-[11px] font-medium" :class="colorCategoria(solicitud.sectorNombre)">{{ solicitud.sectorNombre ?? '—' }}</span>
          </div>
        </div>

        <p v-if="solicitud.mensajeInicial" class="text-sm text-heading bg-gray-50 rounded-lg p-3 leading-relaxed mb-4">
          "{{ solicitud.mensajeInicial }}"
        </p>

        <template v-if="solicitud.estado === 'completado'">
          <div v-if="solicitud.calificacion" class="border-t border-gray-100 pt-4">
            <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-2">Calificación del alumno</p>
            <div class="flex items-center gap-1">
              <FontAwesomeIcon v-for="n in 5" :key="n" :icon="faStar" class="w-4 h-4" :class="n <= solicitud.calificacion ? 'text-amber-400' : 'text-gray-200'" />
            </div>
            <p v-if="solicitud.calificacionComentario" class="text-sm text-muted mt-2 italic">"{{ solicitud.calificacionComentario }}"</p>
          </div>
          <p v-else class="text-xs text-muted border-t border-gray-100 pt-4">El alumno todavía no calificó esta consulta.</p>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
