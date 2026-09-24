<script setup lang="ts">
import { ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faGraduationCap, faCheck } from '@/lib/icons';
import { ACCENT_COLORS } from '@/components/ColorPicker.vue';
import ColorPicker from '@/components/ColorPicker.vue';
import { useCrearCurso } from '@/composables/useCursos';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ close: [] }>();

const ui = useUiStore();
const crearCurso = useCrearCurso();

const nombre = ref('');
const color = ref(ACCENT_COLORS[0]);

function reset() {
  nombre.value = '';
  color.value = ACCENT_COLORS[0];
}

watch(
  () => props.isOpen,
  (open) => {
    if (!open) reset();
  },
);

async function handleSubmit() {
  if (!nombre.value.trim() || crearCurso.isPending.value) return;
  try {
    await crearCurso.mutateAsync({ nombre: nombre.value.trim(), colorAccent: color.value });
    ui.toast(`Curso "${nombre.value.trim()}" creado`);
    emit('close');
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo crear el curso', 'error');
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-md" @click.stop>
          <div class="flex items-start justify-between p-6 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faGraduationCap" class="w-4 h-4" />
              </div>
              <div>
                <h2 class="text-lg font-bold text-heading">Nuevo curso</h2>
                <p class="text-sm text-muted">Para categorizar a los clientes-alumnos</p>
              </div>
            </div>
            <button @click="emit('close')" type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100 shrink-0">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <div class="px-6 pb-6 space-y-5">
            <div>
              <label class="block text-sm font-medium text-heading mb-1.5">
                Nombre <span class="text-red-500">*</span>
              </label>
              <input
                v-model="nombre"
                type="text"
                placeholder="Ej. Formulación de Proyectos"
                class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                @keydown.enter="handleSubmit"
              />
            </div>

            <ColorPicker :value="color" @update:value="color = $event" />

            <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button @click="emit('close')" type="button" class="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75">
                Cancelar
              </button>
              <button
                @click="handleSubmit"
                :disabled="!nombre.trim() || crearCurso.isPending.value"
                type="button"
                class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center gap-2"
              >
                <FontAwesomeIcon :icon="faCheck" class="w-3.5 h-3.5" />
                {{ crearCurso.isPending.value ? 'Creando…' : 'Crear curso' }}
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
