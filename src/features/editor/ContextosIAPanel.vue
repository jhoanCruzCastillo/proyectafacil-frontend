<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faSave, faArrowRotateLeft, faSearch, faCheck, faCopy, faDownload, faCircleCheck,
} from '@/lib/icons';
import ContextosIAPillarsNav, { type PilarContextosIA } from './ContextosIAPillarsNav.vue';
import ContextosIAEstructuraPanel from './ContextosIAEstructuraPanel.vue';
import ContextosIAMarkdownEditor from './ContextosIAMarkdownEditor.vue';
import PromptPreviewPanel from './PromptPreviewPanel.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import {
  useContextosIAQuery,
  useGuardarContextoSeccion,
  useGuardarContextoGeneral,
  useEliminarContextoGeneral,
  useGuardarContextoGlobal,
  useEliminarContextoGlobal,
} from '@/composables/useContextosIA';
import { obtenerMarkdown, precargarMarkdown } from '@/lib/markdownCache';
import { useUiStore } from '@/stores/ui';
import { tiempoRelativo } from '@/lib/tiempoRelativo';
import { buildDocumento } from '@/lib/schemaExport';
import { NOMBRE_CONTEXTO_GENERAL, NOMBRE_PROMPT_SISTEMA, NOMBRE_REGLAS_LLENADO, NOMBRE_ROL_ASISTENTE } from './contextosIaNombres';
import { contextosIAHttp } from '@/api/http/contextosIA.http';
import type { Plantilla } from '@/types';

const props = defineProps<{ plantilla: Plantilla; plantillaId: string }>();

const ui = useUiStore();
const { data: contextos, isLoading } = useContextosIAQuery(() => props.plantillaId);
const guardarGeneral = useGuardarContextoGeneral();
const eliminarGeneral = useEliminarContextoGeneral();
const guardarSeccion = useGuardarContextoSeccion();
const guardarGlobal = useGuardarContextoGlobal();
const eliminarGlobal = useEliminarContextoGlobal();

const pilar = ref<PilarContextosIA>('prompt');

// --- Agrupación por prompt de destino ---
// Los 6 pilares se organizan en 3 pestañas de nivel superior según a qué prompt alimentan: los 4
// insumos del prompt de SISTEMA (rol/reglas/contexto/guía — todos los que hoy están marcados en
// rojo), el único insumo configurable del prompt de USUARIO (la Estructura — de ahí sale cada línea
// de "Campos disponibles", ver construirPromptSeccion()), y la Vista previa aparte, porque no es un
// insumo sino el resultado ya combinado de ambos.
type GrupoContextosIA = 'sistema' | 'usuario' | 'preview';
const GRUPOS: Record<GrupoContextosIA, { pilares: PilarContextosIA[] }> = {
  sistema: { pilares: ['prompt', 'contexto', 'guias', 'globales'] },
  usuario: { pilares: ['json'] },
  preview: { pilares: ['preview'] },
};
const grupoActivo = ref<GrupoContextosIA>('sistema');

function seleccionarGrupo(g: GrupoContextosIA) {
  grupoActivo.value = g;
  pilar.value = GRUPOS[g].pilares[0];
}

// Sub-pestañas SOLO dentro de "Prompt de sistema": "Insumos" es lo que ya existe (las 4 tarjetas
// editables); "Estructura" es nueva — todavía sin definir del todo (pendiente: armar ahí qué insumo
// va en cada paso del armado real del prompt de sistema, ver PASO en ContextosIAPillarsNav.vue).
type SubTabSistema = 'insumos' | 'estructura';
const subTabSistema = ref<SubTabSistema>('insumos');

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
const guiaGuardada = computed(() =>
  contextos.value?.secciones.find((c) => c.seccionId === seccionActivaId.value) ?? null,
);

// --- Pilar "Contexto general" ---
// Antes solo se veía/editaba el general con nombre exacto NOMBRE_CONTEXTO_GENERAL — cualquier otro
// "general" de esta ficha (ej. guías conceptuales adicionales) quedaba huérfano: seguía sumándose al
// prompt real (ver LlenadoIAController::contextosGeneralesDe, que trae TODOS los generales de la
// plantilla sin filtrar por nombre), pero sin ningún lugar del panel para verlo o editarlo. Ahora se
// listan todos — excepto el de NOMBRE_PROMPT_SISTEMA, que es el contenido exclusivo del pilar 1.
const generalesOrdenados = computed(() => {
  const lista = (contextos.value?.generales ?? []).filter((g) => g.nombre !== NOMBRE_PROMPT_SISTEMA);
  return [...lista].sort((a, b) => {
    if (a.nombre === NOMBRE_CONTEXTO_GENERAL) return -1;
    if (b.nombre === NOMBRE_CONTEXTO_GENERAL) return 1;
    return a.nombre.localeCompare(b.nombre);
  });
});
const generalActivoId = ref<string | null>(null);
const generalActivo = computed(() => generalesOrdenados.value.find((g) => g.id === generalActivoId.value) ?? null);
const esContextoGeneralReservado = computed(() => generalActivo.value?.nombre === NOMBRE_CONTEXTO_GENERAL);
const nombreGeneral = ref('');
const confirmarEliminarGeneral = ref(false);

// --- Pilar "Reglas globales" ---
// NOMBRE_REGLAS_LLENADO y NOMBRE_ROL_ASISTENTE van siempre primero en la lista — son las dos que el
// backend busca por nombre literal en CUALQUIER ficha (ver contenidoGlobalPorNombre/rolAsistente);
// las demás son reutilizables pero sin ningún significado especial fuera de las secciones donde el
// admin las asocie.
const NOMBRES_RESERVADOS = [NOMBRE_REGLAS_LLENADO, NOMBRE_ROL_ASISTENTE];
const globalesOrdenados = computed(() => {
  const lista = contextos.value?.globales ?? [];
  return [...lista].sort((a, b) => {
    const ra = NOMBRES_RESERVADOS.indexOf(a.nombre);
    const rb = NOMBRES_RESERVADOS.indexOf(b.nombre);
    if (ra !== -1 || rb !== -1) return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
    return a.nombre.localeCompare(b.nombre);
  });
});
// null = formulario en blanco para crear uno nuevo.
const globalActivoId = ref<string | null>(null);
const globalActivo = computed(() => globalesOrdenados.value.find((g) => g.id === globalActivoId.value) ?? null);
const esReglaReservada = computed(() => !!globalActivo.value && NOMBRES_RESERVADOS.includes(globalActivo.value.nombre));

// Paso real dentro de construirSistema()/construirSistemaTabla() — ver el orden verificado en
// ContextosIAPillarsNav.vue (PASO). Las dos reservadas van siempre, en un paso fijo; el resto solo
// entra al prompt si el admin la asoció a la sección que se está llenando — mismo bloque (variable)
// y mismo rol que la propia "Guía de sección", nunca antes.
function pasoDe(nombre: string): string {
  if (nombre === NOMBRE_ROL_ASISTENTE) return 'Paso 1 — siempre, en cualquier ficha';
  if (nombre === NOMBRE_REGLAS_LLENADO) return 'Paso 4 — siempre, en cualquier ficha';
  return 'Paso 8 — solo si está asociada a la sección en curso';
}
const nombreGlobal = ref('');
const confirmarEliminarGlobal = ref(false);

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
    nombreGeneral.value = generalActivo.value?.nombre ?? '';
    url = generalActivo.value?.url ?? null;
  } else if (pilar.value === 'guias') {
    nombre = '';
    url = guiaGuardada.value?.url ?? null;
  } else if (pilar.value === 'globales') {
    nombreGlobal.value = globalActivo.value?.nombre ?? '';
    url = globalActivo.value?.url ?? null;
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

watch([pilar, promptGuardado, guiaGuardada, seccionActivaId, generalActivoId, globalActivoId], cargarBorrador, { immediate: true });

// Al entrar por primera vez a cada pilar de lista, se para directo en el registro reservado — es la
// razón de ser del pilar, no tiene sentido abrir en un formulario vacío si ya existe.
watch(pilar, (p) => {
  if (p === 'contexto' && generalActivoId.value === null) {
    const reservado = generalesOrdenados.value.find((g) => g.nombre === NOMBRE_CONTEXTO_GENERAL);
    if (reservado) generalActivoId.value = reservado.id;
  }
  if (p === 'globales' && globalActivoId.value === null) {
    const reservada = globalesOrdenados.value.find((g) => g.nombre === NOMBRE_REGLAS_LLENADO);
    if (reservada) globalActivoId.value = reservada.id;
  }
});

const huboCambios = computed(() => {
  if (pilar.value === 'json') return false;
  return markdown.value !== originalMarkdown.value;
});

const guardando = computed(() =>
  guardarGeneral.isPending.value || eliminarGeneral.isPending.value
  || guardarSeccion.isPending.value
  || guardarGlobal.isPending.value || eliminarGlobal.isPending.value,
);

const ultimaModificacion = computed(() => {
  if (pilar.value === 'prompt') return promptGuardado.value?.actualizadoEn ?? null;
  if (pilar.value === 'contexto') return generalActivo.value?.actualizadoEn ?? null;
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
      // El reservado nunca cambia de nombre aunque el input estuviera de alguna forma habilitado —
      // es el que LlenadoIAController::contextosGeneralesDe simplemente incluye por existir, pero el
      // pilar 1 (Prompt del sistema) lo trata como referencia conceptual fija.
      const nombre = esContextoGeneralReservado.value ? NOMBRE_CONTEXTO_GENERAL : nombreGeneral.value.trim();
      if (nombre === '') {
        ui.toast('Ponle un nombre al contexto antes de guardar', 'error');
        return;
      }
      const nuevos = await guardarGeneral.mutateAsync({
        plantillaId: props.plantillaId,
        id: generalActivo.value?.id ?? null,
        nombre,
        markdown: markdown.value,
      });
      originalMarkdown.value = markdown.value;
      const guardado = nuevos.find((g) => g.nombre === nombre);
      if (guardado) generalActivoId.value = guardado.id;
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
      return;
    }
    if (pilar.value === 'globales') {
      const nombre = nombreGlobal.value.trim();
      if (nombre === '') {
        ui.toast('Ponle un nombre a la regla antes de guardar', 'error');
        return;
      }
      const nuevos = await guardarGlobal.mutateAsync({
        id: globalActivo.value?.id ?? null,
        nombre,
        markdown: markdown.value,
        icono: globalActivo.value?.icono ?? null,
      });
      originalMarkdown.value = markdown.value;
      // Recién creada no tiene id todavía en globalActivo — la encontramos por nombre en la
      // respuesta para que quede seleccionada (y no vuelva a aparecer como "+ Nueva").
      const guardada = nuevos.find((g) => g.nombre === nombre);
      if (guardada) globalActivoId.value = guardada.id;
      ui.toast('Regla global guardada', 'success');
    }
  } catch {
    ui.toast('No se pudo guardar', 'error');
  }
}

function nuevoContextoGeneral() {
  generalActivoId.value = null;
  nombreGeneral.value = '';
  markdown.value = '';
  originalMarkdown.value = '';
}

async function confirmarEliminarContextoGeneralActivo() {
  if (!generalActivo.value || esContextoGeneralReservado.value) return;
  try {
    await eliminarGeneral.mutateAsync({ plantillaId: props.plantillaId, id: generalActivo.value.id });
    ui.toast('Contexto general eliminado', 'success');
    nuevoContextoGeneral();
  } catch {
    ui.toast('No se pudo eliminar', 'error');
  } finally {
    confirmarEliminarGeneral.value = false;
  }
}

function nuevaReglaGlobal() {
  globalActivoId.value = null;
  nombreGlobal.value = '';
  markdown.value = '';
  originalMarkdown.value = '';
}

async function confirmarEliminarGlobalActivo() {
  if (!globalActivo.value || esReglaReservada.value) return;
  try {
    await eliminarGlobal.mutateAsync(globalActivo.value.id);
    ui.toast('Regla global eliminada', 'success');
    nuevaReglaGlobal();
  } catch {
    ui.toast('No se pudo eliminar', 'error');
  } finally {
    confirmarEliminarGlobal.value = false;
  }
}

const restaurandoPredeterminado = ref(false);

async function restaurarPredeterminado() {
  if (pilar.value === 'prompt') {
    restaurandoPredeterminado.value = true;
    try {
      const { markdown: predeterminado } = await contextosIAHttp.promptSistemaPredeterminado(props.plantillaId);
      markdown.value = predeterminado;
      nombrePrompt.value = `Prompt maestro — ${props.plantilla.nombre}`;
    } catch {
      ui.toast('No se pudo cargar el prompt predeterminado', 'error');
    } finally {
      restaurandoPredeterminado.value = false;
    }
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
    case 'globales': return { t: '4. Reglas globales', d: 'Reglas reutilizables por cualquier ficha de cualquier sector — incluida la que usa el sistema en cada llenado con IA.' };
    case 'json': return { t: '5. Estructura JSON', d: 'Esquema oficial de la ficha. La edición del árbol se hace en la pestaña Estructura.' };
    case 'preview': return { t: '6. Vista previa del prompt', d: 'El prompt exacto que arma el sistema para cada sección, ya con las 4 piezas de arriba combinadas — solo lectura, sin costo.' };
  }
});
</script>

<template>
  <div class="flex-1 overflow-hidden bg-surface flex flex-col min-h-0">
    <div class="px-6 pt-5 pb-4 border-b border-gray-100 bg-white shrink-0 space-y-4">
      <!-- 3 pestañas de nivel superior: a qué prompt alimenta cada insumo (ver GRUPOS arriba). -->
      <div class="flex gap-1.5 border-b border-gray-100 pb-4">
        <button
          type="button"
          class="px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors"
          :class="grupoActivo === 'sistema' ? 'bg-red-100 text-red-700' : 'text-muted hover:bg-gray-50'"
          @click="seleccionarGrupo('sistema')"
        >
          Prompt de sistema
        </button>
        <button
          type="button"
          class="px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors"
          :class="grupoActivo === 'usuario' ? 'bg-violet-100 text-violet-700' : 'text-muted hover:bg-gray-50'"
          @click="seleccionarGrupo('usuario')"
        >
          Prompt de usuario
        </button>
        <button
          type="button"
          class="px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors"
          :class="grupoActivo === 'preview' ? 'bg-violet-100 text-violet-700' : 'text-muted hover:bg-gray-50'"
          @click="seleccionarGrupo('preview')"
        >
          Vista previa del prompt
        </button>
      </div>

      <template v-if="grupoActivo === 'sistema'">
        <!-- Sub-pestañas de "Prompt de sistema": Insumos (lo de siempre) / Estructura (nueva, aún por definir). -->
        <div class="flex gap-1 -mt-1">
          <button
            type="button"
            class="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
            :class="subTabSistema === 'insumos' ? 'bg-gray-900 text-white' : 'text-muted hover:bg-gray-100'"
            @click="subTabSistema = 'insumos'"
          >
            Insumos
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
            :class="subTabSistema === 'estructura' ? 'bg-gray-900 text-white' : 'text-muted hover:bg-gray-100'"
            @click="subTabSistema = 'estructura'"
          >
            Estructura
          </button>
        </div>

        <ContextosIAPillarsNav v-if="subTabSistema === 'insumos'" :activo="pilar" :solo-ids="GRUPOS.sistema.pilares" @select="pilar = $event" />
      </template>
    </div>

    <div v-if="grupoActivo === 'sistema' && subTabSistema === 'estructura'" class="flex-1 min-h-0 overflow-hidden flex flex-col">
      <div v-if="isLoading" class="flex-1 flex items-center justify-center text-muted text-sm">Cargando contextos…</div>
      <ContextosIAEstructuraPanel
        v-else-if="contextos"
        :plantilla-id="plantillaId"
        :contextos="contextos"
        @ir-a-guias="pilar = 'guias'; subTabSistema = 'insumos'"
      />
    </div>

    <div v-else-if="isLoading" class="flex-1 flex items-center justify-center text-muted text-sm">
      Cargando contextos…
    </div>

    <div v-else class="flex-1 min-h-0 overflow-hidden flex flex-col">
      <!-- Prompt del sistema (pilar único, ver promptSistemaPredeterminado.ts) -->
      <template v-if="pilar === 'prompt'">
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

            <div class="space-y-1.5">
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
              label="Contenido del prompt"
              min-height-class="min-h-[320px]"
            />

            <div class="flex items-center justify-between gap-3 pt-2 pb-4">
              <button
                type="button"
                class="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-muted hover:bg-gray-50 hover:text-heading transition-colors flex items-center gap-2 disabled:opacity-50"
                :disabled="restaurandoPredeterminado"
                @click="restaurarPredeterminado"
              >
                <FontAwesomeIcon :icon="faArrowRotateLeft" class="w-3.5 h-3.5" />
                {{ restaurandoPredeterminado ? 'Cargando…' : 'Restaurar predeterminado' }}
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

      <!-- Contexto general: lista (puede haber varios, ver generalesOrdenados) -->
      <template v-else-if="pilar === 'contexto'">
        <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr] overflow-hidden">
          <aside class="border-r border-gray-100 bg-white flex flex-col min-h-0">
            <div class="p-3 border-b border-gray-100">
              <button
                type="button"
                class="w-full rounded-lg border border-dashed border-violet-300 text-violet-700 text-sm font-medium px-3 py-2 hover:bg-violet-50 transition-colors"
                @click="nuevoContextoGeneral"
              >
                + Nuevo contexto general
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              <button
                v-for="g in generalesOrdenados"
                :key="g.id"
                type="button"
                class="w-full text-left rounded-lg px-3 py-2.5 transition-colors"
                :class="generalActivoId === g.id
                  ? 'bg-emerald-50 border border-emerald-200'
                  : 'hover:bg-gray-50 border border-transparent'"
                @click="generalActivoId = g.id"
              >
                <div class="text-xs font-medium text-heading leading-snug line-clamp-2">{{ g.nombre }}</div>
                <span
                  v-if="g.nombre === NOMBRE_CONTEXTO_GENERAL"
                  class="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700"
                >
                  Principal de esta ficha
                </span>
              </button>
              <p v-if="generalesOrdenados.length === 0" class="text-xs text-muted px-3 py-2">
                Todavía no hay ningún contexto general creado.
              </p>
            </div>
          </aside>

          <div class="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            <div class="max-w-5xl mx-auto flex flex-col gap-4 min-h-full">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-base font-bold text-heading">
                    {{ generalActivoId === null ? 'Nuevo contexto general' : 'Editar contexto general' }}
                  </h3>
                  <p v-if="ultimaModificacion" class="text-xs text-muted mt-1">
                    Última modificación: {{ tiempoRelativo(ultimaModificacion) }}
                  </p>
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-heading">Nombre del contexto</label>
                <input
                  v-model="nombreGeneral"
                  type="text"
                  :disabled="esContextoGeneralReservado"
                  class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-heading outline-none focus:border-violet-400 disabled:bg-gray-50 disabled:text-muted"
                  placeholder="Ej. Glosario de términos, Normativa aplicable…"
                />
              </div>

              <ContextosIAMarkdownEditor
                v-model="markdown"
                label="Contenido del contexto"
                min-height-class="min-h-[320px]"
              />

              <div class="flex items-center justify-between gap-3 pt-2 pb-4">
                <button
                  v-if="generalActivoId !== null && !esContextoGeneralReservado"
                  type="button"
                  class="px-4 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  @click="confirmarEliminarGeneral = true"
                >
                  Eliminar
                </button>
                <span v-else />
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
        </div>

        <ConfirmModal
          :is-open="confirmarEliminarGeneral"
          title="Eliminar contexto general"
          :message="`¿Seguro que deseas eliminar &quot;${generalActivo?.nombre}&quot;? Esto lo quita del prompt de todas las secciones de esta ficha.`"
          @confirm="confirmarEliminarContextoGeneralActivo"
          @close="confirmarEliminarGeneral = false"
        />
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

      <!-- Reglas globales -->
      <template v-else-if="pilar === 'globales'">
        <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr] overflow-hidden">
          <aside class="border-r border-gray-100 bg-white flex flex-col min-h-0">
            <div class="p-3 border-b border-gray-100">
              <button
                type="button"
                class="w-full rounded-lg border border-dashed border-violet-300 text-violet-700 text-sm font-medium px-3 py-2 hover:bg-violet-50 transition-colors"
                @click="nuevaReglaGlobal"
              >
                + Nueva regla global
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              <button
                v-for="g in globalesOrdenados"
                :key="g.id"
                type="button"
                class="w-full text-left rounded-lg px-3 py-2.5 transition-colors"
                :class="globalActivoId === g.id
                  ? 'bg-emerald-50 border border-emerald-200'
                  : 'hover:bg-gray-50 border border-transparent'"
                @click="globalActivoId = g.id"
              >
                <div class="text-xs font-medium text-heading leading-snug line-clamp-2">{{ g.nombre }}</div>
                <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span
                    v-if="NOMBRES_RESERVADOS.includes(g.nombre)"
                    class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700"
                  >
                    Usada por el sistema
                  </span>
                  <span class="text-[10px] text-muted">{{ g.usos }} {{ g.usos === 1 ? 'sección asociada' : 'secciones asociadas' }}</span>
                </div>
                <p class="text-[10px] text-indigo-700/80 mt-1 leading-snug">{{ pasoDe(g.nombre) }}</p>
              </button>
              <p v-if="globalesOrdenados.length === 0" class="text-xs text-muted px-3 py-2">
                Todavía no hay ninguna regla global creada.
              </p>
            </div>
          </aside>

          <div class="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            <div class="max-w-5xl mx-auto flex flex-col gap-4 min-h-full">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-base font-bold text-heading">
                    {{ globalActivoId === null ? 'Nueva regla global' : 'Editar regla global' }}
                  </h3>
                  <p v-if="esReglaReservada" class="text-xs text-violet-700 mt-1 max-w-lg">
                    Esta es la regla que el sistema busca por nombre en CUALQUIER ficha al llenar con
                    IA — por eso el nombre no se puede cambiar ni eliminar desde aquí.
                  </p>
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-heading">Nombre de la regla</label>
                <input
                  v-model="nombreGlobal"
                  type="text"
                  :disabled="esReglaReservada"
                  class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-heading outline-none focus:border-violet-400 disabled:bg-gray-50 disabled:text-muted"
                  placeholder="Ej. Formato de fechas, Tono de redacción…"
                />
              </div>

              <ContextosIAMarkdownEditor
                v-model="markdown"
                label="Contenido de la regla"
                min-height-class="min-h-[320px]"
              />

              <div class="flex items-center justify-between gap-3 pt-2 pb-4">
                <button
                  v-if="globalActivoId !== null && !esReglaReservada"
                  type="button"
                  class="px-4 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  @click="confirmarEliminarGlobal = true"
                >
                  Eliminar
                </button>
                <span v-else />
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
        </div>

        <ConfirmModal
          :is-open="confirmarEliminarGlobal"
          title="Eliminar regla global"
          :message="`¿Seguro que deseas eliminar &quot;${globalActivo?.nombre}&quot;? Se quita también de cualquier sección que la tenga asociada.`"
          @confirm="confirmarEliminarGlobalActivo"
          @close="confirmarEliminarGlobal = false"
        />
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
            <div class="rounded-lg bg-violet-50 border border-violet-100 p-3 space-y-2">
              <h3 class="text-xs font-bold text-violet-800">Otros 2 ingredientes del prompt de usuario</h3>
              <p class="text-[11px] text-violet-900/80 leading-relaxed">
                No se configuran acá — son datos, no texto que el admin redacte:
              </p>
              <ul class="text-[11px] text-violet-900/80 leading-relaxed space-y-1.5 list-disc pl-4">
                <li><strong>Ejemplo de referencia</strong> — se marca con el botón correspondiente en el tab <strong>Ejemplos</strong> de esta plantilla.</li>
                <li><strong>Valores ya confirmados</strong> — se toman en vivo de lo que ya tiene guardado el ejemplo que se está llenando; no hay nada que redactar.</li>
              </ul>
            </div>
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
