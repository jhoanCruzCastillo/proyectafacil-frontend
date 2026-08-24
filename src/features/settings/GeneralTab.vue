<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck, faSpinner, faCloudArrowUp, faTriangleExclamation, faUser, faIdCard, faEnvelope } from '@/lib/icons';
import { useSessionStore } from '@/stores/session';
import { useUsuariosQuery, useActualizarUsuario } from '@/composables/useUsuarios';
import { useUiStore } from '@/stores/ui';
import { subirImagen } from '@/api/imagenes';
import Avatar from '@/components/Avatar.vue';
import type { TemaPreferencia } from '@/types';

const temaOpciones: { id: TemaPreferencia; label: string }[] = [
  { id: 'claro', label: 'Claro' },
  { id: 'oscuro', label: 'Oscuro' },
  { id: 'sistema', label: 'Sistema' },
];

const session = useSessionStore();
const ui = useUiStore();
const { data: usuariosData } = useUsuariosQuery();
const actualizarUsuario = useActualizarUsuario();
const usuario = computed(() => usuariosData.value?.find((u) => u.id === session.sesion?.usuarioId) ?? null);

const nombre = ref('');
const apodo = ref('');
const correo = ref('');
const tema = ref<TemaPreferencia>('sistema');
const fotoUrl = ref<string | null>(null);

watch(
  usuario,
  (u) => {
    nombre.value = u?.nombre ?? '';
    apodo.value = u?.apodo ?? '';
    correo.value = u?.correo ?? '';
    tema.value = u?.tema ?? 'sistema';
    fotoUrl.value = u?.fotoUrl ?? null;
  },
  { immediate: true },
);

// El correo es obligatorio: es el que se invita a los eventos de Calendar/Meet al agendar una
// videollamada (ver GoogleMeetService) — sin él, esa persona nunca entra directo a la llamada.
const puedeGuardar = computed(() => nombre.value.trim() !== '' && correo.value.trim() !== '');

async function handleGuardar() {
  if (!puedeGuardar.value || !usuario.value) return;
  await actualizarUsuario.mutateAsync({
    id: usuario.value.id,
    data: { nombre: nombre.value.trim(), apodo: apodo.value.trim() || undefined, correo: correo.value.trim(), tema: tema.value },
  });
  session.actualizarNombreSesion(nombre.value.trim());
  ui.toast('Preferencias guardadas');
}

// Subida de avatar: se sube y persiste de inmediato (no espera al botón "Guardar cambios"),
// igual que CampoImagenInput — la foto es un dato independiente del resto del formulario.
const subiendoFoto = ref(false);
const errorFoto = ref('');
const arrastrandoFoto = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

async function subirFoto(file: File) {
  if (!usuario.value) return;
  if (!file.type.startsWith('image/')) {
    errorFoto.value = 'El archivo debe ser una imagen.';
    return;
  }
  errorFoto.value = '';
  subiendoFoto.value = true;
  try {
    const dataUrl = await leerComoDataUrl(file);
    const formato = (file.name.split('.').pop() ?? '').toLowerCase();
    const { url } = await subirImagen(dataUrl, file.name, formato);
    await actualizarUsuario.mutateAsync({ id: usuario.value.id, data: { fotoUrl: url } });
    fotoUrl.value = url;
    ui.toast('Avatar actualizado');
  } catch (e) {
    errorFoto.value = e instanceof Error ? e.message : 'No se pudo subir la imagen.';
  } finally {
    subiendoFoto.value = false;
  }
}

function onDropFoto(e: DragEvent) {
  e.preventDefault();
  arrastrandoFoto.value = false;
  if (subiendoFoto.value) return;
  const file = e.dataTransfer?.files?.[0];
  if (file) subirFoto(file);
}

function onFileInputFoto(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) subirFoto(file);
  input.value = '';
}
</script>

<template>
  <div v-if="session.sesion && usuario" class="space-y-6">
    <div>
      <label class="block text-sm font-medium text-heading mb-2">Avatar</label>
      <div class="flex items-center gap-4">
        <Avatar :nombre="nombre || usuario.nombre" :foto-url="fotoUrl" size="w-16 h-16" />
        <div
          @dragover.prevent="arrastrandoFoto = true"
          @dragleave="arrastrandoFoto = false"
          @drop="onDropFoto"
          @click="!subiendoFoto && fileInput?.click()"
          class="flex-1 rounded-lg border border-dashed px-3 py-3 text-center cursor-pointer transition-colors"
          :class="arrastrandoFoto ? 'border-brand-400 bg-brand-50' : 'border-gray-300 bg-white hover:bg-gray-50'"
        >
          <div v-if="subiendoFoto" class="flex items-center justify-center gap-2 text-xs text-muted">
            <FontAwesomeIcon :icon="faSpinner" class="w-3 h-3 animate-spin" />
            Subiendo imagen…
          </div>
          <div v-else class="flex items-center justify-center gap-2 text-xs text-muted">
            <FontAwesomeIcon :icon="faCloudArrowUp" class="w-3 h-3 text-gray-400" />
            <span>Arrastra una imagen o haz clic para elegir un archivo</span>
          </div>
          <input ref="fileInput" @change="onFileInputFoto" type="file" accept="image/*" class="hidden" />
        </div>
      </div>
      <p v-if="errorFoto" class="mt-1.5 text-[11px] text-red-600 flex items-center gap-1">
        <FontAwesomeIcon :icon="faTriangleExclamation" class="w-2.5 h-2.5 shrink-0" />
        {{ errorFoto }}
      </p>
    </div>

    <div>
      <label class="block text-sm font-medium text-heading mb-1.5">Nombre completo</label>
      <div class="relative">
        <FontAwesomeIcon :icon="faUser" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          v-model="nombre"
          type="text"
          class="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-heading mb-1.5">¿Cómo quieres que te llame?</label>
      <div class="relative">
        <FontAwesomeIcon :icon="faIdCard" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          v-model="apodo"
          type="text"
          :placeholder="nombre.split(' ')[0] || 'Ej. Carlos'"
          class="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-heading mb-1.5">Correo</label>
      <div class="relative">
        <FontAwesomeIcon :icon="faEnvelope" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          v-model="correo"
          type="email"
          placeholder="tucorreo@gmail.com"
          class="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
      </div>
      <p class="text-[11px] text-muted mt-1.5">Usa el correo con el que inicias sesión en Google — así entras directo a la videollamada sin pedir permiso.</p>
    </div>

    <div>
      <label class="block text-sm font-medium text-heading mb-1.5">Preferencia de tema</label>
      <div class="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
        <button
          v-for="op in temaOpciones"
          :key="op.id"
          @click="tema = op.id"
          type="button"
          class="px-4 py-2 text-sm font-medium transition-colors duration-75"
          :class="tema === op.id ? 'bg-brand-50 text-brand-700' : 'bg-white text-gray-500 hover:bg-gray-50'"
        >
          {{ op.label }}
        </button>
      </div>
    </div>

    <div class="pt-4 border-t border-gray-100 flex justify-end">
      <button
        @click="handleGuardar"
        :disabled="!puedeGuardar"
        type="button"
        class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faCheck" class="w-3.5 h-3.5" />
        Guardar cambios
      </button>
    </div>
  </div>
</template>
