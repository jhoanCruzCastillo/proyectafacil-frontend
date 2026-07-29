<script setup lang="ts">
import { ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faCircleCheck, faStar, faCalendarCheck } from '@/lib/icons';
import { useCalificarSolicitud } from '@/composables/useAsesoria';
import Avatar from '@/components/Avatar.vue';
import type { SolicitudAsesoria } from '@/types';

// Calificación del alumno al completar (docs/proyectafacil-asesorias.md §4 Fase 5 punto 2) — 5
// estrellas + comentario opcional, aplica igual a chat y videollamada.
const props = defineProps<{ isOpen: boolean; solicitud: SolicitudAsesoria | null }>();
const emit = defineEmits<{ close: [] }>();

const calificarSolicitud = useCalificarSolicitud();
const estrellas = ref(0);
const estrellasHover = ref(0);
const comentario = ref('');

watch(() => props.isOpen, (open) => {
  if (open) {
    estrellas.value = 0;
    estrellasHover.value = 0;
    comentario.value = '';
  }
});

async function enviar() {
  if (!props.solicitud || estrellas.value === 0) return;
  await calificarSolicitud.mutateAsync({ solicitudId: props.solicitud.id, estrellas: estrellas.value, comentario: comentario.value.trim() || undefined });
  emit('close');
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen && solicitud" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-md p-6 text-center relative" @click.stop>
          <button
            @click="emit('close')"
            type="button"
            class="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100"
          >
            <FontAwesomeIcon :icon="faXmark" />
          </button>

          <div class="w-16 h-16 mx-auto rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
            <FontAwesomeIcon :icon="faCircleCheck" class="w-7 h-7" />
          </div>
          <h2 class="text-xl font-bold text-heading mb-1">¿Cómo estuvo tu asesoría?</h2>
          <p class="text-sm text-muted mb-5">Tu opinión nos ayuda a mejorar la calidad del servicio</p>

          <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 text-left mb-5">
            <Avatar :nombre="solicitud.docenteNombre ?? 'Asesor'" :fotoUrl="solicitud.docenteFotoUrl" size="w-9 h-9" />
            <div class="min-w-0">
              <p class="font-semibold text-heading text-sm truncate">{{ solicitud.docenteNombre ?? 'Asesor' }}</p>
              <p class="text-xs text-muted">{{ solicitud.sectorNombre }} · {{ formatFecha(solicitud.actualizadoEn ?? solicitud.creadoEn) }}</p>
            </div>
          </div>

          <div class="flex items-center justify-center gap-2 mb-5">
            <button
              v-for="n in 5"
              :key="n"
              @click="estrellas = n"
              @mouseenter="estrellasHover = n"
              @mouseleave="estrellasHover = 0"
              type="button"
              class="transition-transform duration-75 hover:scale-110"
            >
              <FontAwesomeIcon
                :icon="faStar"
                class="w-9 h-9"
                :class="n <= (estrellasHover || estrellas) ? 'text-amber-400' : 'text-gray-200'"
              />
            </button>
          </div>

          <textarea
            v-model="comentario"
            rows="3"
            placeholder="Cuéntanos más sobre tu experiencia (opcional)"
            class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none mb-5"
          />

          <button
            @click="enviar"
            :disabled="estrellas === 0 || calificarSolicitud.isPending.value"
            type="button"
            class="w-full px-5 py-3 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-75 flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon :icon="faCalendarCheck" class="w-3.5 h-3.5" />
            Enviar calificación
          </button>
          <button @click="emit('close')" type="button" class="mt-3 text-xs text-muted hover:text-heading hover:underline transition-colors">
            Omitir por ahora
          </button>
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
