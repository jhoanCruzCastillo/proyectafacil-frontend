<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faTriangleExclamation } from '@/lib/icons';

// Fricción intencional para una acción destructiva poco frecuente (docs/proyectafacil-asesorias.md
// §4 Fase 4): el admin debe escribir literalmente "CANCELAR-{ticketId}" antes de poder confirmar.
const props = defineProps<{ isOpen: boolean; ticketId: string }>();
const emit = defineEmits<{ confirm: []; close: [] }>();

const textoEsperado = computed(() => `CANCELAR-${props.ticketId}`);
const textoIngresado = ref('');
const coincide = computed(() => textoIngresado.value.trim() === textoEsperado.value);

watch(() => props.isOpen, (open) => { if (open) textoIngresado.value = ''; });
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-md p-6" @click.stop>
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <FontAwesomeIcon :icon="faTriangleExclamation" class="w-4 h-4" />
            </div>
            <div class="flex-1">
              <h2 class="text-lg font-bold text-heading mb-1">Cancelar ticket #{{ ticketId }}</h2>
              <p class="text-sm text-muted leading-relaxed">
                Esta acción cancela la solicitud y libera la consulta del alumno de vuelta a su saldo disponible. No se puede deshacer.
              </p>
            </div>
          </div>

          <div class="mt-5">
            <label class="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">
              Escribe <span class="font-mono text-heading normal-case">{{ textoEsperado }}</span> para confirmar
            </label>
            <input
              v-model="textoIngresado"
              type="text"
              :placeholder="textoEsperado"
              class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
            />
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <button @click="emit('close')" type="button" class="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75">
              Volver
            </button>
            <button
              @click="emit('confirm')"
              :disabled="!coincide"
              type="button"
              class="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-75"
            >
              Cancelar ticket
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
