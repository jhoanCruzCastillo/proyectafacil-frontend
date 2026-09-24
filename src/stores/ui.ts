import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastType = 'success' | 'error';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  /** 0–100 mientras la operación que lo abrió sigue en curso; undefined = toast normal, sin barra */
  progreso?: number;
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
    return id;
  }

  // Toast con barra de progreso para una operación que toma un momento (ej. Guardar) — se abre en
  // 0% y quien la disparó la va empujando con actualizarProgreso(). No se autodescarta solo como el
  // toast normal: su duración real la decide esa operación, no un tiempo fijo.
  function iniciarProgreso(message: string): string {
    const id = crypto.randomUUID();
    toasts.value.push({ id, message, type: 'success', progreso: 0 });
    return id;
  }

  function actualizarProgreso(id: string, progreso: number) {
    const t = toasts.value.find((x) => x.id === id);
    if (t) t.progreso = Math.min(100, Math.max(0, progreso));
  }

  // Cierra el toast de progreso dejándolo mostrar el mensaje final (sin barra) el mismo tiempo que
  // un toast normal — evita el parpadeo de quitar uno y abrir otro en su lugar.
  function completarProgreso(id: string, message: string, type: ToastType = 'success') {
    const t = toasts.value.find((x) => x.id === id);
    if (!t) { toast(message, type); return; }
    t.message = message;
    t.type = type;
    t.progreso = undefined;
    setTimeout(() => {
      toasts.value = toasts.value.filter((x) => x.id !== id);
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
    toast, iniciarProgreso, actualizarProgreso, completarProgreso,
    toggleSidebar, toggleSidebarMobile, closeSidebarMobile,
  };
});
