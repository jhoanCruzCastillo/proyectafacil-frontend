<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faPeopleGroup, faMagnifyingGlass, faUserSlash, faUserCheck } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import Avatar from '@/components/Avatar.vue';
import { useDocentesAdminQuery } from '@/composables/useDocentesAdmin';
import { useActualizarUsuario } from '@/composables/useUsuarios';
import { useUiStore } from '@/stores/ui';
import type { DocenteAdmin } from '@/types';

// Solo lectura (docs/proyectafacil-asesorias.md §5 "06 Docentes"): especialidades y consultas
// atendidas las autogestiona/genera el propio asesor; lo único que el Administrativo puede hacer
// acá es desactivar/reactivar la cuenta — sin botón "+ Agregar docente".
const { data: docentes, isLoading } = useDocentesAdminQuery();
const actualizarUsuario = useActualizarUsuario();
const queryClient = useQueryClient();
const ui = useUiStore();

const busqueda = ref('');
const docentesFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase();
  if (!q) return docentes.value ?? [];
  return (docentes.value ?? []).filter((d) => d.nombre.toLowerCase().includes(q));
});

async function toggleEstado(d: DocenteAdmin) {
  const nuevoEstado = d.estado === 'activo' ? 'inactivo' : 'activo';
  await actualizarUsuario.mutateAsync({ id: d.id, data: { estado: nuevoEstado } });
  await queryClient.invalidateQueries({ queryKey: ['docentes-admin'] });
  ui.toast(nuevoEstado === 'activo' ? `${d.nombre} reactivado` : `${d.nombre} desactivado`);
}
</script>

<template>
  <PageShell :icon="faPeopleGroup" title="Docentes" :description="`Consulta a los ${docentes?.length ?? 0} asesores de la plataforma.`">
    <div class="relative mb-5 max-w-sm">
      <FontAwesomeIcon :icon="faMagnifyingGlass" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar docentes..."
        class="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
      />
    </div>

    <p v-if="isLoading" class="text-sm text-muted">Cargando…</p>
    <p v-else-if="docentesFiltrados.length === 0" class="text-sm text-muted py-8 text-center">No se encontraron docentes.</p>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-[11px] uppercase tracking-widest text-muted border-b border-gray-100">
            <th class="pb-2 pr-4 font-semibold">Docente</th>
            <th class="pb-2 pr-4 font-semibold">Especialidades</th>
            <th class="pb-2 pr-4 font-semibold">Estado</th>
            <th class="pb-2 pr-4 font-semibold">Consultas atendidas (mes)</th>
            <th class="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in docentesFiltrados" :key="d.id" class="border-b border-gray-50" :class="d.estado === 'inactivo' ? 'opacity-50' : ''">
            <td class="py-3 pr-4">
              <div class="flex items-center gap-3">
                <Avatar :nombre="d.nombre" :fotoUrl="d.fotoUrl" />
                <div>
                  <p class="font-semibold text-heading">{{ d.nombre }}</p>
                  <p v-if="d.correo" class="text-xs text-muted">{{ d.correo }}</p>
                </div>
              </div>
            </td>
            <td class="py-3 pr-4">
              <div class="flex flex-wrap gap-1.5">
                <span v-if="d.especialidades.length === 0" class="text-xs text-muted">Sin especialidades</span>
                <span v-for="e in d.especialidades" :key="e.id" class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand-50 text-brand-700">{{ e.nombre }}</span>
              </div>
            </td>
            <td class="py-3 pr-4">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1.5 text-xs font-medium" :class="d.disponible ? 'text-green-700' : 'text-gray-400'">
                  <span class="w-2 h-2 rounded-full" :class="d.disponible ? 'bg-green-500' : 'bg-gray-300'" />
                  {{ d.disponible ? 'Disponible' : 'No disponible' }}
                </span>
                <span v-if="d.estado === 'inactivo'" class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-600">Desactivado</span>
              </div>
            </td>
            <td class="py-3 pr-4 text-heading">{{ d.consultasAtendidasMes }}</td>
            <td class="py-3 text-right whitespace-nowrap">
              <button
                @click="toggleEstado(d)"
                type="button"
                class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors duration-75 flex items-center gap-1.5 ml-auto"
                :class="d.estado === 'activo' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'"
              >
                <FontAwesomeIcon :icon="d.estado === 'activo' ? faUserSlash : faUserCheck" class="w-3 h-3" />
                {{ d.estado === 'activo' ? 'Desactivar' : 'Reactivar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </PageShell>
</template>
