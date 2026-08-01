<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faLayerGroup, faSave, faCircleCheck, faCircle } from '@/lib/icons';
import { sectorIcons } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import SubtemasSelector from './SubtemasSelector.vue';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { useSectoresQuery } from '@/composables/useSectores';
import { useEspecialidadesAsesorQuery, useGuardarEspecialidadesAsesor } from '@/composables/useEspecialidadesAsesor';
import { useSubtemasCatalogoQuery, useSubtemasAsesorQuery, useGuardarSubtemasAsesor } from '@/composables/useSubtemasEspecialidad';

const session = useSessionStore();
const usuarioId = computed(() => session.sesion?.usuarioId ?? '');

const { data: sectores, isLoading: cargandoSectores } = useSectoresQuery();
const { data: especialidades, isLoading: cargandoEspecialidades } = useEspecialidadesAsesorQuery(usuarioId);
const { data: subtemas, isLoading: cargandoSubtemas } = useSubtemasCatalogoQuery();
const { data: subtemasAsesor, isLoading: cargandoSubtemasAsesor } = useSubtemasAsesorQuery(usuarioId);

const guardarSectores = useGuardarEspecialidadesAsesor();
const guardarSubtemas = useGuardarSubtemasAsesor();
const ui = useUiStore();

const cargando = computed(
  () => cargandoSectores.value || cargandoEspecialidades.value || cargandoSubtemas.value || cargandoSubtemasAsesor.value,
);
const guardando = computed(() => guardarSectores.isPending.value || guardarSubtemas.isPending.value);

// `immediate: true` es necesario, no cosmético: al volver a esta pantalla con la caché de
// vue-query ya tibia, `especialidades` llega con valor desde el primer render y un watch normal
// nunca dispararía — la selección local quedaría vacía, "Guardar cambios" se habilitaría solo, y
// guardar borraría las especialidades reales del asesor.
const seleccionados = ref<Set<string>>(new Set());
watch(especialidades, (v) => {
  seleccionados.value = new Set(v ?? []);
}, { immediate: true });

const subtemasSeleccionados = ref<Set<string>>(new Set());
watch(subtemasAsesor, (v) => {
  subtemasSeleccionados.value = new Set(v ?? []);
}, { immediate: true });

// Sectores marcados, en el orden del catálogo — es lo que se le pasa al selector de subtemas.
const sectoresSeleccionados = computed(() => (sectores.value ?? []).filter((s) => seleccionados.value.has(s.id)));

function toggle(sectorId: string) {
  const set = new Set(seleccionados.value);
  if (set.has(sectorId)) {
    set.delete(sectorId);
    // Al desmarcar un sector se sueltan también sus subtemas: si no, quedarían guardados subtemas
    // de un sector que el asesor ya no atiende, y su grupo ni siquiera se muestra para desmarcarlos.
    const delSector = new Set((subtemas.value ?? []).filter((s) => s.sectorId === sectorId).map((s) => s.id));
    const restantes = new Set([...subtemasSeleccionados.value].filter((id) => !delSector.has(id)));
    subtemasSeleccionados.value = restantes;
  } else {
    set.add(sectorId);
  }
  seleccionados.value = set;
}

function toggleSubtema(subtemaId: string) {
  const set = new Set(subtemasSeleccionados.value);
  if (set.has(subtemaId)) set.delete(subtemaId);
  else set.add(subtemaId);
  subtemasSeleccionados.value = set;
}

function difieren(actuales: Set<string>, guardados: string[]): boolean {
  if (actuales.size !== guardados.length) return true;
  return guardados.some((id) => !actuales.has(id));
}

const huboCambios = computed(
  () =>
    difieren(seleccionados.value, especialidades.value ?? []) ||
    difieren(subtemasSeleccionados.value, subtemasAsesor.value ?? []),
);

async function guardarCambios() {
  await Promise.all([
    guardarSectores.mutateAsync({ usuarioId: usuarioId.value, sectorIds: [...seleccionados.value] }),
    guardarSubtemas.mutateAsync({ usuarioId: usuarioId.value, subtemaIds: [...subtemasSeleccionados.value] }),
  ]);
  ui.toast('Temas de especialidad guardados');
}
</script>

<template>
  <PageShell
    :icon="faLayerGroup"
    title="Temas de especialidad"
    description="Elige los sectores MEF y los subtemas específicos en los que puedes atender solicitudes de asesoría."
  >
    <template #actions>
      <button
        @click="guardarCambios"
        type="button"
        :disabled="!huboCambios || guardando"
        class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition-colors flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faSave" class="w-3.5 h-3.5" />
        {{ guardando ? 'Guardando...' : 'Guardar cambios' }}
      </button>
    </template>

    <p v-if="cargando" class="text-sm text-muted">Cargando…</p>

    <template v-else>
      <h2 class="text-sm font-bold text-heading mb-4">1. Selecciona los sectores MEF en los que te especializas</h2>
      <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
        <button
          v-for="sector in sectores"
          :key="sector.id"
          type="button"
          @click="toggle(sector.id)"
          class="relative bg-surface rounded-lg p-2 border-2 shadow-sm hover:shadow-md transition-colors flex flex-col items-center text-center gap-1.5"
          :class="seleccionados.has(sector.id) ? 'border-brand-500 bg-brand-50/60' : 'border-gray-200 hover:border-gray-300'"
        >
          <FontAwesomeIcon
            :icon="seleccionados.has(sector.id) ? faCircleCheck : faCircle"
            class="w-3 h-3 absolute top-1.5 right-1.5"
            :class="seleccionados.has(sector.id) ? 'text-brand-600' : 'text-gray-300'"
          />
          <div
            class="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
            :style="{ backgroundColor: sector.colorAccent + '18', color: sector.colorAccent }"
          >
            <FontAwesomeIcon v-if="sectorIcons[sector.icono]" :icon="sectorIcons[sector.icono]" class="w-5 h-5" />
          </div>
          <div class="min-w-0 w-full">
            <p class="font-semibold text-heading text-[11px] leading-tight line-clamp-2">{{ sector.nombre }}</p>
            <p class="text-[10px] text-heading/70 mt-0.5">{{ sector.codigo }}</p>
          </div>
        </button>
      </div>

      <hr class="my-7 border-gray-100" />

      <h2 class="text-sm font-bold text-heading mb-4">2. Selecciona los subtemas específicos</h2>
      <SubtemasSelector
        :sectores="sectoresSeleccionados"
        :subtemas="subtemas ?? []"
        :seleccionados="subtemasSeleccionados"
        @toggle="toggleSubtema"
      />
    </template>
  </PageShell>
</template>
