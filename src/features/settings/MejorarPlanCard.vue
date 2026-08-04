<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faGem, faArrowUpRightFromSquare } from '@/lib/icons';
import PlanesModal from './PlanesModal.vue';
import { useSessionStore } from '@/stores/session';

// Llamado a mejorar de plan que vive al pie del sidebar del cliente, justo encima de las
// notificaciones y el perfil. Abre el mismo PlanesModal que ya se usa desde Facturación — no
// duplica el flujo de cambio de plan, solo le da un acceso visible.
const session = useSessionStore();
const usuarioId = computed(() => session.sesion?.usuarioId ?? '');

const showPlanes = ref(false);
</script>

<template>
  <div class="px-3 pb-3">
    <div class="rounded-xl border border-orange-400/30 bg-orange-500/10 p-3.5">
      <p class="flex items-center gap-2 text-sm font-bold text-white">
        <FontAwesomeIcon :icon="faGem" class="w-4 h-4 text-orange-300" />
        Mejora tu experiencia
      </p>
      <p class="text-[11px] leading-snug text-white/55 mt-1.5">
        Desbloquea más plantillas, formatos y herramientas avanzadas.
      </p>
      <button
        @click="showPlanes = true"
        type="button"
        class="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors duration-75"
      >
        Mejorar mi plan
        <FontAwesomeIcon :icon="faArrowUpRightFromSquare" class="w-3 h-3" />
      </button>
    </div>
  </div>

  <!-- Teleport obligatorio: el <aside> del sidebar lleva un `transform` para animar su
       ocultamiento, y un ancestro transformado convierte `position: fixed` en relativo a él — sin
       esto el modal se renderiza aplastado dentro del ancho del sidebar. Mismo patrón que UserMenu. -->
  <Teleport to="body">
    <PlanesModal :is-open="showPlanes" :usuario-id="usuarioId" @close="showPlanes = false" />
  </Teleport>
</template>
