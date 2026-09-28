<script setup lang="ts">
import logoIcono from '@/assets/logo-icono.png';
</script>

<template>
  <div class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
    <div class="relative w-[168px] h-[168px]">
      <!-- Anillo base, tenue -->
      <svg viewBox="0 0 100 100" class="absolute inset-0 w-full h-full">
        <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-brand-100)" stroke-width="3" />
      </svg>
      <!-- Arco animado + punto en la punta, gira continuamente -->
      <svg viewBox="0 0 100 100" class="absolute inset-0 w-full h-full pf-loading-spin">
        <g transform="rotate(-90 50 50)">
          <circle
            cx="50" cy="50" r="46" fill="none"
            stroke="var(--color-brand-400)" stroke-width="3" stroke-linecap="round"
            stroke-dasharray="72 288"
          />
          <circle cx="52.3" cy="95.9" r="4" fill="var(--color-brand-400)" />
        </g>
      </svg>
      <!-- Logo, no rota -->
      <img :src="logoIcono" alt="" class="absolute inset-0 m-auto w-[64%] h-[64%] object-contain" />
    </div>

    <div class="mt-6 text-center select-none">
      <!-- 2.8rem = 1.6rem + 75% (pedido explícito). El subtítulo se deja como está: crecer los dos
           en proporción volvía el bloque más alto que el anillo del logo. -->
      <div class="font-heading font-semibold text-[2.8rem] leading-tight">
        <span style="color: var(--color-heading)">Proyecta</span><span class="text-brand-400">Fácil</span>
      </div>
      <p class="text-xs mt-1" style="color: var(--color-muted)">Proyectos de Inversión y Asesorías -by ILPIIE</p>
    </div>
  </div>
</template>

<style scoped>
.pf-loading-spin {
  animation: pf-loading-spin 1.4s linear infinite;
  transform-origin: 50% 50%;
}
@keyframes pf-loading-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .pf-loading-spin {
    animation-duration: 3.5s;
  }
}
</style>
