<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faUserPlus, faFileCirclePlus, faUserCheck, faCircleCheck, faCircleXmark,
  faMagnifyingGlass, faFileExcel, faFileImport, faArrowUpRightFromSquare, faEye, faTrash,
  faChevronLeft, faChevronRight, faAnglesLeft, faAnglesRight,
} from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import ImportarExcelModal from '@/components/ImportarExcelModal.vue';
import CandidatoDetalleModal from './CandidatoDetalleModal.vue';
import { useCandidatosQuery, useCandidatosResumenQuery, useEliminarCandidato } from '@/composables/useCandidatos';
import { exportarCandidatosExcel, importarEspecialistasExcel } from '@/api/http/candidatos.http';
import { useUiStore } from '@/stores/ui';
import { useQueryClient } from '@tanstack/vue-query';
import { ESTADO_CANDIDATO_LABEL as ESTADO_LABEL, ESTADO_CANDIDATO_CLASE as ESTADO_CLASE } from '@/lib/estadoCandidato';
import type { Candidato, EstadoCandidato, ResultadoImportacion } from '@/types';

const ui = useUiStore();
const queryClient = useQueryClient();
const { data: candidatos, isLoading } = useCandidatosQuery();
const { data: resumen } = useCandidatosResumenQuery();

const COLUMNAS_IMPORT_ESPECIALISTAS = [
  { nombre: 'Nombre', detalle: 'Nombres y apellidos (obligatorio)' },
  { nombre: 'Correo', detalle: 'Correo electrónico único (obligatorio)' },
  { nombre: 'Teléfono', detalle: 'Opcional' },
  { nombre: 'Especialidades', detalle: 'Nombres de sectores separados por coma, ej. "Educación, Salud" (opcional)' },
];
const mostrarImportar = ref(false);
function importacionCompletada(_resultado: ResultadoImportacion) {
  // Los importados entran directo como asesores (usuarios), no como candidatos — ver
  // CandidatosController::importarExcel. Lo que cambia es Docentes/Asesores y Usuarios y permisos.
  queryClient.invalidateQueries({ queryKey: ['docentes-admin'] });
  queryClient.invalidateQueries({ queryKey: ['docentes'] });
  queryClient.invalidateQueries({ queryKey: ['usuarios'] });
  ui.toast('Especialistas importados a Docentes / Asesores');
}

type Tab = 'todos' | EstadoCandidato;
const TABS: { value: Tab; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'registrado', label: 'Registrados' },
  { value: 'en_evaluacion', label: 'En evaluación' },
  { value: 'para_entrevista', label: 'Para entrevista' },
  { value: 'aprobado', label: 'Aprobados' },
  { value: 'desaprobado', label: 'Desaprobados' },
];

const conteoPorTab = computed<Record<Tab, number>>(() => ({
  todos: resumen.value?.total ?? 0,
  registrado: resumen.value?.porEstado.registrado ?? 0,
  en_evaluacion: resumen.value?.porEstado.en_evaluacion ?? 0,
  para_entrevista: resumen.value?.porEstado.para_entrevista ?? 0,
  aprobado: resumen.value?.porEstado.aprobado ?? 0,
  desaprobado: resumen.value?.porEstado.desaprobado ?? 0,
}));

const KPIS = computed(() => [
  { key: 'registrado', icon: faUserPlus, label: 'Registrados', valor: resumen.value?.porEstado.registrado ?? '—', caption: 'Postulaciones nuevas', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
  { key: 'en_evaluacion', icon: faFileCirclePlus, label: 'En evaluación', valor: resumen.value?.porEstado.en_evaluacion ?? '—', caption: 'Pendientes de revisión', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
  { key: 'para_entrevista', icon: faUserCheck, label: 'Para entrevista', valor: resumen.value?.porEstado.para_entrevista ?? '—', caption: 'Por coordinar', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
  { key: 'aprobado', icon: faCircleCheck, label: 'Aprobados', valor: resumen.value?.porEstado.aprobado ?? '—', caption: 'Podrán brindar asesorías', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  { key: 'desaprobado', icon: faCircleXmark, label: 'Desaprobados', valor: resumen.value?.porEstado.desaprobado ?? '—', caption: 'No continúan el proceso', iconBg: 'bg-red-100', iconColor: 'text-red-600' },
]);

const tabActiva = ref<Tab>('todos');
const busqueda = ref('');
const paginaActual = ref(1);
const porPagina = 10;

function cambiarTab(tab: Tab) {
  tabActiva.value = tab;
  paginaActual.value = 1;
}
function buscar(valor: string) {
  busqueda.value = valor;
  paginaActual.value = 1;
}

const candidatosFiltrados = computed(() => {
  let lista = candidatos.value ?? [];
  if (tabActiva.value !== 'todos') lista = lista.filter((c) => c.estado === tabActiva.value);
  const q = busqueda.value.trim().toLowerCase();
  if (q) {
    lista = lista.filter((c) => (
      c.nombre.toLowerCase().includes(q) || c.dni.toLowerCase().includes(q) || c.correo.toLowerCase().includes(q)
    ));
  }
  return lista;
});

const totalPaginas = computed(() => Math.max(1, Math.ceil(candidatosFiltrados.value.length / porPagina)));
const candidatosPagina = computed(() => {
  const inicio = (paginaActual.value - 1) * porPagina;
  return candidatosFiltrados.value.slice(inicio, inicio + porPagina);
});
const rangoDesde = computed(() => (candidatosFiltrados.value.length === 0 ? 0 : (paginaActual.value - 1) * porPagina + 1));
const rangoHasta = computed(() => Math.min(paginaActual.value * porPagina, candidatosFiltrados.value.length));

function irAPagina(p: number) {
  paginaActual.value = Math.min(Math.max(1, p), totalPaginas.value);
}

function formatoFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

const exportando = ref(false);
async function exportar() {
  exportando.value = true;
  try {
    await exportarCandidatosExcel({ estado: tabActiva.value, q: busqueda.value.trim() });
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo exportar', 'error');
  } finally {
    exportando.value = false;
  }
}

function verFormularioPublico() {
  window.open('/registro-especialista', '_blank', 'noopener');
}

const candidatoSeleccionadoId = ref<string | null>(null);
function verCandidato(c: Candidato) {
  candidatoSeleccionadoId.value = c.id;
}

const eliminarCandidato = useEliminarCandidato();
const candidatoAEliminar = ref<Candidato | null>(null);
async function confirmarEliminar() {
  if (!candidatoAEliminar.value) return;
  try {
    await eliminarCandidato.mutateAsync(candidatoAEliminar.value.id);
    ui.toast(`Postulación de "${candidatoAEliminar.value.nombre}" eliminada`);
    candidatoAEliminar.value = null;
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo eliminar la postulación', 'error');
  }
}
</script>

<template>
  <PageShell :icon="faUserPlus" title="Especialistas" description="Gestiona las postulaciones de nuevos especialistas para ILPIIE Live.">
    <template #actions>
      <button
        @click="verFormularioPublico"
        type="button"
        class="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faArrowUpRightFromSquare" class="w-3.5 h-3.5" />
        Ver formulario público
      </button>
      <button
        @click="mostrarImportar = true"
        type="button"
        class="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faFileImport" class="w-3.5 h-3.5" />
        Importar desde Excel
      </button>
      <button
        @click="exportar"
        :disabled="exportando"
        type="button"
        class="px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors duration-75 flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faFileExcel" class="w-3.5 h-3.5" />
        {{ exportando ? 'Exportando…' : 'Exportar a Excel' }}
      </button>
    </template>

    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <div v-for="kpi in KPIS" :key="kpi.key" class="rounded-xl border border-gray-100 shadow-sm bg-white p-4 flex items-center gap-3">
        <div class="w-11 h-11 rounded-full flex items-center justify-center shrink-0" :class="kpi.iconBg">
          <FontAwesomeIcon :icon="kpi.icon" class="w-4.5 h-4.5" :class="kpi.iconColor" />
        </div>
        <div class="min-w-0">
          <p class="text-xs font-medium text-muted leading-tight">{{ kpi.label }}</p>
          <p class="text-2xl font-bold leading-tight text-heading">{{ kpi.valor }}</p>
          <p class="text-[11px] text-muted">{{ kpi.caption }}</p>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
        <button
          v-for="tab in TABS"
          :key="tab.value"
          @click="cambiarTab(tab.value)"
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-md transition-colors duration-75"
          :class="tabActiva === tab.value ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
        >
          {{ tab.label }} ({{ conteoPorTab[tab.value] }})
        </button>
      </div>

      <div class="relative w-full sm:w-72">
        <FontAwesomeIcon :icon="faMagnifyingGlass" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          :value="busqueda"
          @input="buscar(($event.target as HTMLInputElement).value)"
          type="text"
          placeholder="Buscar por nombre, DNI o correo…"
          class="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
      </div>
    </div>

    <LoadingSpinner v-if="isLoading" />
    <p v-else-if="candidatosFiltrados.length === 0" class="text-sm text-muted py-8 text-center">No hay postulaciones que coincidan.</p>
    <div v-else class="overflow-x-auto rounded-xl border border-gray-200">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="text-left text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
            <th class="py-3 px-4">Nombre completo</th>
            <th class="py-3 px-4">Contacto</th>
            <th class="py-3 px-4">Temas de asesoría</th>
            <th class="py-3 px-4">Experiencia</th>
            <th class="py-3 px-4">Fecha de registro</th>
            <th class="py-3 px-4">Estado</th>
            <th class="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in candidatosPagina" :key="c.id" class="border-b border-gray-200 last:border-b-0">
            <td class="py-4 px-4 whitespace-nowrap">
              <p class="font-semibold text-heading">{{ c.nombre }}</p>
              <p class="text-xs text-muted">{{ c.profesion }}</p>
            </td>
            <td class="py-4 px-4 text-muted whitespace-nowrap">
              <p>{{ c.correo }}</p>
              <p class="text-xs">{{ c.telefono }}</p>
            </td>
            <td class="py-4 px-4">
              <div class="flex flex-wrap gap-1.5 max-w-xs">
                <span v-for="t in c.temas.slice(0, 3)" :key="t.id" class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand-50 text-brand-700">{{ t.nombre }}</span>
                <span v-if="c.temas.length > 3" class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">+{{ c.temas.length - 3 }}</span>
              </div>
            </td>
            <td class="py-4 px-4 text-heading whitespace-nowrap">{{ c.aniosExperiencia }}</td>
            <td class="py-4 px-4 text-muted whitespace-nowrap">{{ formatoFecha(c.fechaRegistro) }}</td>
            <td class="py-4 px-4">
              <span class="px-2.5 py-1 rounded-full text-[11px] font-medium" :class="ESTADO_CLASE[c.estado]">{{ ESTADO_LABEL[c.estado] }}</span>
            </td>
            <td class="py-4 px-4 text-right whitespace-nowrap">
              <div class="inline-flex items-center gap-2">
                <button
                  @click="verCandidato(c)"
                  type="button"
                  class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 inline-flex items-center gap-1.5"
                >
                  <FontAwesomeIcon :icon="faEye" class="w-3 h-3" />
                  Ver
                </button>
                <button
                  @click="candidatoAEliminar = c"
                  type="button"
                  title="Eliminar postulación"
                  class="w-8 h-8 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors duration-75 inline-flex items-center justify-center shrink-0"
                >
                  <FontAwesomeIcon :icon="faTrash" class="w-3 h-3" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!isLoading && candidatosFiltrados.length > 0" class="flex flex-wrap items-center justify-between gap-4 mt-4">
      <p class="text-xs text-muted">Mostrando {{ rangoDesde }}–{{ rangoHasta }} de {{ candidatosFiltrados.length }} postulaciones</p>
      <div class="flex items-center gap-1">
        <button type="button" :disabled="paginaActual === 1" @click="irAPagina(1)" class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-75">
          <FontAwesomeIcon :icon="faAnglesLeft" class="w-3 h-3" />
        </button>
        <button type="button" :disabled="paginaActual === 1" @click="irAPagina(paginaActual - 1)" class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-75">
          <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
        </button>
        <span class="px-3 text-sm text-heading font-medium">{{ paginaActual }} / {{ totalPaginas }}</span>
        <button type="button" :disabled="paginaActual === totalPaginas" @click="irAPagina(paginaActual + 1)" class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-75">
          <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3" />
        </button>
        <button type="button" :disabled="paginaActual === totalPaginas" @click="irAPagina(totalPaginas)" class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-75">
          <FontAwesomeIcon :icon="faAnglesRight" class="w-3 h-3" />
        </button>
      </div>
    </div>
  </PageShell>

  <CandidatoDetalleModal
    :is-open="!!candidatoSeleccionadoId"
    :candidato-id="candidatoSeleccionadoId"
    @close="candidatoSeleccionadoId = null"
  />

  <ConfirmModal
    :is-open="!!candidatoAEliminar"
    title="Eliminar postulación"
    :message="`¿Seguro que deseas eliminar la postulación de &quot;${candidatoAEliminar?.nombre}&quot;? Esta acción no se puede deshacer.`"
    :loading="eliminarCandidato.isPending.value"
    loading-label="Eliminando…"
    @confirm="confirmarEliminar"
    @close="candidatoAEliminar = null"
  />

  <ImportarExcelModal
    :is-open="mostrarImportar"
    titulo="Importar especialistas desde Excel"
    :columnas="COLUMNAS_IMPORT_ESPECIALISTAS"
    :subir="importarEspecialistasExcel"
    @importado="importacionCompletada"
    @close="mostrarImportar = false"
  />
</template>
