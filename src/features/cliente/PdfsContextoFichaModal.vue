<script setup lang="ts">
import { ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faFilePdf } from '@/lib/icons';
import type { ArchivoContextoIA } from '@/api/http/asistenteIA.http';

// Último recurso del chat "ayúdame a llenar/verificar el campo X" (ver AsesorIAChat.vue): cuando ni
// la fuente de la verdad del cliente ni las guías del admin bastan, se le ofrece al usuario la
// misma lista de PDF que el admin cargó en "Contexto general" — pedido explícito del usuario: lista
// a la izquierda, previsualización grande a la derecha.
const props = defineProps<{
  isOpen: boolean;
  archivos: ArchivoContextoIA[];
}>();

const emit = defineEmits<{ close: [] }>();

const seleccionado = ref<ArchivoContextoIA | null>(null);

watch(() => props.isOpen, (abierto) => {
  if (abierto) seleccionado.value = props.archivos[0] ?? null;
});
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-[95vw] h-[95vh] flex flex-col overflow-hidden" @click.stop>
          <div class="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faFilePdf" class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <h2 class="text-base font-bold text-heading truncate">Documentos de referencia de esta ficha</h2>
                <p class="text-xs text-muted">Aquí puedes encontrar más información de cómo llenar el campo</p>
              </div>
            </div>
            <button
              @click="emit('close')"
              type="button"
              class="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100 shrink-0"
              title="Cerrar"
            >
              <FontAwesomeIcon :icon="faXmark" class="w-4 h-4" />
            </button>
          </div>

          <div class="flex-1 min-h-0 flex">
            <div class="w-64 shrink-0 border-r border-gray-100 overflow-y-auto p-2 space-y-1">
              <button
                v-for="a in archivos"
                :key="a.id"
                type="button"
                @click="seleccionado = a"
                class="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-colors duration-75"
                :class="seleccionado?.id === a.id ? 'bg-violet-50 text-violet-700 font-medium' : 'text-gray-600 hover:bg-gray-50'"
              >
                <FontAwesomeIcon :icon="faFilePdf" class="w-3.5 h-3.5 shrink-0" />
                <span class="truncate">{{ a.nombre }}</span>
              </button>
              <p v-if="archivos.length === 0" class="text-xs text-muted p-3">No hay documentos de referencia cargados para esta ficha.</p>
            </div>

            <div class="flex-1 min-w-0 bg-gray-50">
              <iframe v-if="seleccionado" :src="seleccionado.url" :title="seleccionado.nombre" class="w-full h-full border-0" />
              <div v-else class="w-full h-full flex items-center justify-center text-sm text-muted">Selecciona un documento para previsualizarlo</div>
            </div>
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
  transform: scale(0.98) translateY(10px);
}
</style>
