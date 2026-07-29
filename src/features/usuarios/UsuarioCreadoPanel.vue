<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCopy, faCircleCheck } from '@/lib/icons';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ usuario: string; password: string }>();
const emit = defineEmits<{ close: [] }>();

const ui = useUiStore();

function copiar() {
  const texto = `Usuario: ${props.usuario}\nContraseña: ${props.password}`;
  navigator.clipboard?.writeText(texto);
  ui.toast('Credenciales copiadas');
}
</script>

<template>
  <div class="p-6 text-center">
    <div class="w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto mb-3">
      <FontAwesomeIcon :icon="faCircleCheck" class="w-5 h-5" />
    </div>
    <h2 class="text-lg font-bold text-heading mb-1">Usuario creado</h2>
    <p class="text-sm text-muted mb-5">Copia estas credenciales — la contraseña no se puede volver a ver después.</p>
    <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 text-left space-y-1.5 mb-5">
      <p class="text-sm"><span class="text-muted">Usuario:</span> <span class="font-mono font-semibold text-heading">{{ usuario }}</span></p>
      <p class="text-sm"><span class="text-muted">Contraseña:</span> <span class="font-mono font-semibold text-heading">{{ password }}</span></p>
    </div>
    <div class="flex gap-3">
      <button @click="copiar" type="button" class="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center justify-center gap-2">
        <FontAwesomeIcon :icon="faCopy" class="w-3.5 h-3.5" />
        Copiar
      </button>
      <button @click="emit('close')" type="button" class="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors duration-75">
        Listo
      </button>
    </div>
  </div>
</template>
