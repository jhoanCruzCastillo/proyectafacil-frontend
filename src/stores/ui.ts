import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastType = 'success' | 'error';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export const useUiStore = defineStore('ui', () => {
  // Colapsado = el riel se encoge a solo íconos, nunca desaparece del todo (ver Sidebar.vue). Ancho
  // fijo (no redimensionable) — la constante vive en composables/useViewport.ts, compartida con
  // MainLayout.vue.
  const sidebarCollapsed = ref(false);
  // En pantallas angostas (<1024px) el sidebar deja de ser un riel fijo y pasa a un drawer
  // superpuesto, oculto por defecto — pedido explícito del cliente: en celular se abre entero.
  const sidebarMobileOpen = ref(false);
  const toasts = ref<ToastItem[]>([]);

  function toast(message: string, type: ToastType = 'success') {
    const id = crypto.randomUUID();
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 2500);
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }
  function toggleSidebarMobile() {
    sidebarMobileOpen.value = !sidebarMobileOpen.value;
  }
  function closeSidebarMobile() {
    sidebarMobileOpen.value = false;
  }

  return {
    sidebarCollapsed, sidebarMobileOpen, toasts,
    toast, toggleSidebar, toggleSidebarMobile, closeSidebarMobile,
  };
});
