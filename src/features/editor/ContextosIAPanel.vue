<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faSave, faArrowRotateLeft, faSearch, faCheck, faCopy, faDownload, faCircleCheck,
} from '@/lib/icons';
import ContextosIAPillarsNav, { type PilarContextosIA } from './ContextosIAPillarsNav.vue';
import ContextosIAMarkdownEditor from './ContextosIAMarkdownEditor.vue';
import PromptPreviewPanel from './PromptPreviewPanel.vue';
import {
  useContextosIAQuery,
  useGuardarContextoSeccion,
  useGuardarContextoGeneral,
} from '@/composables/useContextosIA';
import { obtenerMarkdown, precargarMarkdown } from '@/lib/markdownCache';
import { useUiStore } from '@/stores/ui';
import { tiempoRelativo } from '@/lib/tiempoRelativo';
import { buildDocumento } from '@/lib/schemaExport';
import { NOMBRE_CONTEXTO_GENERAL, NOMBRE_PROMPT_SISTEMA } from './contextosIaNombres';
import { promptSistemaPredeterminado } from './promptSistemaPredeterminado';
import type { Plantilla } from '@/types';

const props = defineProps<{ plantilla: Plantilla; plantillaId: string }>();

const ui = useUiStore();
const { data: contextos, isLoading } = useContextosIAQuery(() => props.plantillaId);
const guardarGeneral = useGuardarContextoGeneral();
const guardarSeccion = useGuardarContextoSeccion();

const pilar = ref<PilarContextosIA>('prompt');

const secciones = computed(() => props.plantilla.secciones);
const seccionActivaId = ref<string | null>(secciones.value[0]?.id ?? null);
const seccionActiva = computed(() => secciones.value.find((s) => s.id === seccionActivaId.value) ?? null);
const filtroSeccion = ref('');

const seccionesFiltradas = computed(() => {
  const q = filtroSeccion.value.trim().toLowerCase();
  if (!q) return secciones.value;
  return secciones.value.filter((s) => s.nombre.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
});

const promptGuardado = computed(() =>
  contextos.value?.generales.find((g) => g.nombre === NOMBRE_PROMPT_SISTEMA) ?? null,
);
const contextoGuardado = computed(() =>
  contextos.value?.generales.find((g) => g.nombre === NOMBRE_CONTEXTO_GENERAL) ?? null,
);
const guiaGuardada = computed(() =>
  contextos.value?.secciones.find((c) => c.seccionId === seccionActivaId.value) ?? null,
);

const nombrePrompt = ref('');
const markdown = ref('');
const originalMarkdown = ref('');
const originalNombre = ref('');
let token = 0;

watch(contextos, (c) => {
  if (!c) return;
  precargarMarkdown([
    ...c.secciones.map((s) => s.url),
    ...c.generales.map((g) => g.url),
  ]);
}, { immediate: true });

async function cargarBorrador() {
  const miToken = ++token;
  let url: string | null = null;
  let nombre = '';

  if (pilar.value === 'prompt') {
    nombre = `Prompt maestro — ${props.plantilla.nombre}`;
    url = promptGuardado.value?.url ?? null;
  } else if (pilar.value === 'contexto') {
    nombre = '';
    url = contextoGuardado.value?.url ?? null;
  } else if (pilar.value === 'guias') {
    nombre = '';
    url = guiaGuardada.value?.url ?? null;
  } else {
    return;
  }

  const texto = await obtenerMarkdown(url);
  if (miToken !== token) return;
  nombrePrompt.value = nombre || NOMBRE_PROMPT_SISTEMA;
  markdown.value = texto;
  originalMarkdown.value = texto;
  originalNombre.value = nombrePrompt.value;
}

watch([pilar, promptGuardado, contextoGuardado, guiaGuardada, seccionActivaId], cargarBorrador, { immediate: true });

const huboCambios = computed(() => {
  if (pilar.value === 'json') return false;
  return markdown.value !== originalMarkdown.value;
});

const guardando = computed(() => guardarGeneral.isPending.value || guardarSeccion.isPending.value);

const ultimaModificacion = computed(() => {
  if (pilar.value === 'prompt') return promptGuardado.value?.actualizadoEn ?? null;
  if (pilar.value === 'contexto') return contextoGuardado.value?.actualizadoEn ?? null;
  if (pilar.value === 'guias') return guiaGuardada.value?.actualizadoEn ?? null;
  return null;
});

function seccionTieneGuia(seccionId: string): boolean {
  const g = contextos.value?.secciones.find((c) => c.seccionId === seccionId);
  return !!g?.url;
}

async function guardar() {
  try {
    if (pilar.value === 'prompt') {
      // El registro se identifica siempre por NOMBRE_PROMPT_SISTEMA; el "nombre" del input es etiqueta de UI.
      await guardarGeneral.mutateAsync({
        plantillaId: props.plantillaId,
        id: promptGuardado.value?.id ?? null,
        nombre: NOMBRE_PROMPT_SISTEMA,
        markdown: markdown.value,
      });
      originalMarkdown.value = markdown.value;
      originalNombre.value = nombrePrompt.value.trim() || `Prompt maestro — ${props.plantilla.nombre}`;
      ui.toast('Prompt del sistema guardado', 'success');
      return;
    }
    if (pilar.value === 'contexto') {
      await guardarGeneral.mutateAsync({
        plantillaId: props.plantillaId,
        id: contextoGuardado.value?.id ?? null,
        nombre: NOMBRE_CONTEXTO_GENERAL,
        markdown: markdown.value,
      });
      originalMarkdown.value = markdown.value;
      ui.toast('Contexto general guardado', 'success');
      return;
    }
    if (pilar.value === 'guias') {
      if (!seccionActivaId.value) return;
      await guardarSeccion.mutateAsync({
        plantillaId: props.plantillaId,
        seccionId: seccionActivaId.value,
        markdown: markdown.value,
        globales: guiaGuardada.value?.globales ?? [],
      });
      originalMarkdown.value = markdown.value;
      ui.toast('Guía de sección guardada', 'success');
    }
  } catch {
    ui.toast('No se pudo guardar', 'error');
  }
}

function restaurarPredeterminado() {
  if (pilar.value === 'prompt') {
    markdown.value = promptSistemaPredeterminado(props.plantilla.nombre);
    nombrePrompt.value = `Prompt maestro — ${props.plantilla.nombre}`;
    return;
  }
  markdown.value = '';
}

// --- Pilar 4: JSON (solo lectura del schema actual; se edita en tab Estructura) ---
const jsonTexto = computed(() => {
  try {
    return JSON.stringify(buildDocumento(props.plantilla, 'estructura'), null, 2);
  } catch {
    return '';
  }
});
const jsonValido = computed(() => {
  try {
    JSON.parse(jsonTexto.value);
    return true;
  } catch {
    return false;
  }
});
const totalCampos = computed(() =>
  props.plantilla.secciones.reduce(
    (acc, s) => acc + (s.subsecciones ?? []).reduce((a, sub) => a + (sub.campos?.length ?? 0), 0),
    0,
  ),
);

async function copiarJson() {
  try {
    await navigator.clipboard.writeText(jsonTexto.value);
    ui.toast('JSON copiado', 'success');
  } catch {
    ui.toast('No se pudo copiar', 'error');
  }
}

function descargarJson() {
  const blob = new Blob([jsonTexto.value], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${props.plantilla.codigo || 'ficha'}-estructura.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const tituloPilar = computed(() => {
  switch (pilar.value) {
    case 'prompt': return { t: '1. Prompt del sistema', d: 'Define las instrucciones maestras que guiarán a la IA durante todo el proceso de llenado.' };
    case 'contexto': return { t: '2. Contexto general', d: 'Información general que utilizará la IA durante el procesamiento de la ficha.' };
    case 'guias': return { t: '3. Guías por sección', d: 'Configura las guías de llenado por sección que la IA utilizará para completar los campos correctamente.' };
    case 'json': return { t: '4. Estructura JSON', d: 'Esquema oficial de la ficha. La edición del árbol se hace en la pestaña Estructura.' };
    case 'preview': return { t: '5. Vista previa del prompt', d: 'El prompt exacto que arma el sistema para cada sección, ya con las 4 piezas de arriba combinadas — solo lectura, sin costo.' };
  }
});
</script>

<template>
  <div class="flex-1 overflow-hidden bg-surface flex flex-col min-h-0">
    <div class="px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0 space-y-4">
      <div>
        <h2 class="text-lg font-bold text-heading">Contextos IA</h2>
        <p class="text-sm text-muted mt-0.5">{{ tituloPilar.d }}</p>
      </div>
      <ContextosIAPillarsNav :activo="pilar" @select="pilar = $event" />
    </div>

    <div v-if="isLoading" class="flex-1 flex items-center justify-center text-muted text-sm">
      Cargando contextos…
    </div>

    <div v-else class="flex-1 min-h-0 overflow-hidden flex flex-col">
      <!-- Prompt / Contexto -->
      <template v-if="pilar === 'prompt' || pilar === 'contexto'">
        <div class="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <div class="max-w-5xl mx-auto flex flex-col gap-4 min-h-full">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="text-base font-bold text-heading">{{ tituloPilar.t }}</h3>
                <p v-if="ultimaModificacion" class="text-xs text-muted mt-1">
                  Última modificación: {{ tiempoRelativo(ultimaModificacion) }}
                </p>
              </div>
            </div>

            <div v-if="pilar === 'prompt'" class="space-y-1.5">
              <label class="text-xs font-semibold text-heading">Nombre del prompt</label>
              <input
                v-model="nombrePrompt"
                type="text"
                class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-heading outline-none focus:border-violet-400"
                placeholder="Prompt maestro — nombre del formato"
              />
              <p class="text-[11px] text-muted">
                Etiqueta de esta pantalla (MVP). El contenido guardado es el markdown de abajo.
              </p>
            </div>

            <ContextosIAMarkdownEditor
              v-model="markdown"
              :label="pilar === 'prompt' ? 'Contenido del prompt' : 'Contenido del contexto'"
              min-height-class="min-h-[320px]"
            />

            <div class="flex items-center justify-between gap-3 pt-2 pb-4">
              <button
                type="button"
                class="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-muted hover:bg-gray-50 hover:text-heading transition-colors flex items-center gap-2"
                @click="restaurarPredeterminado"
              >
                <FontAwesomeIcon :icon="faArrowRotateLeft" class="w-3.5 h-3.5" />
                Restaurar predeterminado
              </button>
              <button
                type="button"
                class="px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                :disabled="!huboCambios || guardando"
                @click="guardar"
              >
                <FontAwesomeIcon :icon="faSave" class="w-3.5 h-3.5" />
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- Guías por sección -->
      <template v-else-if="pilar === 'guias'">
        <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr] overflow-hidden">
          <aside class="border-r border-gray-100 bg-white flex flex-col min-h-0">
            <div class="p-3 border-b border-gray-100">
              <div class="relative">
                <FontAwesomeIcon :icon="faSearch" class="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  v-model="filtroSeccion"
                  type="search"
                  placeholder="Buscar sección…"
                  class="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-violet-400"
                />
              </div>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              <button
                v-for="s in seccionesFiltradas"
                :key="s.id"
                type="button"
                class="w-full text-left rounded-lg px-3 py-2.5 transition-colors"
                :class="seccionActivaId === s.id
                  ? 'bg-emerald-50 border border-emerald-200'
                  : 'hover:bg-gray-50 border border-transparent'"
                @click="seccionActivaId = s.id"
              >
                <div class="flex items-start gap-2">
                  <span
                    class="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                    :class="seccionTieneGuia(s.id) ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-muted'"
                  >
                    <FontAwesomeIcon v-if="seccionTieneGuia(s.id)" :icon="faCheck" class="w-2.5 h-2.5" />
                    <template v-else>{{ secciones.findIndex((x) => x.id === s.id) + 1 }}</template>
                  </span>
                  <div class="min-w-0">
                    <div class="text-[11px] font-semibold text-muted">
                      SECCIÓN N°{{ String(secciones.findIndex((x) => x.id === s.id) + 1).padStart(2, '0') }}
                    </div>
                    <div class="text-xs font-medium text-heading leading-snug line-clamp-2">{{ s.nombre }}</div>
                  </div>
                </div>
              </button>
            </div>
          </aside>

          <div class="flex flex-col min-h-0 overflow-hidden">
            <div class="px-5 py-3 border-b border-gray-100 bg-white flex items-center justify-between gap-3 shrink-0">
              <div class="min-w-0">
                <h3 class="text-sm font-bold text-heading truncate">
                  {{ seccionActiva?.nombre ?? 'Selecciona una sección' }}
                </h3>
                <p class="text-[11px] text-muted mt-0.5">
                  <span
                    v-if="guiaGuardada?.url"
                    class="inline-flex items-center gap-1 text-emerald-700 font-medium"
                  >
                    <FontAwesomeIcon :icon="faCircleCheck" class="w-3 h-3" />
                    Guardada
                  </span>
                  <span v-else>Sin guía todavía</span>
                  <span v-if="ultimaModificacion"> · {{ tiempoRelativo(ultimaModificacion) }}</span>
                </p>
              </div>
              <button
                type="button"
                class="shrink-0 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                :disabled="!seccionActivaId || !huboCambios || guardando"
                @click="guardar"
              >
                <FontAwesomeIcon :icon="faSave" class="w-3.5 h-3.5" />
                Guardar guía de sección
              </button>
            </div>

            <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              <ContextosIAMarkdownEditor
                v-if="seccionActiva"
                v-model="markdown"
                label="Guía de llenado"
                min-height-class="min-h-[360px]"
              />
              <div class="flex justify-start">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-muted hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                  @click="restaurarPredeterminado"
                >
                  <FontAwesomeIcon :icon="faArrowRotateLeft" class="w-3 h-3" />
                  Restaurar predeterminado
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Vista previa del prompt -->
      <template v-else-if="pilar === 'preview'">
        <PromptPreviewPanel :plantilla="plantilla" :plantilla-id="plantillaId" />
      </template>

      <!-- Estructura JSON -->
      <template v-else>
        <div class="flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-[280px_1fr]">
          <aside class="border-r border-gray-100 bg-white p-5 space-y-5 overflow-y-auto">
            <div>
              <h3 class="text-sm font-bold text-heading mb-3">Información del esquema</h3>
              <dl class="space-y-2 text-xs">
                <div class="flex justify-between gap-2"><dt class="text-muted">Formato</dt><dd class="font-medium text-heading text-right">{{ plantilla.nombre }}</dd></div>
                <div class="flex justify-between gap-2"><dt class="text-muted">Código</dt><dd class="font-mono text-heading">{{ plantilla.codigo }}</dd></div>
                <div class="flex justify-between gap-2"><dt class="text-muted">Secciones</dt><dd class="font-medium text-heading">{{ plantilla.secciones.length }}</dd></div>
                <div class="flex justify-between gap-2"><dt class="text-muted">Campos (aprox.)</dt><dd class="font-medium text-heading">{{ totalCampos }}</dd></div>
              </dl>
            </div>
            <div class="space-y-2">
              <h3 class="text-sm font-bold text-heading">Acciones rápidas</h3>
              <button type="button" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors flex items-center gap-2" @click="copiarJson">
                <FontAwesomeIcon :icon="faCopy" class="w-3.5 h-3.5 text-violet-600" />
                Copiar JSON
              </button>
              <button type="button" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors flex items-center gap-2" @click="descargarJson">
                <FontAwesomeIcon :icon="faDownload" class="w-3.5 h-3.5 text-violet-600" />
                Descargar esquema
              </button>
            </div>
            <p class="text-[11px] text-muted leading-relaxed">
              Este JSON es de solo lectura aquí. Para cambiar la estructura usa la pestaña <strong>Estructura</strong>.
            </p>
          </aside>

          <div class="flex flex-col min-h-0 bg-slate-950">
            <div class="flex items-center justify-between px-4 py-2 border-b border-white/10 shrink-0">
              <span class="text-xs font-semibold text-white/80">Estructura JSON de la ficha</span>
              <span
                class="text-[11px] font-medium px-2 py-0.5 rounded-full"
                :class="jsonValido ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'"
              >
                {{ jsonValido ? 'JSON válido' : 'JSON inválido' }}
              </span>
            </div>
            <pre class="flex-1 overflow-auto px-4 py-3 text-[11px] leading-relaxed text-emerald-100/90 font-mono whitespace-pre">{{ jsonTexto }}</pre>
            <div class="px-4 py-2 border-t border-white/10 text-[11px] text-white/40 flex justify-between shrink-0">
              <span>Líneas: {{ jsonTexto.split('\n').length.toLocaleString('es-PE') }}</span>
              <span>Caracteres: {{ jsonTexto.length.toLocaleString('es-PE') }} · UTF-8</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
