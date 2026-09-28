<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faWandMagicSparkles, faPaperclip, faPaperPlane, faDownload, faSpinner,
  faTriangleExclamation, faXmark, faCircleInfo, faFilePdf, faFileExcel, faFileWord, faFileLines,
} from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import CostoConversacionPanel from './CostoConversacionPanel.vue';
import { pruebaIAHttp } from '@/api/http/pruebaIA.http';
import type { ArchivoAdjuntoPrueba, UsoTurno } from '@/api/contracts/pruebaIA';

// Sandbox de prueba, aislado del resto de la app — ver backend/app/Controllers/PruebaIAController.php
// para el porqué (Kimi, el proveedor activo del resto de la app, no tiene Code Interpreter; esto
// llama a OpenAI directo con su propia key). Nada de lo que pasa acá se persiste en BD.

interface MensajeChat {
  rol: 'user' | 'assistant';
  texto: string;
  archivos: ArchivoAdjuntoPrueba[];
}

const EXTENSIONES_PERMITIDAS = ['pdf', 'xlsx', 'xls', 'csv', 'docx', 'txt', 'json', 'png', 'jpg', 'jpeg'];

const mensaje = ref('');
const archivosSeleccionados = ref<File[]>([]);
const historial = ref<MensajeChat[]>([]);
const usos = ref<UsoTurno[]>([]);
const enviando = ref(false);
const errorEnvio = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const scrollAnchor = ref<HTMLElement | null>(null);
let previousResponseId: string | undefined;

const { data: modelosDisponibles } = useQuery({
  queryKey: ['prueba-ia-modelos'],
  queryFn: () => pruebaIAHttp.modelos(),
  staleTime: Infinity, // precios fijos del backend, no hace falta refrescar en la sesión
});
const modeloSeleccionado = ref('');
watch(
  modelosDisponibles,
  (modelos) => {
    if (modelos && modelos.length > 0 && !modeloSeleccionado.value) {
      modeloSeleccionado.value = modelos[0].id;
    }
  },
  { immediate: true },
);

function extensionDe(nombre: string): string {
  return (nombre.split('.').pop() ?? '').toLowerCase();
}

function iconoDe(nombre: string) {
  const ext = extensionDe(nombre);
  if (ext === 'pdf') return faFilePdf;
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return faFileExcel;
  if (ext === 'docx' || ext === 'doc') return faFileWord;
  return faFileLines;
}

function onSeleccionarArchivos(e: Event) {
  const input = e.target as HTMLInputElement;
  const nuevos = Array.from(input.files ?? []).filter((f) => EXTENSIONES_PERMITIDAS.includes(extensionDe(f.name)));
  archivosSeleccionados.value = [...archivosSeleccionados.value, ...nuevos];
  input.value = '';
}

function quitarArchivo(idx: number) {
  archivosSeleccionados.value = archivosSeleccionados.value.filter((_, i) => i !== idx);
}

function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`No se pudo leer "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

async function scrollAlFinal() {
  await nextTick();
  scrollAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

async function enviar() {
  if (enviando.value) return;
  const texto = mensaje.value.trim();
  if (texto === '' && archivosSeleccionados.value.length === 0) return;

  enviando.value = true;
  errorEnvio.value = '';

  try {
    const archivosParaEnviar: ArchivoAdjuntoPrueba[] = await Promise.all(
      archivosSeleccionados.value.map(async (f) => ({ nombre: f.name, dataUrl: await leerComoDataUrl(f) })),
    );

    historial.value.push({ rol: 'user', texto, archivos: archivosParaEnviar });
    mensaje.value = '';
    archivosSeleccionados.value = [];
    void scrollAlFinal();

    const resp = await pruebaIAHttp.chat({ mensaje: texto, archivos: archivosParaEnviar, previousResponseId, modelo: modeloSeleccionado.value });
    previousResponseId = resp.responseId || undefined;
    historial.value.push({ rol: 'assistant', texto: resp.mensaje || '(sin respuesta de texto)', archivos: resp.archivos });
    usos.value.push({ modelo: resp.modelo, usage: resp.usage, costoUsd: resp.costoUsd });
  } catch (e) {
    errorEnvio.value = e instanceof Error ? e.message : 'No se pudo contactar a la IA.';
  } finally {
    enviando.value = false;
    void scrollAlFinal();
  }
}

function nuevaConversacion() {
  historial.value = [];
  usos.value = [];
  previousResponseId = undefined;
  errorEnvio.value = '';
}

function onEnter(e: KeyboardEvent) {
  if (e.shiftKey) return;
  e.preventDefault();
  void enviar();
}
</script>

<template>
  <PageShell
    :icon="faWandMagicSparkles"
    title="Sandbox IA — Code Interpreter"
    description="Playground de prueba: sube PDF/Excel y chatea con la IA, que puede ejecutar código y devolver archivos generados. Usa OpenAI directo, aparte del proveedor activo del resto de la app."
    content-class="p-0"
  >
    <template #actions>
      <select
        v-model="modeloSeleccionado"
        title="Modelo de OpenAI a usar"
        class="px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-sm font-medium text-white/80 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
      >
        <option v-for="m in modelosDisponibles ?? []" :key="m.id" :value="m.id" class="text-heading">
          {{ m.id }} (${{ m.precioEntradaUsdPorMtok }}/${{ m.precioSalidaUsdPorMtok }} por Mtok)
        </option>
      </select>
      <button
        type="button"
        @click="nuevaConversacion"
        class="px-4 py-2 rounded-lg border border-white/15 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
      >
        Nueva conversación
      </button>
    </template>

    <div class="flex flex-col h-[calc(100vh-14rem)]">
      <div class="px-6 sm:px-8 pt-4">
        <div class="flex items-start gap-2.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
          <FontAwesomeIcon :icon="faCircleInfo" class="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Ambiente de prueba: cada archivo generado por la IA (Code Interpreter) tiene costo real de OpenAI, aparte de los
            tokens de la conversación. Nada de lo que pasa acá se guarda en la base de datos.
          </span>
        </div>
      </div>

      <div class="px-6 sm:px-8 pt-3">
        <CostoConversacionPanel :usos="usos" />
      </div>

      <div class="flex-1 overflow-y-auto px-6 sm:px-8 py-4 space-y-4">
        <p v-if="historial.length === 0" class="text-sm text-muted text-center py-10">
          Adjunta un PDF o Excel y escribe qué quieres que la IA haga con él — por ejemplo
          "resume este PDF" o "calcula el total de la columna C y devuélveme un Excel con el resultado".
        </p>

        <div v-for="(m, i) in historial" :key="i" class="flex" :class="m.rol === 'user' ? 'justify-end' : 'justify-start'">
          <div
            class="max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
            :class="m.rol === 'user' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-heading'"
          >
            <p v-if="m.texto">{{ m.texto }}</p>
            <div v-if="m.archivos.length > 0" class="mt-2 flex flex-wrap gap-2">
              <a
                v-for="(a, j) in m.archivos"
                :key="j"
                :href="a.dataUrl"
                :download="a.nombre"
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                :class="m.rol === 'user' ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-white border border-gray-200 hover:bg-gray-50 text-heading'"
              >
                <FontAwesomeIcon :icon="m.rol === 'assistant' ? faDownload : iconoDe(a.nombre)" class="w-3 h-3" />
                {{ a.nombre }}
              </a>
            </div>
          </div>
        </div>

        <div v-if="enviando" class="flex justify-start">
          <div class="rounded-2xl px-4 py-3 bg-gray-100 text-muted text-sm flex items-center gap-2">
            <FontAwesomeIcon :icon="faSpinner" class="w-3.5 h-3.5 animate-spin" />
            Pensando y ejecutando código…
          </div>
        </div>

        <p v-if="errorEnvio" class="flex items-center gap-2 text-sm text-red-600">
          <FontAwesomeIcon :icon="faTriangleExclamation" class="w-3.5 h-3.5 shrink-0" />
          {{ errorEnvio }}
        </p>

        <div ref="scrollAnchor" />
      </div>

      <div class="border-t border-gray-100 px-6 sm:px-8 py-4 shrink-0">
        <div v-if="archivosSeleccionados.length > 0" class="flex flex-wrap gap-2 mb-3">
          <span
            v-for="(f, i) in archivosSeleccionados"
            :key="i"
            class="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-lg bg-violet-50 border border-violet-100 text-violet-700 text-xs font-medium"
          >
            <FontAwesomeIcon :icon="iconoDe(f.name)" class="w-3 h-3" />
            {{ f.name }}
            <button type="button" @click="quitarArchivo(i)" class="w-4 h-4 rounded-full hover:bg-violet-100 flex items-center justify-center">
              <FontAwesomeIcon :icon="faXmark" class="w-2.5 h-2.5" />
            </button>
          </span>
        </div>

        <div class="flex items-end gap-3">
          <input ref="fileInput" type="file" multiple class="hidden" :accept="EXTENSIONES_PERMITIDAS.map((e) => '.' + e).join(',')" @change="onSeleccionarArchivos" />
          <button
            type="button"
            title="Adjuntar PDF/Excel"
            @click="fileInput?.click()"
            class="w-10 h-10 rounded-lg border border-gray-200 text-muted hover:bg-gray-50 flex items-center justify-center shrink-0"
          >
            <FontAwesomeIcon :icon="faPaperclip" class="w-4 h-4" />
          </button>
          <textarea
            v-model="mensaje"
            rows="1"
            placeholder="Escribe tu mensaje… (Enter para enviar, Shift+Enter para salto de línea)"
            class="flex-1 resize-none rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
            @keydown.enter="onEnter"
          />
          <button
            type="button"
            :disabled="enviando || (!mensaje.trim() && archivosSeleccionados.length === 0)"
            @click="enviar"
            class="w-10 h-10 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
          >
            <FontAwesomeIcon :icon="enviando ? faSpinner : faPaperPlane" class="w-4 h-4" :class="enviando ? 'animate-spin' : ''" />
          </button>
        </div>
      </div>
    </div>
  </PageShell>
</template>
