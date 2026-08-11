<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faHeading, faBold, faItalic, faListUl, faListOl, faCode, faQuoteLeft, faLink,
  faEye, faSave, faTrash, faCheck, sectorIcons, faWandMagicSparkles,
} from '@/lib/icons';
import ContextosIASidebar from './ContextosIASidebar.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import {
  useContextosIAQuery, useGuardarContextoSeccion, useEliminarContextoSeccion,
  useGuardarContextoGeneral, useEliminarContextoGeneral,
  useGuardarContextoGlobal, useEliminarContextoGlobal,
} from '@/composables/useContextosIA';
import { obtenerMarkdown, precargarMarkdown } from '@/lib/markdownCache';
import { useUiStore } from '@/stores/ui';
import { tiempoRelativo } from '@/lib/tiempoRelativo';
import { renderMarkdown } from '@/lib/markdown';
import type { Plantilla } from '@/types';

const props = defineProps<{ plantilla: Plantilla; plantillaId: string }>();

const ui = useUiStore();
const { data: contextos, isLoading } = useContextosIAQuery(() => props.plantillaId);
const guardar = useGuardarContextoSeccion();
const eliminar = useEliminarContextoSeccion();
const guardarGeneral = useGuardarContextoGeneral();
const eliminarGeneral = useEliminarContextoGeneral();
const guardarGlobal = useGuardarContextoGlobal();
const eliminarGlobal = useEliminarContextoGlobal();

// El panel edita UNA cosa a la vez: el contexto de una sección de esta ficha, un contexto general
// de esta ficha, o un contexto global (reutilizable por cualquier ficha). Un id null en modo
// 'general'/'global' es uno nuevo, todavía sin guardar — nace igual que un campo nuevo, seleccionado
// y listo para escribir.
type Modo = 'seccion' | 'general' | 'global';
const modo = ref<Modo>('seccion');

const secciones = computed(() => props.plantilla.secciones);
const seccionActivaId = ref<string | null>(secciones.value[0]?.id ?? null);
const seccionActiva = computed(() => secciones.value.find((s) => s.id === seccionActivaId.value) ?? null);
const generales = computed(() => contextos.value?.generales ?? []);
const globales = computed(() => contextos.value?.globales ?? []);

const generalActivoId = ref<string | null>(null);
const generalActivo = computed(() => generales.value.find((g) => g.id === generalActivoId.value) ?? null);
const globalActivoId = ref<string | null>(null);
const globalActivo = computed(() => globales.value.find((g) => g.id === globalActivoId.value) ?? null);

/** Contexto guardado de la sección abierta, si existe. */
const guardado = computed(() => contextos.value?.secciones.find((c) => c.seccionId === seccionActivaId.value) ?? null);

// Al entrar al tab se descargan de una vez todos los .md de esta ficha (secciones + generales +
// globales), para que cambiar de ítem en el panel casi nunca tenga que esperar una descarga.
watch(contextos, (c) => {
  if (!c) return;
  precargarMarkdown([
    ...c.secciones.map((s) => s.url),
    ...c.generales.map((g) => g.url),
    ...c.globales.map((g) => g.url),
  ]);
}, { immediate: true });

// Borrador local: se rehidrata al cambiar de sección/general/global o cuando llegan los datos del
// servidor. `original`/`nombreOriginal` guardan el contenido tal cual llegó del server, para poder
// saber si "hubo cambios" sin depender de la URL (que cambia en cada guardado, por unique_filename).
// `token` descarta la respuesta de un fetch viejo si el usuario ya cambió de ítem antes de que resolviera.
const markdown = ref('');
const nombreItem = ref('');
const asociados = ref<Set<string>>(new Set());
const original = ref('');
const nombreOriginal = ref('');
let token = 0;

async function cargarBorrador() {
  const miToken = ++token;
  let url: string | null;
  let nombre: string;
  if (modo.value === 'general') {
    nombre = generalActivo.value?.nombre ?? '';
    url = generalActivo.value?.url ?? null;
  } else if (modo.value === 'global') {
    nombre = globalActivo.value?.nombre ?? '';
    url = globalActivo.value?.url ?? null;
  } else {
    asociados.value = new Set(guardado.value?.globales ?? []);
    nombre = '';
    url = guardado.value?.url ?? null;
  }
  const texto = await obtenerMarkdown(url);
  if (miToken !== token) return; // el usuario ya cambió de ítem — esta respuesta llegó tarde
  nombreItem.value = nombre;
  markdown.value = texto;
  original.value = texto;
  nombreOriginal.value = nombre;
}
watch([seccionActivaId, guardado, modo, generalActivoId, globalActivoId], cargarBorrador, { immediate: true });

const huboCambiosReal = computed(() => {
  if (modo.value === 'seccion') {
    if (markdown.value !== original.value) return true;
    const previos = new Set(guardado.value?.globales ?? []);
    if (previos.size !== asociados.value.size) return true;
    return [...asociados.value].some((id) => !previos.has(id));
  }
  return markdown.value !== original.value || nombreItem.value.trim() !== nombreOriginal.value;
});

function toggleAsociado(id: string) {
  const set = new Set(asociados.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  asociados.value = set;
}

function seleccionarSeccion(id: string) {
  modo.value = 'seccion';
  seccionActivaId.value = id;
}
function seleccionarGeneral(id: string) {
  modo.value = 'general';
  generalActivoId.value = id;
}
function nuevoGeneral() {
  modo.value = 'general';
  generalActivoId.value = null;
  markdown.value = '';
  nombreItem.value = '';
  original.value = '';
  nombreOriginal.value = '';
}
function seleccionarGlobal(id: string) {
  modo.value = 'global';
  globalActivoId.value = id;
}
function nuevoGlobal() {
  modo.value = 'global';
  globalActivoId.value = null;
  markdown.value = '';
  nombreItem.value = '';
  original.value = '';
  nombreOriginal.value = '';
}

const totalCampos = computed(() => seccionActiva.value?.subsecciones.reduce((n, sub) => n + sub.campos.length, 0) ?? 0);

async function handleGuardar() {
  if (modo.value === 'general') {
    const nombre = nombreItem.value.trim();
    if (!nombre) { ui.toast('El nombre es obligatorio', 'error'); return; }
    const antes = new Set(generales.value.map((g) => g.id));
    await guardarGeneral.mutateAsync({ plantillaId: props.plantillaId, id: generalActivoId.value, nombre, markdown: markdown.value });
    if (!generalActivoId.value) {
      const nuevo = generales.value.find((g) => !antes.has(g.id));
      if (nuevo) generalActivoId.value = nuevo.id;
    }
    ui.toast('Contexto guardado');
    return;
  }
  if (modo.value === 'global') {
    const nombre = nombreItem.value.trim();
    if (!nombre) { ui.toast('El nombre es obligatorio', 'error'); return; }
    const antes = new Set(globales.value.map((g) => g.id));
    await guardarGlobal.mutateAsync({ id: globalActivoId.value, nombre, markdown: markdown.value, icono: globalActivo.value?.icono ?? null });
    if (!globalActivoId.value) {
      const nuevo = globales.value.find((g) => !antes.has(g.id));
      if (nuevo) globalActivoId.value = nuevo.id;
    }
    ui.toast('Contexto guardado');
    return;
  }
  if (!seccionActivaId.value) return;
  await guardar.mutateAsync({
    plantillaId: props.plantillaId,
    seccionId: seccionActivaId.value,
    markdown: markdown.value,
    globales: [...asociados.value],
  });
  ui.toast('Contexto guardado');
}

const showEliminar = ref(false);
async function handleEliminar() {
  if (modo.value === 'general') {
    if (!generalActivoId.value) return;
    await eliminarGeneral.mutateAsync({ plantillaId: props.plantillaId, id: generalActivoId.value });
    showEliminar.value = false;
    modo.value = 'seccion';
    generalActivoId.value = null;
    ui.toast('Contexto eliminado');
    return;
  }
  if (modo.value === 'global') {
    if (!globalActivoId.value) return;
    await eliminarGlobal.mutateAsync(globalActivoId.value);
    showEliminar.value = false;
    modo.value = 'seccion';
    globalActivoId.value = null;
    ui.toast('Contexto eliminado');
    return;
  }
  if (!seccionActivaId.value) return;
  await eliminar.mutateAsync({ plantillaId: props.plantillaId, seccionId: seccionActivaId.value });
  showEliminar.value = false;
  ui.toast('Contexto eliminado');
}

const showPreview = ref(false);

const HERRAMIENTAS = [
  { icon: faHeading, label: 'Título', envoltura: '## ' },
  { icon: faBold, label: 'Negrita', envoltura: '**' },
  { icon: faItalic, label: 'Cursiva', envoltura: '*' },
  { icon: faListUl, label: 'Lista', envoltura: '- ' },
  { icon: faListOl, label: 'Lista numerada', envoltura: '1. ' },
  { icon: faCode, label: 'Código', envoltura: '`' },
  { icon: faQuoteLeft, label: 'Cita', envoltura: '> ' },
  { icon: faLink, label: 'Enlace', envoltura: '[]()' },
];

/** Inserta la marca de markdown al final; suficiente para una ayuda de redacción. */
function insertar(marca: string) {
  markdown.value += (markdown.value.endsWith('\n') || markdown.value === '' ? '' : '\n') + marca;
}

const markdownHtml = computed(() => renderMarkdown(markdown.value));

const tituloInfo = computed(() => (modo.value === 'general' ? 'Información del contexto general' : 'Información del contexto global'));
const guardando = computed(() => (modo.value === 'general' ? guardarGeneral.isPending.value : modo.value === 'global' ? guardarGlobal.isPending.value : guardar.isPending.value));
</script>

<template>
  <div class="flex flex-1 overflow-hidden bg-surface">
    <ContextosIASidebar
      :secciones="secciones"
      :seccion-activa-id="modo === 'seccion' ? seccionActivaId : null"
      :generales="generales"
      :general-activo-id="modo === 'general' ? generalActivoId : null"
      :globales="globales"
      :global-activo-id="modo === 'global' ? globalActivoId : null"
      @select-seccion="seleccionarSeccion"
      @select-general="seleccionarGeneral"
      @nuevo-general="nuevoGeneral"
      @select-global="seleccionarGlobal"
      @nuevo-global="nuevoGlobal"
    />

    <div class="flex-1 overflow-y-auto p-6">
      <p v-if="isLoading" class="text-sm text-muted">Cargando contextos…</p>
      <div v-else class="grid grid-cols-1 xl:grid-cols-[minmax(280px,340px)_1fr] gap-5 items-start">
        <div v-if="modo === 'seccion'" class="space-y-5">
          <div class="rounded-xl border border-gray-200 bg-white p-5">
            <p class="text-sm font-bold text-heading mb-4">Información de la sección</p>

            <label class="block text-xs font-medium text-heading mb-1.5">Sección</label>
            <div class="flex items-center gap-2 mb-4">
              <span class="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">
                {{ secciones.findIndex((s) => s.id === seccionActivaId) + 1 }}
              </span>
              <input
                :value="seccionActiva?.nombre ?? ''"
                readonly
                type="text"
                class="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-heading focus:outline-none"
              />
            </div>

            <label class="block text-xs font-medium text-heading mb-1.5">Campos</label>
            <span class="inline-flex px-2.5 py-1 rounded-lg bg-gray-100 text-xs font-medium text-gray-600">{{ totalCampos }} campos</span>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-5">
            <p class="text-sm font-bold text-heading">Contextos globales asociados</p>
            <p class="text-xs text-muted leading-snug mt-1 mb-3">
              Selecciona los contextos globales que la IA podrá consultar si lo necesita. Los contextos generales de esta ficha se aplican siempre, sin necesidad de asociarlos aquí.
            </p>
            <div class="space-y-2">
              <button
                v-for="g in globales"
                :key="g.id"
                @click="toggleAsociado(g.id)"
                type="button"
                class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors duration-75"
                :class="asociados.has(g.id) ? 'border-brand-300 bg-brand-50/50' : 'border-gray-200 hover:bg-gray-50'"
              >
                <span
                  class="w-4 h-4 rounded flex items-center justify-center shrink-0 border"
                  :class="asociados.has(g.id) ? 'bg-brand-600 border-brand-600' : 'border-gray-300 bg-white'"
                >
                  <FontAwesomeIcon v-if="asociados.has(g.id)" :icon="faCheck" class="w-2 h-2 text-white" />
                </span>
                <FontAwesomeIcon :icon="sectorIcons[g.icono ?? ''] ?? faWandMagicSparkles" class="w-3 h-3 text-gray-400 shrink-0" />
                <span class="flex-1 min-w-0 truncate text-sm text-heading">{{ g.nombre }}</span>
              </button>
              <p v-if="globales.length === 0" class="text-xs text-muted py-2 text-center">Todavía no hay contextos globales.</p>
            </div>
          </div>
        </div>

        <div v-else class="space-y-5">
          <div class="rounded-xl border border-gray-200 bg-white p-5">
            <p class="text-sm font-bold text-heading mb-4">{{ tituloInfo }}</p>

            <label class="block text-xs font-medium text-heading mb-1.5">Nombre</label>
            <input
              v-model="nombreItem"
              type="text"
              placeholder="Ej. Reglas de la tipología X"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-heading focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
            <p v-if="modo === 'general'" class="text-xs text-muted leading-snug mt-3">
              Este contexto aplica a TODA esta ficha (todas sus secciones), pero no se comparte con otras fichas ni sectores.
              {{ generalActivo ? '' : 'Todavía no se ha guardado.' }}
            </p>
            <p v-else class="text-xs text-muted leading-snug mt-3">
              Este contexto es reutilizable: cualquier sección de cualquier ficha puede asociarlo desde su propio panel.
              {{ globalActivo ? `Usado por ${globalActivo.usos} sección(es).` : 'Todavía no se ha guardado.' }}
            </p>
          </div>
        </div>

        <div class="rounded-xl border border-gray-200 bg-white p-5">
          <div class="flex items-start justify-between gap-3 mb-1">
            <p class="text-sm font-bold text-heading">Instrucciones / contexto para la IA (Markdown)</p>
            <button
              @click="showPreview = !showPreview"
              type="button"
              class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors duration-75 flex items-center gap-1.5 shrink-0"
              :class="showPreview ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
            >
              <FontAwesomeIcon :icon="faEye" class="w-3 h-3" />
              Vista previa
            </button>
          </div>
          <p class="text-xs text-muted mb-3">
            Escribe las instrucciones, reglas, recomendaciones y cualquier información relevante que la IA debe considerar.
          </p>

          <div class="rounded-lg border border-gray-200 overflow-hidden">
            <div v-if="!showPreview" class="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50/60">
              <button
                v-for="h in HERRAMIENTAS"
                :key="h.label"
                @click="insertar(h.envoltura)"
                :title="h.label"
                type="button"
                class="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:bg-gray-200/70 hover:text-gray-700 transition-colors duration-75"
              >
                <FontAwesomeIcon :icon="h.icon" class="w-3 h-3" />
              </button>
            </div>
            <textarea
              v-if="!showPreview"
              v-model="markdown"
              spellcheck="false"
              placeholder="## Objetivo&#10;Describe qué debe lograr la IA en esta sección..."
              class="block w-full min-h-[420px] px-4 py-3 text-sm text-heading leading-relaxed focus:outline-none resize-none font-mono"
            />
            <div v-else class="w-full min-h-[420px] px-4 py-3 overflow-y-auto max-h-[70vh]">
              <div v-if="markdown" v-html="markdownHtml" />
              <p v-else class="text-sm text-muted italic">Sin contenido.</p>
            </div>
          </div>
          <p class="text-right text-[11px] text-muted mt-1.5">{{ markdown.length }} caracteres</p>

          <div class="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
            <button
              @click="showEliminar = true"
              :disabled="modo === 'general' ? !generalActivoId : modo === 'global' ? !globalActivoId : !guardado"
              type="button"
              class="px-4 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-75 flex items-center gap-2"
            >
              <FontAwesomeIcon :icon="faTrash" class="w-3.5 h-3.5" />
              Eliminar contexto
            </button>
            <div class="flex items-center gap-3">
              <span v-if="modo === 'general'" class="text-xs text-muted">
                {{ generalActivo?.actualizadoEn ? `Última actualización: ${tiempoRelativo(generalActivo.actualizadoEn)}` : 'Sin guardar todavía' }}
              </span>
              <span v-else-if="modo === 'global'" class="text-xs text-muted">
                {{ globalActivo?.actualizadoEn ? `Última actualización: ${tiempoRelativo(globalActivo.actualizadoEn)}` : 'Sin guardar todavía' }}
              </span>
              <span v-else-if="guardado?.actualizadoEn" class="text-xs text-muted">
                Última actualización: {{ tiempoRelativo(guardado.actualizadoEn) }}
              </span>
              <span v-else class="text-xs text-muted">Sin guardar todavía</span>
              <button
                @click="handleGuardar"
                :disabled="!huboCambiosReal || (modo !== 'seccion' && !nombreItem.trim()) || guardando"
                type="button"
                class="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors duration-75 flex items-center gap-2"
              >
                <FontAwesomeIcon :icon="faSave" class="w-3.5 h-3.5" />
                {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmModal
      :is-open="showEliminar"
      title="Eliminar contexto"
      :message="modo === 'general'
        ? `Se borrará el contexto general «${generalActivo?.nombre ?? ''}» de esta ficha. Esta acción no se puede deshacer.`
        : modo === 'global'
          ? `Se borrará el contexto global «${globalActivo?.nombre ?? ''}» y se dejará de asociar de cualquier sección que lo use. Esta acción no se puede deshacer.`
          : `Se borrará el contexto de IA de la sección «${seccionActiva?.nombre ?? ''}». Esta acción no se puede deshacer.`"
      confirm-label="Eliminar"
      @confirm="handleEliminar"
      @close="showEliminar = false"
    />
  </div>
</template>
