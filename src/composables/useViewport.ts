import { onMounted, onUnmounted, ref } from 'vue';

// Punto de corte "escritorio" — mismo valor que el breakpoint `lg` de Tailwind (1024px). Debajo de
// esto el sidebar pasa de riel fijo redimensionable a drawer superpuesto de ancho completo (ver
// Sidebar.vue / MainLayout.vue) — pedido explícito del cliente: en celular se abre entero, no una
// versión angosta.
const DESKTOP_BREAKPOINT = 1024;

// Ancho fijo del sidebar expandido en escritorio (no redimensionable — pedido explícito del
// cliente) — compartido entre Sidebar.vue (que lo aplica) y MainLayout.vue (que necesita el mismo
// valor para el margen del contenido y el offset de los globos de chat flotantes).
export const SIDEBAR_WIDTH = 330;
export const SIDEBAR_WIDTH_COLLAPSED = 64;

export function useIsDesktop() {
  const isDesktop = ref(window.innerWidth >= DESKTOP_BREAKPOINT);
  function actualizar() {
    isDesktop.value = window.innerWidth >= DESKTOP_BREAKPOINT;
  }
  onMounted(() => window.addEventListener('resize', actualizar));
  onUnmounted(() => window.removeEventListener('resize', actualizar));
  return isDesktop;
}
