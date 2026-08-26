<script setup lang="ts">
import { ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCopy, faCircleCheck, faEnvelope, faCheck } from '@/lib/icons';
import { useEnviarAccesosDirecto } from '@/composables/useUsuarios';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ id: string; usuario: string; password: string; correo?: string }>();
const emit = defineEmits<{ close: [] }>();

const ui = useUiStore();
const enviarAccesosDirecto = useEnviarAccesosDirecto();
const enviado = ref(false);

function copiar() {
  const texto = `Usuario: ${props.usuario}\nContraseña: ${props.password}`;
  navigator.clipboard?.writeText(texto);
  ui.toast('Credenciales copiadas');
}

async function notificarPorCorreo() {
  try {
    await enviarAccesosDirecto.mutateAsync({ id: props.id, password: props.password });
    enviado.value = true;
    ui.toast(`Se notificó a ${props.correo ?? 'el usuario'} por correo`);
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo enviar el correo', 'error');
  }
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

    <button
      v-if="correo"
      @click="notificarPorCorreo"
      type="button"
      :disabled="enviarAccesosDirecto.isPending.value || enviado"
      class="w-full mb-3 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors duration-75 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
      :class="enviado ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60'"
    >
      <FontAwesomeIcon :icon="enviado ? faCheck : faEnvelope" class="w-3.5 h-3.5" />
      {{ enviado ? 'Notificación enviada' : enviarAccesosDirecto.isPending.value ? 'Enviando…' : `Notificar por correo a ${correo}` }}
    </button>

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
