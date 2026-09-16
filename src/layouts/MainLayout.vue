<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faBars } from '@/lib/icons';
import { useUiStore } from '@/stores/ui';
import { useSessionStore } from '@/stores/session';
import { useChatAsesoriaStore } from '@/stores/chatAsesoria';
import { useInvalidarMisBeneficios } from '@/composables/useBeneficios';
import { useIsDesktop, SIDEBAR_WIDTH, SIDEBAR_WIDTH_COLLAPSED } from '@/composables/useViewport';
import { pagosHttp } from '@/api/http/pagos.http';
import { useMisSolicitudesQuery } from '@/composables/useAsesoria';
import Sidebar from '@/components/Sidebar.vue';
import Avatar from '@/components/Avatar.vue';
import AsesoriaChatPanel from '@/features/asesoria/AsesoriaChatPanel.vue';
import logoIcono from '@/assets/logo-icono.png';

const ui = useUiStore();
const session = useSessionStore();
const chatAsesoria = useChatAsesoriaStore();
const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const invalidarMisBeneficios = useInvalidarMisBeneficios();
const isDesktop = useIsDesktop();

// El drawer móvil se cierra solo al navegar — si no, cada link forzaría al usuario a cerrarlo a
// mano después de cada tap.
watch(() => route.path, () => ui.closeSidebarMobile());

// Globos flotantes de chats de asesoría en curso — visibles en cualquier pantalla del docente, no
// solo en "Mis consultas", para que sepa que tiene una conversación esperando sin importar dónde
// esté navegando. "En curso" = `estado === 'asignado'` (chat ya aceptado, todavía no finalizado);
// apenas se finaliza, desaparece solo (la query se invalida al cerrar el panel).
const esAsesor = computed(() => session.sesion?.rol === 'asesor');
const docenteId = computed(() => (esAsesor.value ? session.sesion!.usuarioId : ''));
const { data: solicitudesAsesor } = useMisSolicitudesQuery(docenteId, 'asesor');
const chatsEnCurso = computed(() => (solicitudesAsesor.value ?? []).filter((s) => s.estado === 'asignado'));
const chatAbierto = computed(() => chatsEnCurso.value.find((s) => s.id === chatAsesoria.chatAbiertoId) ?? null);
// El globo de un chat ya abierto en el panel no aporta nada — solo los demás que siguen esperando.
const chatsEnCursoSinAbrir = computed(() => chatsEnCurso.value.filter((s) => s.id !== chatAsesoria.chatAbiertoId));

// Confirma la Checkout Session contra Stripe al volver, SIN esperar al webhook —
// PagosController::webhook() es la fuente de verdad para eventos futuros (renovación,
// cancelación), pero en desarrollo local nunca llega si no corre `stripe listen` en una terminal
// aparte, así que depender solo de él dejaba a cualquiera "sin plan" aunque el cobro sí se hubiera
// hecho (y el toast de acá mentía con un "ya debería estar activo" optimista). `sessionId` puede
// faltar en un link viejo — ahí se asume éxito como antes, sin verificación.
async function confirmarConStripe(sessionId: string): Promise<boolean> {
  try {
    const { ok } = await pagosHttp.verificarCheckout(sessionId);
    return ok;
  } catch {
    // Falla de red/Stripe al verificar: no es lo mismo que "el pago no se confirmó" — no se le
    // dice al usuario que falló, el webhook (si llega) o un refresco más tarde lo reflejan.
    return true;
  }
}

// Stripe Checkout siempre vuelve a la raíz del sitio (ver PagosController::checkout/checkoutPlan/
// checkoutAddon), no necesariamente a Ajustes → Facturación — este layout es lo único que está
// montado sin importar en qué página caiga la redirección, así que el aviso vive acá.
onMounted(async () => {
  const beneficio = route.query.beneficio_checkout;
  const facturacion = route.query.facturacion_checkout;
  if (beneficio !== 'success' && beneficio !== 'cancel' && facturacion !== 'success' && facturacion !== 'cancel') return;

  const sessionId = typeof route.query.session_id === 'string' ? route.query.session_id : '';

  if (beneficio === 'success') {
    const confirmado = sessionId ? await confirmarConStripe(sessionId) : true;
    ui.toast(
      confirmado ? '¡Beneficio comprado! Ya está activo.' : 'Tu pago se está procesando — esto puede tardar unos minutos.',
      confirmado ? 'success' : 'error',
    );
    if (session.sesion) invalidarMisBeneficios(session.sesion.usuarioId);
  } else if (beneficio === 'cancel') {
    ui.toast('Compra cancelada — no se realizó ningún cargo.', 'error');
  } else if (facturacion === 'success') {
    const confirmado = sessionId ? await confirmarConStripe(sessionId) : true;
    ui.toast(
      confirmado ? '¡Listo! Tu plan/add-on ya está activo.' : 'Tu pago se está procesando — esto puede tardar unos minutos.',
      confirmado ? 'success' : 'error',
    );
    if (session.sesion) {
      queryClient.invalidateQueries({ queryKey: ['facturacion', session.sesion.usuarioId] });
      // `tienePlan`/`alumnoVigente` (lo que de verdad desbloquea "Proyectos de Inversión con IA" en
      // el sidebar/portada — ver puedeAccederProyectosIA en lib/permisos.ts) viven en `session.sesion`,
      // no en la query de facturación de arriba — invalidar esa query no los actualiza. Sin este
      // refresco, el pago quedaba confirmado en la base de datos pero la app seguía mostrando todo
      // bloqueado hasta el próximo login.
      if (confirmado) await session.restaurar();
    }
  } else if (facturacion === 'cancel') {
    ui.toast('Compra cancelada — no se realizó ningún cargo.', 'error');
  }

  const resto = { ...route.query };
  delete resto.beneficio_checkout;
  delete resto.facturacion_checkout;
  delete resto.session_id;
  router.replace({ query: resto });
});
</script>

<template>
  <div class="min-h-screen bg-page bg-[url('/bg-cont.webp')] bg-cover bg-top bg-no-repeat bg-fixed">
    <!-- Barra superior móvil (<1024px): en escritorio el riel siempre está a la vista, pero en
         pantallas angostas el sidebar es un drawer oculto por defecto — sin esto no habría forma
         de abrirlo. -->
    <div class="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-sidebar border-b border-white/10 flex items-center gap-3 px-4">
      <button
        @click="ui.toggleSidebarMobile()"
        type="button"
        class="w-9 h-9 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        title="Abrir menú"
      >
        <FontAwesomeIcon :icon="faBars" class="w-4 h-4" />
      </button>
      <img :src="logoIcono" alt="" class="w-7 h-7 object-contain shrink-0" />
      <span class="font-heading font-semibold text-white text-sm truncate">ProyectaFácil</span>
    </div>

    <!-- Telón del drawer móvil — toca afuera para cerrar. -->
    <div
      v-if="ui.sidebarMobileOpen"
      @click="ui.closeSidebarMobile()"
      class="lg:hidden fixed inset-0 z-30 bg-black/50"
    />

    <Sidebar
      :collapsed="ui.sidebarCollapsed"
      :mobile-open="ui.sidebarMobileOpen"
      @toggle="ui.toggleSidebar"
    />

    <main
      class="min-h-screen pt-14 lg:pt-0 transition-[margin-left] duration-150 ease-out"
      :style="isDesktop ? { marginLeft: `${ui.sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH}px` } : undefined"
    >
      <RouterView />
    </main>

    <!-- Globos de chats en curso: pegados al borde derecho del sidebar (nunca encima), apilados
         desde la esquina inferior izquierda hacia arriba. En móvil el sidebar es superpuesto (no
         reserva espacio), así que ahí quedan pegados al borde de la pantalla nomás. -->
    <div
      v-if="chatsEnCursoSinAbrir.length > 0"
      class="fixed bottom-6 z-20 flex flex-col-reverse gap-3 transition-[left] duration-150 ease-out"
      :style="{ left: isDesktop ? `${(ui.sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH) + 12}px` : '16px' }"
    >
      <button
        v-for="s in chatsEnCursoSinAbrir"
        :key="s.id"
        @click="chatAsesoria.abrir(s.id)"
        type="button"
        :title="`${s.clienteNombre ?? 'Alumno'} — consulta en curso, clic para responder`"
        class="relative w-12 h-12 rounded-full shadow-modal hover:scale-105 transition-transform duration-100"
      >
        <span class="absolute inset-0 rounded-full bg-brand-400 animate-ping opacity-75" />
        <Avatar :nombre="s.clienteNombre ?? '?'" :fotoUrl="s.clienteFotoUrl" size="w-12 h-12" class="relative ring-2 ring-white" />
        <span class="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 ring-2 ring-white animate-pulse" />
      </button>
    </div>

    <AsesoriaChatPanel
      v-if="chatAbierto"
      :solicitud="chatAbierto"
      :usuario-actual-id="docenteId"
      :otra-parte-nombre="chatAbierto.clienteNombre ?? 'Cliente'"
      :otra-parte-foto-url="chatAbierto.clienteFotoUrl"
      @close="chatAsesoria.cerrar()"
      @finalizada="chatAsesoria.cerrar()"
    />
  </div>
</template>
