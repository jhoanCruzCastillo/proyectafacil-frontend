<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faXmark, faPaperPlane, faVideo, faArrowUpRightFromSquare, faCircleCheck,
  faPaperclip, faFileLines, faDownload, faSpinner,
} from '@/lib/icons';
import { useMensajesQuery, useEnviarMensaje, useFinalizarSolicitud, useSubirAdjuntoChat } from '@/composables/useAsesoria';
import { useUsuariosQuery, useActualizarUsuario } from '@/composables/useUsuarios';
import { useUiStore } from '@/stores/ui';
import Avatar from '@/components/Avatar.vue';
import ResizeHandle from '@/components/ResizeHandle.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import type { SolicitudAsesoria } from '@/types';

// Panel de chat compartido entre cliente y docente para una solicitud de asesoría ya aceptada —
// mismo patrón visual/interacción que AsesorIAChat.vue (panel flotante, lista de mensajes,
// auto-scroll, input+Enter), pero con mensajes reales por polling (useMensajesQuery,
// refetchInterval de 3s — no hay WebSockets en el proyecto) en vez de respuestas simuladas.
const props = defineProps<{
  solicitud: SolicitudAsesoria;
  usuarioActualId: string;
  otraParteNombre: string;
  otraParteFotoUrl?: string | null;
}>();

const emit = defineEmits<{ close: []; finalizada: [] }>();

const ui = useUiStore();
const solicitudId = computed(() => props.solicitud.id);
const { data: mensajes } = useMensajesQuery(solicitudId);
const enviarMensaje = useEnviarMensaje();
const finalizarSolicitud = useFinalizarSolicitud();
const subirAdjunto = useSubirAdjuntoChat();

const input = ref('');
const scrollRef = ref<HTMLElement | null>(null);
const finalizando = ref(false);
const mostrarConfirmarFinalizar = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const subiendoArchivo = ref(false);
const imagenAmpliada = ref<string | null>(null);
// Archivo elegido/soltado pero todavía no enviado — se muestra como miniatura junto al input
// (como en ChatGPT) y recién se sube a Cloudinary cuando se confirma el envío.
const archivoPendiente = ref<File | null>(null);
const previewPendiente = ref<string | null>(null);
// Contador en vez de booleano: dragenter/dragleave se disparan también al pasar sobre hijos
// (mensajes, input, etc.) — solo se oculta el overlay cuando el contador vuelve a 0.
const arrastrandoArchivo = ref(0);

// Tamaño del panel — pedido del usuario: poder agrandarlo tanto de ancho como de alto, y que ese
// tamaño se recuerde como preferencia del usuario (asesor o cliente, quien sea que lo redimensione)
// en vez de resetearse cada vez que abre un chat.
const ANCHO_MIN = 320;
const ANCHO_MAX = 720;
const ALTO_MIN = 380;
const ALTO_MAX = 800;
const panelWidth = ref(384);
const panelHeight = ref(520);

const { data: usuarios } = useUsuariosQuery();
const actualizarUsuario = useActualizarUsuario();
let tamanoCargado = false;
watch(usuarios, (lista) => {
  if (tamanoCargado || !lista) return;
  const yo = lista.find((u) => u.id === props.usuarioActualId);
  if (yo?.chatAnchoPx) panelWidth.value = yo.chatAnchoPx;
  if (yo?.chatAltoPx) panelHeight.value = yo.chatAltoPx;
  tamanoCargado = true;
}, { immediate: true });

// Debounce: mientras se arrastra el handle llegan decenas de deltas por segundo — solo se guarda
// en la BD 500ms después del último movimiento, no en cada frame.
let guardarTamanoTimeout: ReturnType<typeof setTimeout> | undefined;
function guardarTamanoDebounced() {
  clearTimeout(guardarTamanoTimeout);
  guardarTamanoTimeout = setTimeout(() => {
    actualizarUsuario.mutate({
      id: props.usuarioActualId,
      data: { chatAnchoPx: panelWidth.value, chatAltoPx: panelHeight.value },
    });
  }, 500);
}

function onResizeAncho(delta: number) {
  panelWidth.value = Math.min(ANCHO_MAX, Math.max(ANCHO_MIN, panelWidth.value + delta));
  guardarTamanoDebounced();
}
function onResizeAlto(delta: number) {
  // El panel está anclado por abajo (bottom-6) — arrastrar el borde superior hacia arriba (delta
  // negativo) debe agrandarlo, no achicarlo.
  panelHeight.value = Math.min(ALTO_MAX, Math.max(ALTO_MIN, panelHeight.value - delta));
  guardarTamanoDebounced();
}

watch(mensajes, () => {
  nextTick(() => scrollRef.value?.scrollTo({ top: scrollRef.value.scrollHeight, behavior: 'smooth' }));
}, { deep: true });

async function enviar() {
  const texto = input.value.trim();
  const archivo = archivoPendiente.value;
  if (!texto && !archivo) return;

  input.value = '';
  archivoPendiente.value = null;
  if (previewPendiente.value) URL.revokeObjectURL(previewPendiente.value);
  previewPendiente.value = null;

  if (!archivo) {
    enviarMensaje.mutate({ solicitudId: solicitudId.value, autorId: props.usuarioActualId, texto });
    return;
  }

  subiendoArchivo.value = true;
  try {
    const dataUrl = await leerComoDataUrl(archivo);
    const tipo = archivo.type || 'application/octet-stream';
    const { url } = await subirAdjunto.mutateAsync({ dataUrl, nombre: archivo.name, tipo });
    await enviarMensaje.mutateAsync({
      solicitudId: solicitudId.value,
      autorId: props.usuarioActualId,
      texto,
      adjunto: { url, nombre: archivo.name, tipo },
    });
  } catch (err) {
    ui.toast(err instanceof Error ? err.message : 'No se pudo enviar el archivo', 'error');
  } finally {
    subiendoArchivo.value = false;
  }
}

function handleEnter(e: KeyboardEvent) {
  if (e.key === 'Enter') enviar();
}

async function handleFinalizar() {
  finalizando.value = true;
  await finalizarSolicitud.mutateAsync(solicitudId.value);
  finalizando.value = false;
  emit('finalizada');
}

async function confirmarFinalizar() {
  mostrarConfirmarFinalizar.value = false;
  await handleFinalizar();
}

function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function adjuntarPendiente(file: File) {
  if (previewPendiente.value) URL.revokeObjectURL(previewPendiente.value);
  archivoPendiente.value = file;
  previewPendiente.value = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
}

// Pegar una imagen copiada (Ctrl+V) — el navegador la entrega como un File sin nombre real
// (o "image.png" genérico), así que se arma uno propio a partir de la extensión del mime type.
function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (!item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (!file) continue;
    e.preventDefault();
    const extension = item.type.split('/')[1] ?? 'png';
    const nombre = file.name && file.name !== 'image.png' ? file.name : `pegado-${Date.now()}.${extension}`;
    adjuntarPendiente(new File([file], nombre, { type: file.type }));
    break;
  }
}

function quitarAdjuntoPendiente() {
  if (previewPendiente.value) URL.revokeObjectURL(previewPendiente.value);
  archivoPendiente.value = null;
  previewPendiente.value = null;
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // permite volver a elegir el mismo archivo después
  if (file) adjuntarPendiente(file);
}

function esArrastreDeArchivo(e: DragEvent): boolean {
  return !!e.dataTransfer?.types.includes('Files');
}
function onDragEnter(e: DragEvent) {
  if (!esArrastreDeArchivo(e)) return;
  arrastrandoArchivo.value++;
}
function onDragLeave(e: DragEvent) {
  if (!esArrastreDeArchivo(e)) return;
  arrastrandoArchivo.value = Math.max(0, arrastrandoArchivo.value - 1);
}
function onDrop(e: DragEvent) {
  arrastrandoArchivo.value = 0;
  const file = e.dataTransfer?.files?.[0];
  if (file) adjuntarPendiente(file);
}

function esImagen(tipo?: string | null): boolean {
  return !!tipo && tipo.startsWith('image/');
}
</script>

<template>
  <div
    class="fixed bottom-6 left-64 z-40 flex flex-col"
    :style="{ width: `${panelWidth}px`, height: `${panelHeight}px` }"
  >
    <ResizeHandle axis="y" @resize="onResizeAlto" title="Arrastra para agrandar" />

    <div
      class="relative flex-1 min-h-0 flex bg-white rounded-2xl shadow-modal border border-gray-200 overflow-hidden"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <div v-if="arrastrandoArchivo > 0" class="absolute inset-0 z-10 bg-brand-600/90 flex flex-col items-center justify-center gap-2 pointer-events-none">
        <FontAwesomeIcon :icon="faPaperclip" class="w-6 h-6 text-white" />
        <p class="text-sm font-semibold text-white">Suelta el archivo para enviarlo</p>
      </div>

      <div class="flex-1 min-w-0 flex flex-col">
        <div class="shrink-0 px-4 py-3 bg-brand-600 text-white flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <Avatar :nombre="otraParteNombre" :fotoUrl="otraParteFotoUrl" size="w-7 h-7" />
            <div class="min-w-0">
              <p class="text-sm font-bold leading-tight truncate">{{ otraParteNombre }}</p>
              <p class="text-[10px] text-brand-100 leading-tight">{{ solicitud.tipo === 'video' ? 'Asesoría por videollamada' : 'Asesoría por chat' }}</p>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button
              @click="mostrarConfirmarFinalizar = true"
              :disabled="finalizando"
              type="button"
              class="px-2.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 border border-orange-700 flex items-center gap-1.5 transition-colors duration-75 disabled:opacity-50 text-xs font-medium"
            >
              <FontAwesomeIcon :icon="faCircleCheck" class="w-3.5 h-3.5" />
              Finalizar asesoría
            </button>
            <button @click="emit('close')" type="button" class="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors duration-75 shrink-0">
              <FontAwesomeIcon :icon="faXmark" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <a
          v-if="solicitud.tipo === 'video'"
          :href="solicitud.linkReunion || undefined"
          target="_blank"
          rel="noopener noreferrer"
          class="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold transition-colors"
          :class="solicitud.linkReunion ? 'bg-violet-50 text-violet-700 hover:bg-violet-100 cursor-pointer' : 'bg-gray-50 text-gray-400 pointer-events-none'"
        >
          <FontAwesomeIcon :icon="faVideo" class="w-3 h-3" />
          {{ solicitud.linkReunion ? 'Unirse a la videollamada' : 'Esperando el link de la videollamada…' }}
          <FontAwesomeIcon v-if="solicitud.linkReunion" :icon="faArrowUpRightFromSquare" class="w-2.5 h-2.5" />
        </a>

        <div ref="scrollRef" class="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50">
          <p v-if="solicitud.mensajeInicial" class="text-[11px] text-gray-400 italic text-center px-4">"{{ solicitud.mensajeInicial }}"</p>
          <div
            v-for="m in mensajes ?? []"
            :key="m.id"
            class="flex"
            :class="m.autorId === usuarioActualId ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[85%] rounded-xl px-3 py-2 text-xs space-y-1.5"
              :class="m.autorId === usuarioActualId ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-700'"
            >
              <template v-if="m.adjuntoUrl">
                <img
                  v-if="esImagen(m.adjuntoTipo)"
                  :src="m.adjuntoUrl"
                  :alt="m.adjuntoNombre ?? 'Imagen adjunta'"
                  @click="imagenAmpliada = m.adjuntoUrl!"
                  class="max-w-full max-h-48 rounded-lg cursor-zoom-in block object-cover"
                />
                <a
                  v-else
                  :href="m.adjuntoUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors"
                  :class="m.autorId === usuarioActualId ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-50 hover:bg-gray-100'"
                >
                  <FontAwesomeIcon :icon="faFileLines" class="w-3.5 h-3.5 shrink-0" />
                  <span class="truncate flex-1">{{ m.adjuntoNombre ?? 'Archivo' }}</span>
                  <FontAwesomeIcon :icon="faDownload" class="w-3 h-3 shrink-0" />
                </a>
              </template>
              <p v-if="m.texto">{{ m.texto }}</p>
            </div>
          </div>
          <p v-if="(mensajes ?? []).length === 0" class="text-xs text-gray-400 text-center pt-4">Todavía no hay mensajes — escribe el primero.</p>
        </div>

        <div class="shrink-0 border-t border-gray-100">
          <div v-if="archivoPendiente" class="flex items-center gap-2 px-2 pt-2">
            <div class="relative shrink-0">
              <img v-if="previewPendiente" :src="previewPendiente" alt="" class="w-12 h-12 rounded-lg object-cover border border-gray-200" />
              <div v-else class="w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
                <FontAwesomeIcon :icon="faFileLines" class="w-4 h-4 text-gray-400" />
              </div>
              <button
                @click="quitarAdjuntoPendiente"
                :disabled="subiendoArchivo"
                type="button"
                title="Quitar adjunto"
                class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 hover:bg-gray-900 text-white flex items-center justify-center transition-colors duration-75 disabled:opacity-50"
              >
                <FontAwesomeIcon :icon="faXmark" class="w-2.5 h-2.5" />
              </button>
            </div>
            <span class="text-xs text-gray-500 truncate">{{ archivoPendiente.name }}</span>
          </div>

          <div class="p-2 flex items-center gap-2">
            <input ref="fileInputRef" type="file" class="hidden" @change="onFileSelected" />
            <button
              @click="fileInputRef?.click()"
              :disabled="subiendoArchivo"
              type="button"
              title="Adjuntar archivo"
              class="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex items-center justify-center transition-colors duration-75 shrink-0 disabled:opacity-50"
            >
              <FontAwesomeIcon :icon="faPaperclip" class="w-3.5 h-3.5" />
            </button>
            <input
              v-model="input"
              @keydown="handleEnter"
              @paste="onPaste"
              type="text"
              placeholder="Escribe un mensaje..."
              :disabled="subiendoArchivo"
              class="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50"
            />
            <button
              @click="enviar"
              :disabled="subiendoArchivo || (!input.trim() && !archivoPendiente)"
              type="button"
              class="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition-colors duration-75 shrink-0 disabled:opacity-50"
            >
              <FontAwesomeIcon :icon="subiendoArchivo ? faSpinner : faPaperPlane" class="w-3 h-3" :class="{ 'animate-spin': subiendoArchivo }" />
            </button>
          </div>
        </div>
      </div>

      <ResizeHandle axis="x" @resize="onResizeAncho" title="Arrastra para agrandar" />
    </div>
  </div>

  <Transition name="fade">
    <div v-if="imagenAmpliada" class="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-6" @click="imagenAmpliada = null">
      <button
        @click="imagenAmpliada = null"
        type="button"
        class="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors duration-75"
      >
        <FontAwesomeIcon :icon="faXmark" class="w-4 h-4" />
      </button>
      <img :src="imagenAmpliada" alt="" class="max-w-full max-h-full rounded-lg object-contain" @click.stop />
    </div>
  </Transition>

  <ConfirmModal
    :is-open="mostrarConfirmarFinalizar"
    title="¿Finalizar esta asesoría?"
    message="Se marcará la consulta como completada y ya no podrán seguir escribiéndose por este chat. Esta acción no se puede deshacer."
    confirm-label="Sí, finalizar"
    @confirm="confirmarFinalizar"
    @close="mostrarConfirmarFinalizar = false"
  />
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
