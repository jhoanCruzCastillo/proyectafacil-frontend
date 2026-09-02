<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck, faCheckDouble, faFileLines, faDownload, faSpinner } from '@/lib/icons';
import { formatHora } from '@/lib/tiempoRelativo';
import { abrirArchivoUrl } from '@/lib/fetchBinario';
import { useUiStore } from '@/stores/ui';
import type { MensajeAsesoria } from '@/types';

// Lista de mensajes de solo lectura — extraído de ResumenConsultaModal.vue ("Historial de
// asesoría" del docente) para que el panel Administrativo pueda mostrar exactamente la misma
// conversación en "Ver detalle" de un ticket de chat, sin duplicar el maquetado de burbujas.
//
// usuarioActualId decide qué lado (derecha/burbuja verde) se resalta como "propio" — el docente
// pasa su propio id; una vista de tercero (administrativo) puede pasar el docenteId de la
// solicitud para mantener la misma convención (docente a la derecha, alumno a la izquierda).
const props = defineProps<{ mensajes: MensajeAsesoria[]; usuarioActualId: string }>();

function etiquetaFecha(fechaIso: string): string {
  const fecha = new Date(fechaIso);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mismoDia(fecha, hoy)) return 'Hoy';
  if (mismoDia(fecha, ayer)) return 'Ayer';
  return fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

const mensajesConDivisor = computed(() => {
  let fechaAnterior: string | null = null;
  return props.mensajes.map((m) => {
    const etiqueta = etiquetaFecha(m.creadoEn);
    const mostrarDivisor = etiqueta !== fechaAnterior;
    fechaAnterior = etiqueta;
    return { mensaje: m, mostrarDivisor, etiquetaFecha: etiqueta };
  });
});

function esImagen(tipo?: string | null): boolean {
  return !!tipo && tipo.startsWith('image/');
}

const ui = useUiStore();
// Los adjuntos que no son imagen pueden venir del proxy S3 con Bearer — un <a href> normal no manda
// el header. abrirArchivoUrl() hace fetch con auth cuando hace falta (ver fetchBinario.ts).
async function abrirAdjunto(url: string, nombre: string | null | undefined) {
  try {
    await abrirArchivoUrl(url, nombre ?? 'archivo');
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo abrir el archivo', 'error');
  }
}

// Las imágenes de Cloudinary a veces tardan en cargar — sin esto aparecían recién cuando
// terminaban, sin ningún indicio de que algo se estaba cargando.
const imagenesCargadas = ref<Record<string, boolean>>({});
</script>

<template>
  <template v-for="{ mensaje: m, mostrarDivisor, etiquetaFecha: etiqueta } in mensajesConDivisor" :key="m.id">
    <div v-if="mostrarDivisor" class="flex justify-center py-1">
      <span class="text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full px-3 py-1">{{ etiqueta }}</span>
    </div>
    <div class="flex" :class="m.autorId === usuarioActualId ? 'justify-end' : 'justify-start'">
      <div
        class="max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed space-y-1.5 shadow-sm"
        :class="m.autorId === usuarioActualId ? 'bg-brand-100 text-heading rounded-br-md' : 'bg-white border border-gray-100 text-gray-700 rounded-bl-md'"
      >
        <template v-if="m.adjuntoUrl">
          <div v-if="esImagen(m.adjuntoTipo)" class="relative">
            <div
              v-if="!imagenesCargadas[m.id]"
              class="w-32 h-32 rounded-lg bg-gray-100 flex items-center justify-center"
            >
              <FontAwesomeIcon :icon="faSpinner" class="w-4 h-4 text-gray-300 animate-spin" />
            </div>
            <img
              :src="m.adjuntoUrl"
              :alt="m.adjuntoNombre ?? 'Imagen adjunta'"
              @load="imagenesCargadas[m.id] = true"
              @error="imagenesCargadas[m.id] = true"
              class="max-w-full max-h-48 rounded-lg block object-cover"
              :class="{ hidden: !imagenesCargadas[m.id] }"
            />
          </div>
          <button
            v-else
            type="button"
            @click="abrirAdjunto(m.adjuntoUrl!, m.adjuntoNombre)"
            class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 bg-white border border-gray-100 hover:bg-gray-50 transition-colors w-full text-left"
          >
            <span class="w-7 h-7 rounded-md bg-red-50 text-red-500 flex items-center justify-center shrink-0">
              <FontAwesomeIcon :icon="faFileLines" class="w-3.5 h-3.5" />
            </span>
            <span class="truncate flex-1 text-gray-700">{{ m.adjuntoNombre ?? 'Archivo' }}</span>
            <FontAwesomeIcon :icon="faDownload" class="w-3 h-3 shrink-0 text-gray-400" />
          </button>
        </template>
        <p v-if="m.texto">{{ m.texto }}</p>
        <div class="flex items-center justify-end gap-1 text-gray-400">
          <span class="text-[10px]">{{ formatHora(m.creadoEn) }}</span>
          <FontAwesomeIcon
            v-if="m.autorId === usuarioActualId"
            :icon="m.leidoEn ? faCheckDouble : faCheck"
            class="w-3 h-3"
            :class="m.leidoEn ? 'text-brand-600' : 'text-gray-400'"
          />
        </div>
      </div>
    </div>
  </template>
  <p v-if="mensajes.length === 0" class="text-xs text-gray-400 text-center pt-4">Esta conversación no tiene mensajes.</p>
</template>
