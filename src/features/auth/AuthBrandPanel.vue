<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck } from '@/lib/icons';
import logoIcono from '@/assets/logo-icono.png';

// Panel izquierdo compartido de login y registro — mock del cliente (split con fondo de grilla,
// marca oficial, bullets y el isotipo decorativo).
const BENEFICIOS = [
  {
    titulo: 'Plantillas oficiales',
    detalle: 'Formatos, fichas técnicas 6A/6B, IOARR y perfiles alineados a Invierte.pe',
  },
  {
    titulo: 'Asistente IA 24/7',
    detalle: 'Elabora y valida tu expediente paso a paso, con lenguaje simple',
  },
  {
    titulo: 'ILPIIE Live incluido',
    detalle: 'Asesoría por chat y videollamada con especialistas mientras estudias',
  },
];
</script>

<template>
  <aside class="auth-brand-panel relative hidden lg:flex flex-col justify-between w-[46%] min-h-screen text-white p-10 xl:p-14 overflow-hidden">
    <div class="relative z-10 flex items-center gap-3.5">
      <img :src="logoIcono" alt="" class="w-16 h-16 object-contain shrink-0 rounded-full" />
      <div>
        <p class="font-heading font-semibold text-3xl leading-tight">
          <span class="text-white">Proyecta</span><span class="text-brand-400">Fácil</span>
        </p>
        <p class="text-[10px] text-white/55 leading-tight mt-0.5">Proyectos de Inversión y Asesorías · by ILPIIE</p>
      </div>
    </div>

    <div class="relative z-10 max-w-md mt-10 mb-8">
      <h1 class="font-heading font-semibold text-[2.05rem] xl:text-[2.45rem] leading-[1.18] tracking-tight mb-3">
        Elabora proyectos de inversión pública, <span class="text-brand-400">fácil</span>
      </h1>
      <p class="text-white/70 text-[0.95rem] leading-relaxed mb-8">
        con el respaldo del ILPIIE y la potencia de la IA.
      </p>
      <ul class="space-y-5">
        <li v-for="b in BENEFICIOS" :key="b.titulo" class="flex items-start gap-3">
          <span class="w-5 h-5 mt-0.5 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
            <FontAwesomeIcon :icon="faCheck" class="w-2.5 h-2.5 text-white" />
          </span>
          <div>
            <p class="text-sm font-semibold text-white leading-snug">{{ b.titulo }}</p>
            <p class="text-[13px] text-white/60 leading-snug mt-0.5">{{ b.detalle }}</p>
          </div>
        </li>
      </ul>
    </div>

    <p class="relative z-10 text-[11px] text-white/40 pr-40">
      © 2026 ProyectaFácil — by ILPIIE · Todos los derechos reservados
    </p>

    <img
      :src="logoIcono"
      alt=""
      class="pointer-events-none select-none absolute bottom-6 right-4 w-36 h-36 xl:w-44 xl:h-44 object-contain rounded-full drop-shadow-lg"
    />
  </aside>
</template>

<style scoped>
.auth-brand-panel {
  background-color: #041628;
  background-image: url('/bg-auth.webp');
  background-size: cover;
  background-position: center;
}
</style>
