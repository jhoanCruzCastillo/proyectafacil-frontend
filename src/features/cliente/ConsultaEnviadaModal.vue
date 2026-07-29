<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck, faComments, faVideo, faChevronRight, faXmark } from '@/lib/icons';
import { colorCategoria } from '@/lib/consultaAsesorUI';
import { ESTADO_ASESORIA_LABEL as ESTADO_LABEL, ESTADO_ASESORIA_CLASE as ESTADO_CLASE } from '@/lib/estadoAsesoria';
import type { SolicitudAsesoria } from '@/types';

// Confirmación al enviar una consulta (mockup de referencia del usuario) — reemplaza el cierre
// silencioso del modal de solicitud guiada por una pantalla de éxito con el resumen del ticket
// recién creado. "Ver mis consultas" y "Volver a Asesorías" hacen lo mismo (cerrar) cuando ya
// estamos en la página de Asesorías; el FAB de la ficha (otro punto de entrada) navega con
// "Ver mis consultas" en vez de solo cerrar — ver AsesoriaHumanaFAB.vue.
defineProps<{ isOpen: boolean; solicitud: SolicitudAsesoria | null }>();
const emit = defineEmits<{ close: []; verConsultas: [] }>();
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen && solicitud" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-md relative" @click.stop>
          <button
            @click="emit('close')"
            type="button"
            class="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100"
          >
            <FontAwesomeIcon :icon="faXmark" />
          </button>

          <div class="pt-10 pb-6 px-8 text-center">
            <div class="relative w-20 h-20 mx-auto mb-5">
              <span class="absolute -top-1 -left-2 w-2 h-2 rounded-full bg-brand-300" />
              <span class="absolute top-1 -right-3 w-1.5 h-1.5 rounded-full bg-brand-300" />
              <span class="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-sm rotate-45 bg-brand-200" />
              <span class="absolute bottom-0 -left-3 w-1.5 h-1.5 rounded-full bg-brand-200" />
              <div class="w-20 h-20 rounded-full bg-brand-50 flex items-center justify-center">
                <FontAwesomeIcon :icon="faCheck" class="w-8 h-8 text-brand-600" />
              </div>
            </div>

            <h2 class="text-xl font-bold text-heading">¡Tu consulta fue enviada!</h2>
            <p class="text-sm text-muted mt-1.5 leading-relaxed">
              Un docente especializado en <span class="text-brand-700 font-semibold">{{ solicitud.sectorNombre ?? 'tu categoría' }}</span>
              te responderá pronto por {{ solicitud.tipo === 'video' ? 'videollamada' : 'chat' }}.
            </p>
          </div>

          <div class="mx-6 mb-6 rounded-xl bg-gray-50 p-5">
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
          </div>

          <div class="px-6 pb-6 space-y-3">
            <button
              @click="emit('verConsultas')"
              type="button"
              class="w-full px-5 py-3.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors duration-75 flex items-center justify-center gap-2.5"
            >
              <FontAwesomeIcon :icon="faComments" class="w-4 h-4" />
              Ver mis consultas
            </button>
            <button
              @click="emit('close')"
              type="button"
              class="w-full text-sm text-brand-600 font-medium hover:underline flex items-center justify-center gap-1.5"
            >
              Volver a Asesorías
              <FontAwesomeIcon :icon="faChevronRight" class="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </Transition>
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
.pop-enter-active,
.pop-leave-active {
  transition: all 0.12s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.97) translateY(10px);
}
</style>
