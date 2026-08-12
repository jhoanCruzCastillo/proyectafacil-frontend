import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastType = 'success' | 'error';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export const useUiStore = defineStore('ui', () => {
  // Colapsado = el riel se encoge a solo íconos, nunca desaparece del todo (ver Sidebar.vue).
  const sidebarCollapsed = ref(false);
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

  return { sidebarCollapsed, toasts, toast, toggleSidebar };
});
