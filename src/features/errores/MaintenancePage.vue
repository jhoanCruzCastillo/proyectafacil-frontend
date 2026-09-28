<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faScrewdriverWrench, faRotate } from '@/lib/icons';
import { obtenerMensajeMantenimiento } from '@/lib/estadoMantenimiento';
import logoClaro from '@/assets/logo-horizontal-claro.png';

const mensaje = obtenerMensajeMantenimiento();

function reintentar() {
  window.location.reload();
}
</script>

<template>
  <div class="min-h-screen bg-page flex items-center justify-center p-6">
    <div class="w-full max-w-md rounded-3xl bg-surface-card shadow-card p-10 sm:p-12 text-center">
      <img :src="logoClaro" alt="ProyectaFácil" class="h-24 w-auto object-contain mx-auto mb-8" />

      <div class="w-16 h-16 rounded-2xl bg-brand-500/15 text-brand-600 flex items-center justify-center mx-auto mb-6">
        <FontAwesomeIcon :icon="faScrewdriverWrench" class="w-7 h-7" />
      </div>

      <h1 class="font-heading font-semibold text-xl text-heading">Estamos en mantenimiento</h1>
      <p class="text-sm text-muted mt-2 max-w-xs mx-auto whitespace-pre-line">
        {{ mensaje }}
      </p>

      <button
        type="button"
        @click="reintentar"
        class="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
      >
        <FontAwesomeIcon :icon="faRotate" class="w-4 h-4" />
        Reintentar
      </button>
    </div>
  </div>
</template>
