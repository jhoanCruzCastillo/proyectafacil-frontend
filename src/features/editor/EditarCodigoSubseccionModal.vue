<script setup lang="ts">
import { ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faGear } from '@/lib/icons';
import type { Subseccion } from '@/types';

const props = defineProps<{ isOpen: boolean; subseccion: Subseccion | null }>();
const emit = defineEmits<{ close: []; save: [codigo: string] }>();

const codigo = ref('');

watch(
  () => [props.isOpen, props.subseccion?.id, props.subseccion?.codigo] as const,
  ([open]) => {
    if (open && props.subseccion) codigo.value = props.subseccion.codigo;
  },
  { immediate: true },
);

function guardar() {
  const v = codigo.value.trim();
  if (!v) return;
  emit('save', v);
  emit('close');
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen && subseccion" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-sm" @click.stop>
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <FontAwesomeIcon :icon="faGear" class="w-3.5 h-3.5 text-brand-600" />
              <h2 class="text-sm font-bold text-heading">Identificador de subsección</h2>
            </div>
            <button
              type="button"
              @click="emit('close')"
              class="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100"
            >
              <FontAwesomeIcon :icon="faXmark" class="w-3.5 h-3.5" />
            </button>
          </div>
          <div class="p-5 space-y-3">
            <p class="text-xs text-muted leading-relaxed">
              Código visible de «{{ subseccion.nombre }}» (ej. <span class="font-mono">1.04</span>).
              Al cambiarlo se actualizan los identificadores de sus campos que usen este prefijo.
            </p>
            <div>
              <label class="block text-[10px] font-medium text-muted mb-1">Código</label>
              <input
                v-model="codigo"
                type="text"
                placeholder="Ej. 1.04"
                autofocus
                class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                @keydown.enter.prevent="guardar"
              />
            </div>
            <div class="flex justify-end gap-2 pt-1">
              <button
                type="button"
                @click="emit('close')"
                class="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                :disabled="!codigo.trim()"
                @click="guardar"
                class="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Guardar
              </button>
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
  transform: scale(0.97) translateY(10px);
}
</style>
