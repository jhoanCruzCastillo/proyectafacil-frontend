<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faXmark, faClockRotateLeft, faMagnifyingGlass, faPen, faWandMagicSparkles, faTrash,
  faRobot, faChevronUp, faChevronDown, faArrowRight, faChevronLeft,
} from '@/lib/icons';
import { rolUsuarioLabels } from '@/lib/icons';
import { useHistorialFichaQuery } from '@/composables/useHistorialCambios';
import { useUsuariosQuery } from '@/composables/useUsuarios';
import type { AccionCambioCampo, Plantilla } from '@/types';

const props = defineProps<{
  isOpen: boolean;
  ejemploId: string;
  /** Para deducir la sección de filas antiguas que se guardaron antes de que el historial
   * registrara seccionNumero/seccionNombre por su cuenta. */
  plantilla?: Plantilla | null;
}>();

const emit = defineEmits<{ close: [] }>();

const { data: cambiosData } = useHistorialFichaQuery(() => props.ejemploId);
const { data: usuariosData } = useUsuariosQuery();

const ACCION_META: Record<AccionCambioCampo, { label: string; icon: typeof faPen; clase: string }> = {
  editado: { label: 'Editó', icon: faPen, clase: 'bg-emerald-50 text-emerald-700' },
  autocompletado: { label: 'Autocompletó', icon: faWandMagicSparkles, clase: 'bg-violet-50 text-violet-700' },
  eliminado: { label: 'Eliminó', icon: faTrash, clase: 'bg-red-50 text-red-700' },
};

interface Fila {
  key: string;
  fecha: string;
  usuarioId: string;
  identificador: string;
  etiqueta: string;
  valorAnterior: string;
  valorNuevo: string;
  accion: AccionCambioCampo;
  seccionNumero: string;
  seccionNombre: string;
}

/** Fallback para filas guardadas antes de que el historial registrara la sección por su cuenta. */
function seccionDeIdentificador(identificador: string): { numero: string; nombre: string } | null {
  if (!props.plantilla) return null;
  for (const seccion of props.plantilla.secciones) {
    for (const sub of seccion.subsecciones) {
      if (sub.campos.some((c) => c.identificador === identificador)) {
        return { numero: seccion.numero, nombre: seccion.nombre };
      }
    }
  }
  return null;
}

const filas = computed<Fila[]>(() => {
  const out: Fila[] = [];
  for (const cambio of cambiosData.value ?? []) {
    for (const campo of cambio.campos) {
      const fallback = campo.seccionNumero ? null : seccionDeIdentificador(campo.identificador);
      out.push({
        key: `${cambio.id}-${campo.identificador}`,
        fecha: cambio.fecha,
        usuarioId: cambio.usuarioId,
        identificador: campo.identificador,
        etiqueta: campo.etiqueta,
        valorAnterior: campo.valorAnterior,
        valorNuevo: campo.valorNuevo,
        accion: campo.accion ?? 'editado',
        seccionNumero: campo.seccionNumero ?? fallback?.numero ?? '',
        seccionNombre: campo.seccionNombre ?? fallback?.nombre ?? 'Sección desconocida',
      });
    }
  }
  return out;
});

function iniciales(nombre: string): string {
  return nombre.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}
function usuarioDe(usuarioId: string) {
  return (usuariosData.value ?? []).find((u) => u.id === usuarioId) ?? null;
}
function actorNombre(fila: Fila): string {
  if (fila.accion === 'autocompletado') return 'Asesor de IA';
  return usuarioDe(fila.usuarioId)?.nombre ?? 'Usuario eliminado';
}
function actorRolLabel(fila: Fila): string {
  if (fila.accion === 'autocompletado') return 'IA del sistema';
  const u = usuarioDe(fila.usuarioId);
  return u ? rolUsuarioLabels[u.rol] : '';
}

// --- Filtros ------------------------------------------------------------------------------------

const busqueda = ref('');
const filtroSeccion = ref('');
const filtroUsuario = ref('');
const filtroAccion = ref<'' | AccionCambioCampo>('');
const filtroDias = ref('30');

const opcionesSeccion = computed(() => {
  const map = new Map<string, string>();
  for (const f of filas.value) map.set(f.seccionNumero, `Sección ${f.seccionNumero}: ${f.seccionNombre}`);
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
});

const opcionesUsuario = computed(() => {
  const map = new Map<string, string>();
  for (const f of filas.value) map.set(f.accion === 'autocompletado' ? 'ia' : f.usuarioId, actorNombre(f));
  return [...map.entries()];
});

const busquedaNorm = computed(() => busqueda.value.trim().toLowerCase());

const filtrados = computed(() => {
  const ahora = Date.now();
  const diasNum = Number(filtroDias.value);
  return filas.value.filter((f) => {
    if (filtroSeccion.value && f.seccionNumero !== filtroSeccion.value) return false;
    if (filtroUsuario.value) {
      const actorId = f.accion === 'autocompletado' ? 'ia' : f.usuarioId;
      if (actorId !== filtroUsuario.value) return false;
    }
    if (filtroAccion.value && f.accion !== filtroAccion.value) return false;
    if (diasNum > 0 && ahora - new Date(f.fecha).getTime() > diasNum * 24 * 60 * 60 * 1000) return false;
    if (busquedaNorm.value) {
      const haystack = `${f.etiqueta} ${f.identificador} ${f.valorAnterior} ${f.valorNuevo} ${actorNombre(f)}`.toLowerCase();
      if (!haystack.includes(busquedaNorm.value)) return false;
    }
    return true;
  });
});

const sortDir = ref<'asc' | 'desc'>('desc');
function toggleSort() {
  sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc';
}
const ordenados = computed(() => {
  const factor = sortDir.value === 'desc' ? -1 : 1;
  return [...filtrados.value].sort((a, b) => factor * (new Date(a.fecha).getTime() - new Date(b.fecha).getTime()));
});

// --- Paginación -----------------------------------------------------------------------------

const PAGE_SIZE = 8;
const pagina = ref(1);
watch([busquedaNorm, filtroSeccion, filtroUsuario, filtroAccion, filtroDias], () => { pagina.value = 1; });
watch(() => props.isOpen, (abierto) => { if (abierto) pagina.value = 1; });

const totalPaginas = computed(() => Math.max(1, Math.ceil(ordenados.value.length / PAGE_SIZE)));
const filasPagina = computed(() => ordenados.value.slice((pagina.value - 1) * PAGE_SIZE, pagina.value * PAGE_SIZE));
const numerosPagina = computed(() => {
  const total = totalPaginas.value;
  const actual = pagina.value;
  const inicio = Math.max(1, Math.min(actual - 2, total - 4));
  const fin = Math.min(total, inicio + 4);
  return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
});

function formatFechaHora(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso);
  return {
    fecha: d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }),
    hora: d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-6xl max-h-[88vh] overflow-hidden flex flex-col" @click.stop>
          <div class="flex items-center justify-between p-6 pb-4 shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faClockRotateLeft" class="w-4 h-4" />
              </div>
              <div>
                <h2 class="text-lg font-bold text-heading">Historial de cambios</h2>
                <p class="text-sm text-muted">Quién editó esta ficha y qué cambios se realizaron en sus campos.</p>
              </div>
            </div>
            <button @click="emit('close')" type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <div class="px-6 pb-4 shrink-0 flex flex-wrap items-center gap-2">
            <div class="relative flex-1 min-w-[220px]">
              <FontAwesomeIcon :icon="faMagnifyingGlass" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
              <input
                v-model="busqueda"
                type="text"
                placeholder="Buscar por campo, valor o usuario..."
                class="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            <select v-model="filtroSeccion" class="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
              <option value="">Todas las secciones</option>
              <option v-for="[val, label] in opcionesSeccion" :key="val" :value="val">{{ label }}</option>
            </select>
            <select v-model="filtroUsuario" class="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
              <option value="">Todos los usuarios</option>
              <option v-for="[val, label] in opcionesUsuario" :key="val" :value="val">{{ label }}</option>
            </select>
            <select v-model="filtroAccion" class="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
              <option value="">Todas las acciones</option>
              <option v-for="(meta, val) in ACCION_META" :key="val" :value="val">{{ meta.label }}</option>
            </select>
            <select v-model="filtroDias" class="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="0">Todo el tiempo</option>
            </select>
          </div>

          <div class="flex-1 overflow-auto px-6">
            <table v-if="ordenados.length > 0" class="w-full text-sm border-collapse">
              <thead class="sticky top-0 bg-white">
                <tr class="text-left text-[11px] font-semibold uppercase tracking-wide text-muted border-b border-gray-100">
                  <th class="py-2 pr-4">
                    <button type="button" @click="toggleSort" class="flex items-center gap-1 hover:text-heading transition-colors duration-75">
                      Fecha y hora
                      <FontAwesomeIcon :icon="sortDir === 'desc' ? faChevronDown : faChevronUp" class="w-2.5 h-2.5" />
                    </button>
                  </th>
                  <th class="py-2 pr-4">Usuario</th>
                  <th class="py-2 pr-4">Acción</th>
                  <th class="py-2 pr-4">ID del campo</th>
                  <th class="py-2 pr-4">Campo / Sección</th>
                  <th class="py-2 pr-4">Valor anterior</th>
                  <th class="py-2 pr-2"></th>
                  <th class="py-2">Valor nuevo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="f in filasPagina" :key="f.key" class="border-b border-gray-50 align-top hover:bg-gray-50/60 transition-colors duration-75">
                  <td class="py-3 pr-4 whitespace-nowrap text-xs text-muted tabular-nums">
                    {{ formatFechaHora(f.fecha).fecha }}
                    <div>{{ formatFechaHora(f.fecha).hora }}</div>
                  </td>
                  <td class="py-3 pr-4 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                      <div
                        class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        :class="f.accion === 'autocompletado' ? 'bg-violet-600 text-white' : 'bg-brand-100 text-brand-700'"
                      >
                        <FontAwesomeIcon v-if="f.accion === 'autocompletado'" :icon="faRobot" class="w-3 h-3" />
                        <template v-else>{{ iniciales(actorNombre(f)) }}</template>
                      </div>
                      <div class="min-w-0">
                        <p class="text-xs font-medium text-heading truncate">{{ actorNombre(f) }}</p>
                        <p class="text-[10px] text-muted truncate">{{ actorRolLabel(f) }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="py-3 pr-4 whitespace-nowrap">
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium" :class="ACCION_META[f.accion].clase">
                      <FontAwesomeIcon :icon="ACCION_META[f.accion].icon" class="w-2.5 h-2.5" />
                      {{ ACCION_META[f.accion].label }}
                    </span>
                  </td>
                  <td class="py-3 pr-4 whitespace-nowrap font-mono text-xs text-muted">{{ f.identificador }}</td>
                  <td class="py-3 pr-4 min-w-[160px]">
                    <p class="text-[10px] text-muted">Sección {{ f.seccionNumero }}: {{ f.seccionNombre }}</p>
                    <p class="text-xs font-semibold text-heading">{{ f.etiqueta }}</p>
                  </td>
                  <td class="py-3 pr-4 max-w-[180px] text-xs text-gray-500 break-words">{{ f.valorAnterior || '—' }}</td>
                  <td class="py-3 pr-2 text-gray-300">
                    <FontAwesomeIcon :icon="faArrowRight" class="w-3 h-3" />
                  </td>
                  <td class="py-3 max-w-[180px] text-xs font-medium text-heading break-words">{{ f.valorNuevo || '—' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="text-sm text-muted text-center py-12">
              {{ filas.length === 0 ? 'Todavía no hay cambios guardados.' : 'Ningún cambio coincide con los filtros.' }}
            </p>
          </div>

          <div class="shrink-0 px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-4">
            <p class="text-xs text-muted">
              Mostrando {{ filasPagina.length }} de {{ ordenados.length }} cambios
            </p>
            <div v-if="totalPaginas > 1" class="flex items-center gap-1">
              <button
                type="button"
                :disabled="pagina === 1"
                @click="pagina--"
                class="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-75"
              >
                <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
              </button>
              <button
                v-for="n in numerosPagina"
                :key="n"
                type="button"
                @click="pagina = n"
                class="w-7 h-7 rounded-md text-xs font-medium transition-colors duration-75"
                :class="n === pagina ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-100'"
              >
                {{ n }}
              </button>
              <button
                type="button"
                :disabled="pagina === totalPaginas"
                @click="pagina++"
                class="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-75"
              >
                <FontAwesomeIcon :icon="faArrowRight" class="w-3 h-3" />
              </button>
            </div>
            <button
              @click="emit('close')"
              type="button"
              class="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 shrink-0"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.pop-enter-active,
.pop-leave-active {
  transition: all 0.12s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.97) translateY(10px);
}
</style>
