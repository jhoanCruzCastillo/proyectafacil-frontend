import { defineStore } from 'pinia';
import { ref } from 'vue';

// Qué chat de asesoría está abierto en el panel flotante — compartido entre el "Responder" de
// Mis consultas y los globos flotantes de chats en curso (MainLayout.vue), para que ambos
// controlen el mismo panel en vez de cada uno montar el suyo.
export const useChatAsesoriaStore = defineStore('chatAsesoria', () => {
  const chatAbiertoId = ref<string | null>(null);

  function abrir(solicitudId: string) {
    chatAbiertoId.value = solicitudId;
  }
  function cerrar() {
    chatAbiertoId.value = null;
  }

  return { chatAbiertoId, abrir, cerrar };
});
