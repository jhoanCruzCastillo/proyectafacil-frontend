<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCircleCheck, faCircleExclamation, faSpinner } from '@/lib/icons';
import { authApi } from '@/api/auth';

const props = defineProps<{ token: string }>();

const estado = ref<'verificando' | 'ok' | 'error'>('verificando');
const mensajeError = ref('');

onMounted(async () => {
  try {
    await authApi.verificarCorreo(props.token);
    estado.value = 'ok';
  } catch (e) {
    mensajeError.value = e instanceof Error ? e.message : 'No se pudo verificar el correo.';
    estado.value = 'error';
  }
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-surface p-6">
    <div class="w-full max-w-sm bg-surface-card rounded-2xl shadow-card p-8 text-center">
      <div v-if="estado === 'verificando'">
        <div class="w-12 h-12 mx-auto rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-4">
          <FontAwesomeIcon :icon="faSpinner" class="w-5 h-5 animate-spin" />
        </div>
        <h2 class="text-lg font-bold text-heading mb-1">Verificando tu correo…</h2>
        <p class="text-sm text-muted">Esto solo toma un momento.</p>
      </div>

      <div v-else-if="estado === 'ok'">
        <div class="w-12 h-12 mx-auto rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mb-4">
          <FontAwesomeIcon :icon="faCircleCheck" class="w-5 h-5" />
        </div>
        <h2 class="text-lg font-bold text-heading mb-2">Cuenta verificada</h2>
        <p class="text-sm text-muted mb-6">Tu correo quedó confirmado. Ya puedes iniciar sesión.</p>
        <RouterLink :to="{ name: 'login' }" class="inline-block w-full py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors duration-75">
          Iniciar sesión
        </RouterLink>
      </div>

      <div v-else>
        <div class="w-12 h-12 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <FontAwesomeIcon :icon="faCircleExclamation" class="w-5 h-5" />
        </div>
        <h2 class="text-lg font-bold text-heading mb-2">No se pudo verificar</h2>
        <p class="text-sm text-muted mb-6">{{ mensajeError }}</p>
        <RouterLink :to="{ name: 'registro' }" class="inline-block w-full py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75">
          Volver a registrarme
        </RouterLink>
      </div>
    </div>
  </div>
</template>
