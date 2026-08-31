<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faXmark, faStar, faComments, faVideo, faCheck, faCheckDouble, faFileLines, faDownload, faSpinner,
} from '@/lib/icons';
import Avatar from '@/components/Avatar.vue';
import { colorCategoria, formatFechaHoraVideo } from '@/lib/consultaAsesorUI';
import { formatHora } from '@/lib/tiempoRelativo';
import { abrirArchivoUrl } from '@/lib/fetchBinario';
import { useMensajesQuery } from '@/composables/useAsesoria';
import { useUiStore } from '@/stores/ui';
import type { SolicitudAsesoria } from '@/types';

// Resumen de solo lectura de una consulta. Dos variantes:
// - Chat ya completado: "Historial de asesoría" — la conversación real (solo lectura, sin poder
//   escribir) más el panel de detalles a la derecha. Pedido explícito del usuario, sin "Duración
//   total" porque el sistema no trackea esa información hoy.
// - Cualquier otro caso (video, o todavía no completada): el resumen chico de siempre — mensaje
//   inicial del alumno y, si ya terminó, su calificación.
const props = defineProps<{ isOpen: boolean; solicitud: SolicitudAsesoria | null; usuarioActualId: string; clienteCorreo?: string | null }>();
const emit = defineEmits<{ close: [] }>();

const esHistorialChat = computed(() => !!props.solicitud && props.solicitud.estado === 'completado' && props.solicitud.tipo === 'chat');

const solicitudIdParaMensajes = computed(() => (props.isOpen && esHistorialChat.value ? props.solicitud!.id : null));
const { data: mensajes } = useMensajesQuery(solicitudIdParaMensajes, () => props.usuarioActualId);

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
  const lista = mensajes.value ?? [];
  let fechaAnterior: string | null = null;
  return lista.map((m) => {
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

// Chat no tiene horarioFecha/horarioHoraInicio (eso es solo de videollamada agendada) — el rango
// mostrado sale de cuándo se creó la solicitud (primer mensaje) hasta que se finalizó.
function formatFechaHoraChat(s: SolicitudAsesoria): string {
  const fecha = new Date(s.creadoEn).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  const desde = new Date(s.creadoEn).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
  const hasta = s.actualizadoEn ? new Date(s.actualizadoEn).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' }) : null;
  return hasta ? `${fecha} · ${desde} - ${hasta}` : fecha;
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen && solicitud" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <!-- Historial de asesoría (chat completado) -->
      <div v-if="esHistorialChat" class="bg-white rounded-2xl shadow-modal w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden" @click.stop>
        <div class="flex items-start justify-between gap-3 p-5 bg-gradient-to-r from-sidebar to-brand-800">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-white text-brand-600 flex items-center justify-center shrink-0">
              <FontAwesomeIcon :icon="faComments" class="w-4 h-4" />
            </div>
            <div>
              <h2 class="text-lg font-bold text-white leading-tight">Historial de asesoría</h2>
              <p class="text-sm text-white/60 mt-0.5">Revisa la conversación y los detalles de esta asesoría.</p>
            </div>
          </div>
          <button @click="emit('close')" type="button" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors duration-100 shrink-0">
            <FontAwesomeIcon :icon="faXmark" />
          </button>
        </div>

        <div class="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 flex-wrap">
          <div class="flex items-center gap-3 min-w-0">
            <Avatar :nombre="solicitud.clienteNombre ?? '?'" :fotoUrl="solicitud.clienteFotoUrl" size="w-10 h-10" />
            <div class="min-w-0">
              <p class="font-semibold text-heading text-sm truncate">{{ solicitud.clienteNombre }}</p>
              <p v-if="clienteCorreo" class="text-xs text-muted truncate">{{ clienteCorreo }}</p>
            </div>
          </div>
          <div class="flex items-center gap-6 text-xs shrink-0">
            <div>
              <p class="text-muted font-medium mb-0.5">Categoría</p>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-medium" :class="colorCategoria(solicitud.sectorNombre)">{{ solicitud.sectorNombre ?? '—' }}</span>
            </div>
            <div>
              <p class="text-muted font-medium mb-0.5">Modalidad</p>
              <span class="flex items-center gap-1.5 text-heading font-medium"><FontAwesomeIcon :icon="faComments" class="w-3 h-3" /> Chat</span>
            </div>
            <div>
              <p class="text-muted font-medium mb-0.5">Fecha</p>
              <span class="text-heading font-medium">{{ new Date(solicitud.creadoEn).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) }}</span>
            </div>
          </div>
        </div>

        <div class="flex-1 min-h-0 flex overflow-hidden">
          <div class="flex-1 min-w-0 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
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
            <p v-if="(mensajes ?? []).length === 0" class="text-xs text-gray-400 text-center pt-4">Esta conversación no tiene mensajes.</p>
            <p class="flex justify-center pt-1">
              <span class="text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full px-3 py-1">
                Asesoría finalizada por el asesor · {{ solicitud.actualizadoEn ? formatHora(solicitud.actualizadoEn) : '' }}
              </span>
            </p>
          </div>

          <div class="w-64 shrink-0 border-l border-gray-100 overflow-y-auto p-5 space-y-4">
            <h3 class="text-sm font-bold text-heading">Detalles de la asesoría</h3>

            <div>
              <p class="text-[11px] font-medium text-muted mb-1">Estado</p>
              <span class="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">Completado</span>
            </div>
            <div>
              <p class="text-[11px] font-medium text-muted mb-1">Fecha y hora</p>
              <p class="text-sm text-heading">{{ formatFechaHoraChat(solicitud) }}</p>
            </div>
            <div>
              <p class="text-[11px] font-medium text-muted mb-1">Solicitado por</p>
              <div class="flex items-center gap-2">
                <Avatar :nombre="solicitud.clienteNombre ?? '?'" :fotoUrl="solicitud.clienteFotoUrl" size="w-6 h-6" />
                <div class="min-w-0">
                  <p class="text-sm text-heading truncate">{{ solicitud.clienteNombre }}</p>
                  <p v-if="clienteCorreo" class="text-[11px] text-muted truncate">{{ clienteCorreo }}</p>
                </div>
              </div>
            </div>
            <div>
              <p class="text-[11px] font-medium text-muted mb-1">Categoría</p>
              <span class="px-2.5 py-1 rounded-full text-[11px] font-medium" :class="colorCategoria(solicitud.sectorNombre)">{{ solicitud.sectorNombre ?? '—' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Resumen chico (pendiente sin aceptar, o completada de videollamada) -->
      <div v-else class="bg-white rounded-2xl shadow-modal w-full max-w-sm p-6 relative" @click.stop>
        <button
          @click="emit('close')"
          type="button"
          class="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100"
        >
          <FontAwesomeIcon :icon="faXmark" />
        </button>

        <div class="flex items-center gap-3 mb-4">
          <Avatar :nombre="solicitud.clienteNombre ?? '?'" :fotoUrl="solicitud.clienteFotoUrl" size="w-11 h-11" />
          <div class="min-w-0">
            <p class="font-semibold text-heading text-sm truncate">{{ solicitud.clienteNombre }}</p>
            <span class="px-2 py-0.5 rounded-full text-[11px] font-medium" :class="colorCategoria(solicitud.sectorNombre)">{{ solicitud.sectorNombre ?? '—' }}</span>
          </div>
        </div>

        <p v-if="solicitud.tipo === 'video' && solicitud.horarioFecha" class="text-xs text-muted flex items-center gap-1.5 mb-3">
          <FontAwesomeIcon :icon="faVideo" class="w-3 h-3" />
          {{ formatFechaHoraVideo(solicitud) }}
        </p>

        <p v-if="solicitud.mensajeInicial" class="text-sm text-heading bg-gray-50 rounded-lg p-3 leading-relaxed mb-4">
          "{{ solicitud.mensajeInicial }}"
        </p>

        <template v-if="solicitud.estado === 'completado'">
          <div v-if="solicitud.calificacion" class="border-t border-gray-100 pt-4">
            <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-2">Calificación del alumno</p>
            <div class="flex items-center gap-1">
              <FontAwesomeIcon v-for="n in 5" :key="n" :icon="faStar" class="w-4 h-4" :class="n <= solicitud.calificacion ? 'text-amber-400' : 'text-gray-200'" />
            </div>
            <p v-if="solicitud.calificacionComentario" class="text-sm text-muted mt-2 italic">"{{ solicitud.calificacionComentario }}"</p>
          </div>
          <p v-else class="text-xs text-muted border-t border-gray-100 pt-4">El alumno todavía no calificó esta consulta.</p>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
