<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { useUiStore } from '@/stores/ui';
import { useSessionStore } from '@/stores/session';
import { useInvalidarMisBeneficios } from '@/composables/useBeneficios';
import Sidebar from '@/components/Sidebar.vue';

const ui = useUiStore();
const session = useSessionStore();
const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const invalidarMisBeneficios = useInvalidarMisBeneficios();

// Stripe Checkout siempre vuelve a la raíz del sitio (ver PagosController::checkout/checkoutPlan/
// checkoutAddon), no necesariamente a Ajustes → Facturación — este layout es lo único que está
// montado sin importar en qué página caiga la redirección, así que el aviso vive acá.
onMounted(() => {
  const beneficio = route.query.beneficio_checkout;
  const facturacion = route.query.facturacion_checkout;
  if (beneficio !== 'success' && beneficio !== 'cancel' && facturacion !== 'success' && facturacion !== 'cancel') return;

  if (beneficio === 'success') {
    ui.toast('¡Beneficio comprado! Ya debería estar activo.');
    if (session.sesion) invalidarMisBeneficios(session.sesion.usuarioId);
  } else if (beneficio === 'cancel') {
    ui.toast('Compra cancelada — no se realizó ningún cargo.', 'error');
  } else if (facturacion === 'success') {
    ui.toast('¡Listo! Tu plan/add-on ya debería estar activo.');
    if (session.sesion) queryClient.invalidateQueries({ queryKey: ['facturacion', session.sesion.usuarioId] });
  } else if (facturacion === 'cancel') {
    ui.toast('Compra cancelada — no se realizó ningún cargo.', 'error');
  }

  const resto = { ...route.query };
  delete resto.beneficio_checkout;
  delete resto.facturacion_checkout;
  router.replace({ query: resto });
});
</script>

<template>
  <div class="min-h-screen bg-page bg-[url('/bg-cont.webp')] bg-cover bg-top bg-no-repeat bg-fixed">
    <Sidebar :collapsed="ui.sidebarCollapsed" @toggle="ui.toggleSidebar" />

    <main
      class="min-h-screen transition-[margin-left] duration-150 ease-out"
      :class="ui.sidebarCollapsed ? 'ml-16' : 'ml-56'"
    >
      <RouterView />
    </main>
  </div>
</template>
