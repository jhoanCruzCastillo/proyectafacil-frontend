<script setup lang="ts">
defineProps<{ filas: [string, string][]; errorEnvio: string }>();
</script>

<template>
  <div class="sec">
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div><div class="section-title">Resumen de tu postulación</div><div class="section-subtitle">Verifica la información antes de enviar</div></div>
      </div>
      <div class="rsm">
        <div v-for="fila in filas" :key="fila[0]" class="it"><b>{{ fila[0] }}</b>{{ fila[1] }}</div>
      </div>
      <div class="err" :class="{ on: !!errorEnvio }">{{ errorEnvio }}</div>
    </div>
  </div>
</template>
