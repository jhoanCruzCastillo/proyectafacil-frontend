<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faLayerGroup, faSave, faCircleCheck, faCircle } from '@/lib/icons';
import { sectorIcons } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { useSectoresQuery } from '@/composables/useSectores';
import { useEspecialidadesAsesorQuery, useGuardarEspecialidadesAsesor } from '@/composables/useEspecialidadesAsesor';

const session = useSessionStore();
const usuarioId = computed(() => session.sesion?.usuarioId ?? '');

const { data: sectores, isLoading: cargandoSectores } = useSectoresQuery();
const { data: especialidades, isLoading: cargandoEspecialidades } = useEspecialidadesAsesorQuery(usuarioId);
const guardar = useGuardarEspecialidadesAsesor();
const ui = useUiStore();

const seleccionados = ref<Set<string>>(new Set());
watch(especialidades, (v) => {
  seleccionados.value = new Set(v ?? []);
});

function toggle(sectorId: string) {
  const set = new Set(seleccionados.value);
  if (set.has(sectorId)) {
    set.delete(sectorId);
  } else {
    set.add(sectorId);
  }
  seleccionados.value = set;
}

const huboCambios = computed(() => {
  const actuales = new Set(especialidades.value ?? []);
  if (actuales.size !== seleccionados.value.size) return true;
  for (const id of seleccionados.value) {
    if (!actuales.has(id)) return true;
  }
  return false;
});

function guardarCambios() {
  guardar.mutate(
    { usuarioId: usuarioId.value, sectorIds: [...seleccionados.value] },
    { onSuccess: () => ui.toast('Especialidades guardadas') },
  );
}
</script>

<template>
  <PageShell
    :icon="faLayerGroup"
    title="Mis especialidades"
    description="Elige los sectores MEF en los que puedes atender solicitudes de asesoría. Solo se te notificarán consultas de estos sectores."
  >
    <template #actions>
      <button
        @click="guardarCambios"
        type="button"
        :disabled="!huboCambios || guardar.isPending.value"
        class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 transition-colors flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faSave" class="w-3.5 h-3.5" />
        {{ guardar.isPending.value ? 'Guardando...' : 'Guardar cambios' }}
      </button>
    </template>

    <p v-if="cargandoSectores || cargandoEspecialidades" class="text-sm text-muted">Cargando…</p>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <button
        v-for="sector in sectores"
        :key="sector.id"
        type="button"
        @click="toggle(sector.id)"
        class="text-left bg-surface rounded-xl p-5 border-2 transition-colors flex items-start gap-4"
        :class="seleccionados.has(sector.id) ? 'border-brand-500 bg-brand-50/60' : 'border-transparent hover:border-gray-200'"
      >
        <div
          class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          :style="{ backgroundColor: sector.colorAccent + '18', color: sector.colorAccent }"
        >
          <FontAwesomeIcon v-if="sectorIcons[sector.icono]" :icon="sectorIcons[sector.icono]" class="w-4.5 h-4.5" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-heading text-sm">{{ sector.nombre }}</p>
          <p class="text-xs text-muted mt-0.5">{{ sector.codigo }}</p>
        </div>
        <FontAwesomeIcon
          :icon="seleccionados.has(sector.id) ? faCircleCheck : faCircle"
          class="w-4 h-4 shrink-0 mt-0.5"
          :class="seleccionados.has(sector.id) ? 'text-brand-600' : 'text-gray-300'"
        />
      </button>
    </div>
  </PageShell>
</template>
