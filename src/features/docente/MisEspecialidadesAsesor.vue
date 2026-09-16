<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faLayerGroup, faCircleCheck, faCircle, faChevronDown, faChevronUp, faSearch, faLightbulb,
  sectorIcons,
} from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import ResumenSeleccionEspecialidad from './ResumenSeleccionEspecialidad.vue';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { useTemasEspecialidadCatalogoQuery, useTemasEspecialidadAsesorQuery, useGuardarTemasEspecialidadAsesor } from '@/composables/useTemasEspecialidad';
import { useSubtemasCatalogoQuery, useSubtemasAsesorQuery, useGuardarSubtemasAsesor } from '@/composables/useSubtemasEspecialidad';
import type { TemaEspecialidad } from '@/types';

// Catálogo ILPIIE IVE (`temas_especialidad` + `subtemas_especialidad`) — el mismo que usa el
// paso 2 del registro público. Ya no se eligen sectores MEF acá (pedido explícito del usuario).
const session = useSessionStore();
const usuarioId = computed(() => session.sesion?.usuarioId ?? '');

const { data: temas, isLoading: cargandoTemas } = useTemasEspecialidadCatalogoQuery();
const { data: temasAsesor, isLoading: cargandoTemasAsesor } = useTemasEspecialidadAsesorQuery(usuarioId);
const { data: subtemas, isLoading: cargandoSubtemas } = useSubtemasCatalogoQuery();
const { data: subtemasAsesor, isLoading: cargandoSubtemasAsesor } = useSubtemasAsesorQuery(usuarioId);

const guardarTemas = useGuardarTemasEspecialidadAsesor();
const guardarSubtemas = useGuardarSubtemasAsesor();
const ui = useUiStore();

const cargando = computed(
  () =>
    cargandoTemas.value || cargandoTemasAsesor.value ||
    cargandoSubtemas.value || cargandoSubtemasAsesor.value,
);
const guardando = computed(() => guardarTemas.isPending.value || guardarSubtemas.isPending.value);

// `immediate: true` es necesario, no cosmético: al volver a esta pantalla con la caché de
// vue-query ya tibia, los datos llegan con valor desde el primer render y un watch normal nunca
// dispararía — la selección local quedaría vacía, "Guardar cambios" se habilitaría solo, y guardar
// borraría las especialidades reales del asesor.
const temasSeleccionados = ref<Set<string>>(new Set());
watch(temasAsesor, (v) => {
  temasSeleccionados.value = new Set(v ?? []);
}, { immediate: true });

const subtemasSeleccionados = ref<Set<string>>(new Set());
watch(subtemasAsesor, (v) => {
  subtemasSeleccionados.value = new Set(v ?? []);
}, { immediate: true });

const subtemasPorTema = computed(() => {
  const mapa = new Map<string, typeof subtemas.value>();
  for (const s of subtemas.value ?? []) {
    const lista = mapa.get(s.temaId);
    if (lista) lista.push(s);
    else mapa.set(s.temaId, [s]);
  }
  return mapa;
});

function toggleTema(temaId: string) {
  const set = new Set(temasSeleccionados.value);
  if (set.has(temaId)) {
    set.delete(temaId);
    // Al desmarcar un tema se sueltan también sus subtemas: si no, quedarían guardados subtemas de
    // un tema que el asesor ya no atiende, y su grupo ni siquiera se muestra para desmarcarlos.
    const delTema = new Set((subtemasPorTema.value.get(temaId) ?? []).map((s) => s.id));
    subtemasSeleccionados.value = new Set([...subtemasSeleccionados.value].filter((id) => !delTema.has(id)));
  } else {
    set.add(temaId);
    if ((subtemasPorTema.value.get(temaId) ?? []).length > 0) {
      expandidos.value = new Set(expandidos.value).add(temaId);
    }
  }
  temasSeleccionados.value = set;
}

function toggleSubtema(subtemaId: string) {
  const set = new Set(subtemasSeleccionados.value);
  if (set.has(subtemaId)) {
    set.delete(subtemaId);
  } else {
    set.add(subtemaId);
    // Marcar el tema padre si aún no lo está — el resumen solo lista temas seleccionados.
    const temaId = (subtemas.value ?? []).find((s) => s.id === subtemaId)?.temaId;
    if (temaId && !temasSeleccionados.value.has(temaId)) {
      temasSeleccionados.value = new Set(temasSeleccionados.value).add(temaId);
    }
  }
  subtemasSeleccionados.value = set;
}

const expandidos = ref<Set<string>>(new Set());
function toggleExpandir(temaId: string) {
  const set = new Set(expandidos.value);
  if (set.has(temaId)) set.delete(temaId);
  else set.add(temaId);
  expandidos.value = set;
}

function alClickearFila(tema: TemaEspecialidad) {
  const tieneSubtemas = (subtemasPorTema.value.get(tema.id) ?? []).length > 0;
  if (tieneSubtemas) toggleExpandir(tema.id);
  else toggleTema(tema.id);
}

const busqueda = ref('');
const temasFiltrados = computed(() => {
  const termino = busqueda.value.trim().toLowerCase();
  const lista = temas.value ?? [];
  if (termino === '') return lista;
  return lista.filter((t) => {
    if (t.nombre.toLowerCase().includes(termino)) return true;
    return (subtemasPorTema.value.get(t.id) ?? []).some((st) => st.nombre.toLowerCase().includes(termino));
  });
});
function estaExpandido(tema: TemaEspecialidad): boolean {
  if (expandidos.value.has(tema.id)) return true;
  const termino = busqueda.value.trim().toLowerCase();
  if (termino === '') return false;
  return (subtemasPorTema.value.get(tema.id) ?? []).some((st) => st.nombre.toLowerCase().includes(termino));
}

const gruposSeleccionados = computed(() =>
  (temas.value ?? [])
    .filter((t) => temasSeleccionados.value.has(t.id))
    .map((tema) => ({
      sector: tema,
      subtemas: (subtemasPorTema.value.get(tema.id) ?? []).filter((st) => subtemasSeleccionados.value.has(st.id)),
    })),
);

function difieren(actuales: Set<string>, guardados: string[]): boolean {
  if (actuales.size !== guardados.length) return true;
  return guardados.some((id) => !actuales.has(id));
}

const huboCambios = computed(
  () =>
    difieren(temasSeleccionados.value, temasAsesor.value ?? []) ||
    difieren(subtemasSeleccionados.value, subtemasAsesor.value ?? []),
);

async function guardarCambios() {
  await Promise.all([
    guardarTemas.mutateAsync({ usuarioId: usuarioId.value, temaIds: [...temasSeleccionados.value] }),
    guardarSubtemas.mutateAsync({ usuarioId: usuarioId.value, subtemaIds: [...subtemasSeleccionados.value] }),
  ]);
  ui.toast('Temas de especialidad guardados');
}
</script>

<template>
  <PageShell
    :icon="faLayerGroup"
    title="Temas de especialidad"
    description="Elige los temas y subtemas de asesoría ILPIIE en los que puedes atender solicitudes."
  >
    <LoadingSpinner v-if="cargando" />

    <template v-else>
      <h2 class="text-sm font-bold text-heading mb-1">Temas de especialidad</h2>
      <p class="text-xs text-muted mb-4">Disciplinas específicas en las que puedes brindar asesoría puntual.</p>

      <div class="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 p-4 mb-6">
        <FontAwesomeIcon :icon="faLightbulb" class="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <p class="text-xs text-amber-800">
          Puedes seleccionar uno o más temas y afinar con sus subtemas. Es el mismo catálogo ILPIIE
          que eligen los usuarios al registrarse.
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div>
          <div class="relative mb-3">
            <FontAwesomeIcon :icon="faSearch" class="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              v-model="busqueda"
              type="text"
              placeholder="Buscar temas o subtemas..."
              class="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
            />
          </div>

          <p v-if="temasFiltrados.length === 0" class="text-sm text-muted py-6 text-center">
            No hay temas ni subtemas que coincidan con "{{ busqueda }}".
          </p>

          <div v-else class="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            <div v-for="tema in temasFiltrados" :key="tema.id">
              <div
                class="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-75"
                :class="temasSeleccionados.has(tema.id) ? 'bg-brand-50/50' : 'hover:bg-gray-50'"
                @click="alClickearFila(tema)"
              >
                <button
                  type="button"
                  class="shrink-0 text-lg leading-none"
                  :class="temasSeleccionados.has(tema.id) ? 'text-brand-600' : 'text-gray-300'"
                  @click.stop="toggleTema(tema.id)"
                >
                  <FontAwesomeIcon :icon="temasSeleccionados.has(tema.id) ? faCircleCheck : faCircle" class="w-4 h-4" />
                </button>

                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  :style="{ backgroundColor: tema.colorAccent + '18', color: tema.colorAccent }"
                >
                  <FontAwesomeIcon v-if="sectorIcons[tema.icono]" :icon="sectorIcons[tema.icono]" class="w-3.5 h-3.5" />
                </div>

                <p class="text-sm font-semibold text-heading flex-1 min-w-0 truncate">{{ tema.nombre }}</p>

                <template v-if="(subtemasPorTema.get(tema.id) ?? []).length > 0">
                  <span
                    v-if="gruposSeleccionados.find((g) => g.sector.id === tema.id)?.subtemas.length"
                    class="px-2.5 py-1 rounded-full text-[11px] font-medium bg-brand-100 text-brand-700 shrink-0"
                  >
                    {{ gruposSeleccionados.find((g) => g.sector.id === tema.id)?.subtemas.length }} seleccionado{{ (gruposSeleccionados.find((g) => g.sector.id === tema.id)?.subtemas.length ?? 0) === 1 ? '' : 's' }}
                  </span>
                  <FontAwesomeIcon
                    :icon="estaExpandido(tema) ? faChevronUp : faChevronDown"
                    class="w-3 h-3 text-gray-400 shrink-0"
                  />
                </template>
              </div>

              <div v-if="estaExpandido(tema)" class="bg-gray-50/60 px-4 pb-3 pt-1">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pl-11">
                  <label
                    v-for="subtema in subtemasPorTema.get(tema.id) ?? []"
                    :key="subtema.id"
                    class="flex items-center gap-2 py-1.5 text-sm text-heading cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      :checked="subtemasSeleccionados.has(subtema.id)"
                      class="w-3.5 h-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500/40"
                      @change="toggleSubtema(subtema.id)"
                    />
                    {{ subtema.nombre }}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ResumenSeleccionEspecialidad
          :grupos="gruposSeleccionados"
          :puede-guardar="huboCambios"
          :guardando="guardando"
          class="lg:sticky lg:top-4"
          @quitar-sector="toggleTema"
          @quitar-subtema="toggleSubtema"
          @guardar="guardarCambios"
        />
      </div>
    </template>
  </PageShell>
</template>
