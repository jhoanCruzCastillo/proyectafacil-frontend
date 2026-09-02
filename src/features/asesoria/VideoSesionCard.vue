<script setup lang="ts">
import { computed } from 'vue';

// Reproductor de la grabación de una videollamada de asesoría — extraído de
// TicketDetalleCompletadoModal.vue (panel Administrativo) para que "Ver detalle" del cliente
// muestre exactamente el mismo video de su propia sesión, sin duplicar la lógica de armado del
// embed. Sin lógica de permisos acá: cualquier pantalla que ya tenga el linkGrabacion (el cliente
// lo recibe en su propia SolicitudAsesoria, ver toDtoSolicitud() en el backend) puede usarlo.
const props = defineProps<{ linkGrabacion?: string | null }>();

// El link guardado es el de reproducción (.../file/d/{id}/view) — para embeberlo hace falta la
// variante /preview, que sí funciona dentro de un iframe.
const videoEmbedUrl = computed(() => {
  const id = props.linkGrabacion?.match(/\/file\/d\/([^/]+)/)?.[1];
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
});
</script>

<template>
  <div>
    <h3 class="text-sm font-bold text-heading mb-1">Video de la sesión</h3>
    <p class="text-xs text-muted mb-2">Reproduce la grabación de la videollamada realizada.</p>
    <div class="rounded-xl overflow-hidden border border-gray-200 bg-gray-900 h-80">
      <iframe v-if="videoEmbedUrl" :src="videoEmbedUrl" class="w-full h-full block border-0" allow="autoplay" allowfullscreen />
      <div v-else class="w-full h-full flex items-center justify-center text-center px-4">
        <p class="text-xs text-gray-400">La grabación todavía no está disponible — Google puede tardar en procesarla después de la llamada.</p>
      </div>
    </div>
  </div>
</template>
