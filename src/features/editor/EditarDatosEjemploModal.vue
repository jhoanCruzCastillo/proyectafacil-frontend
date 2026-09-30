<script setup lang="ts">
import { ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faCheck, faPen } from '@/lib/icons';
import type { Ejemplo } from '@/types';

// Editar nombre/subtítulo/detalle DESPUÉS de creado el ejemplo — antes solo se podían fijar al
// crearlo (NuevoEjemploModal), sin forma de corregir un typo o ajustar el título más adelante.
// Modal aparte en vez de reusar NuevoEjemploModal: ese maneja además el flujo de "sin Excel
// asignado" y las tipologías IOARR, que no aplican a editar estos 3 campos. Pedido explícito del
// usuario (2026-09-30).
// `error`: mensaje del último intento fallido de guardar (ver usePlantillaEditor::
// handleActualizarDatosEjemplo) — antes una falla (ej. 500 por exceder el límite de la columna)
// quedaba en silencio: el modal no se cerraba pero tampoco avisaba nada. Encontrado por el usuario
// probando con un subtítulo copiado del nombre calculado del proyecto (más de 200 caracteres,
// el límite real de la columna) — ver `maxlength` en los campos de abajo, que ahora lo evita de raíz.
const props = defineProps<{ isOpen: boolean; ejemplo: Ejemplo | null; error?: string | null }>();
const emit = defineEmits<{ close: []; save: [nombre: string, subtitulo: string, detalle: string] }>();

const nombre = ref('');
const subtitulo = ref('');
const detalle = ref('');

watch(
  () => props.ejemplo,
  (ej) => {
    nombre.value = ej?.nombre ?? '';
    subtitulo.value = ej?.subtitulo ?? '';
    detalle.value = ej?.detalle ?? '';
  },
  { immediate: true },
);

function handleSubmit() {
  if (!nombre.value.trim()) return;
  emit('save', nombre.value.trim(), subtitulo.value.trim(), detalle.value.trim());
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-md" @click.stop>
          <div class="flex items-start justify-between p-6 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center">
                <FontAwesomeIcon :icon="faPen" class="w-4 h-4" />
              </div>
              <div>
                <h2 class="text-lg font-bold text-heading">Editar datos de la ficha</h2>
                <p class="text-sm text-muted">Nombre, subtítulo y detalle del ejemplo</p>
              </div>
            </div>
            <button @click="emit('close')" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <div class="px-6 pb-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-heading mb-1.5">
                Nombre <span class="text-red-500">*</span>
              </label>
              <input
                v-model="nombre"
                type="text"
                placeholder="Ej. I.E. N° 50123 — Wanchaq, Cusco"
                maxlength="200"
                class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                autofocus
              />
              <p class="mt-1 text-right text-xs text-gray-300">{{ nombre.length }}/200</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-heading mb-1.5">Subtítulo</label>
              <input
                v-model="subtitulo"
                type="text"
                placeholder="Ej. Educación inicial"
                maxlength="200"
                class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <p class="mt-1 text-right text-xs text-gray-300">{{ subtitulo.length }}/200</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-heading mb-1.5">Detalle</label>
              <input
                v-model="detalle"
                type="text"
                placeholder="Ej. 365 alumnos"
                maxlength="255"
                class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <p class="mt-1 text-right text-xs text-gray-300">{{ detalle.length }}/255</p>
            </div>

            <p v-if="props.error" class="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {{ props.error }}
            </p>

            <div class="flex justify-end gap-3 pt-2">
              <button @click="emit('close')" class="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75">
                Cancelar
              </button>
              <button
                @click="handleSubmit"
                :disabled="!nombre.trim()"
                class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center gap-2"
              >
                <FontAwesomeIcon :icon="faCheck" class="w-3.5 h-3.5" />
                Guardar cambios
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
