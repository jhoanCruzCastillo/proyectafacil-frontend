<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCircleExclamation, faComments, faVideo, faCalendarDays, faUserCheck, faClock, faBan } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import Avatar from '@/components/Avatar.vue';
import { useSessionStore } from '@/stores/session';
import { useNoAtendidasQuery } from '@/composables/useAsesoria';
import { tiempoRelativo } from '@/lib/tiempoRelativo';
import { colorCategoria, formatFechaHoraVideo } from '@/lib/consultaAsesorUI';
import type { MotivoNoAceptada, SolicitudNoAceptada } from '@/types';

// Pantalla "de pérdidas" del asesor: no hay acciones que tomar acá, es puramente informativa —
// sirve para que dimensione cuánto trabajo se le está escapando y por qué.
const TABS = [
  { value: 'no_aceptadas', label: 'No aceptadas a tiempo' },
  { value: 'agendadas', label: 'Agendadas no atendidas' },
] as const;
type Tab = (typeof TABS)[number]['value'];

const MOTIVO_LABEL: Record<MotivoNoAceptada, string> = {
  tomada_por_otro: 'La tomó otro asesor',
  vencida_sin_respuesta: 'Venció sin respuesta',
  cancelada_por_alumno: 'Cancelada por el alumno',
};

const MOTIVO_CLASE: Record<MotivoNoAceptada, string> = {
  tomada_por_otro: 'bg-amber-50 text-amber-700',
  vencida_sin_respuesta: 'bg-red-50 text-red-600',
  cancelada_por_alumno: 'bg-gray-100 text-gray-600',
};

const MOTIVO_ICONO: Record<MotivoNoAceptada, typeof faUserCheck> = {
  tomada_por_otro: faUserCheck,
  vencida_sin_respuesta: faClock,
  cancelada_por_alumno: faBan,
};

const session = useSessionStore();
const docenteId = computed(() => session.sesion?.usuarioId ?? '');
const { data, isLoading } = useNoAtendidasQuery(docenteId);

const tabActiva = ref<Tab>('no_aceptadas');

const noAceptadas = computed(() => data.value?.noAceptadas ?? []);
const agendadas = computed(() => data.value?.agendadasNoAtendidas ?? []);

const conteo = computed(() => ({
  no_aceptadas: noAceptadas.value.length,
  agendadas: agendadas.value.length,
}));

const tomadasPorOtro = computed(() => noAceptadas.value.filter((s) => s.motivo === 'tomada_por_otro').length);
const vencidas = computed(() => noAceptadas.value.filter((s) => s.motivo === 'vencida_sin_respuesta').length);

function formatFechaHoraExacta(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
}

// Cuándo "terminó" la solicitud, según el motivo — vencida_sin_respuesta nunca vuelve a tocar la
// fila en BD (nadie la actualiza al expirar), así que su `actualizadoEn` seguiría siendo el de la
// creación; el momento real de vencimiento es el SLA que ya se le había calculado al crearla.
function fechaResolucionIso(s: SolicitudNoAceptada): string | null | undefined {
  return s.motivo === 'vencida_sin_respuesta' ? s.slaVenceEn : s.actualizadoEn;
}
</script>

<template>
  <PageShell
    :icon="faCircleExclamation"
    title="No atendidas / reasignadas"
    description="Consultas que te llegaron pero terminaron en otras manos, y citas tuyas que pasaron sin cerrarse."
    content-class="py-5"
    compact
  >
    <template #stats>
      <div class="rounded-xl bg-white/[0.06] border border-white/10 p-4 text-center">
        <p class="text-xs text-white/50">Se las llevó otro asesor</p>
        <p class="text-2xl font-bold text-white mt-1">{{ tomadasPorOtro }}</p>
      </div>
      <div class="rounded-xl bg-white/[0.06] border border-white/10 p-4 text-center">
        <p class="text-xs text-white/50">Vencidas sin respuesta</p>
        <p class="text-2xl font-bold text-white mt-1">{{ vencidas }}</p>
      </div>
      <div class="rounded-xl bg-white/[0.06] border border-white/10 p-4 text-center">
        <p class="text-xs text-white/50">Agendadas no atendidas</p>
        <p class="text-2xl font-bold text-white mt-1">{{ conteo.agendadas }}</p>
      </div>
      <!-- El total es el dato que duele — se destaca en rojo, el resto queda neutro. -->
      <div class="rounded-xl bg-red-500/10 border border-red-500/25 p-4 text-center">
        <p class="text-xs text-red-300/80">Total perdidas</p>
        <p class="text-2xl font-bold text-red-400 mt-1">{{ conteo.no_aceptadas + conteo.agendadas }}</p>
      </div>
    </template>

    <div class="px-6 sm:px-8 pt-5">
      <div class="flex gap-1 border-b border-gray-100 -mb-px">
        <button
          v-for="tab in TABS"
          :key="tab.value"
          @click="tabActiva = tab.value"
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-75 flex items-center gap-2"
          :class="tabActiva === tab.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'"
        >
          {{ tab.label }}
          <span
            class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
            :class="tabActiva === tab.value ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'"
          >
            {{ conteo[tab.value] }}
          </span>
        </button>
      </div>
    </div>

    <p v-if="isLoading" class="text-sm text-muted py-10 text-center">Cargando…</p>

    <!-- Tab 1: le llegaron por broadcast pero nunca fueron suyas -->
    <template v-else-if="tabActiva === 'no_aceptadas'">
      <p v-if="noAceptadas.length === 0" class="text-sm text-muted py-10 text-center">
        No se te ha escapado ninguna consulta. Buen trabajo.
      </p>
      <div v-else class="px-6 sm:px-8 pt-5">
        <div class="rounded-xl border border-gray-200 overflow-hidden">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="text-left text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
                <th class="py-3 px-4">Alumno</th>
                <th class="py-3 px-4">Categoría</th>
                <th class="py-3 px-4">Modalidad</th>
                <th class="py-3 px-4">Motivo</th>
                <th class="py-3 px-4">Quién la atendió</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in noAceptadas" :key="s.id" class="border-b border-gray-100 last:border-b-0">
                <td class="py-4 px-4">
                  <div class="flex items-center gap-3">
                    <Avatar :nombre="s.clienteNombre ?? '?'" :fotoUrl="s.clienteFotoUrl" size="w-11 h-11" />
                    <div class="min-w-0">
                      <p class="font-semibold text-heading text-sm truncate">{{ s.clienteNombre }}</p>
                      <p class="text-xs text-muted">Solicitado {{ tiempoRelativo(s.creadoEn) }}</p>
                      <p class="text-[11px] text-gray-400">{{ formatFechaHoraExacta(s.creadoEn) }}</p>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-4">
                  <span class="px-2.5 py-1 rounded-full text-xs font-medium" :class="colorCategoria(s.sectorNombre)">
                    {{ s.sectorNombre ?? '—' }}
                  </span>
                </td>
                <td class="py-4 px-4">
                  <div class="flex items-center gap-1.5 text-sm text-gray-600">
                    <FontAwesomeIcon :icon="s.tipo === 'video' ? faVideo : faComments" class="w-3.5 h-3.5" />
                    {{ s.tipo === 'video' ? 'Videollamada' : 'Chat' }}
                  </div>
                </td>
                <td class="py-4 px-4">
                  <span class="px-2.5 py-1 rounded-full text-[11px] font-medium inline-flex items-center gap-1.5" :class="MOTIVO_CLASE[s.motivo]">
                    <FontAwesomeIcon :icon="MOTIVO_ICONO[s.motivo]" class="w-2.5 h-2.5" />
                    {{ MOTIVO_LABEL[s.motivo] }}
                  </span>
                  <p v-if="fechaResolucionIso(s)" class="text-[11px] text-muted mt-1">{{ formatFechaHoraExacta(fechaResolucionIso(s)) }}</p>
                </td>
                <td class="py-4 px-4 text-sm">
                  <span v-if="s.docenteNombre" class="text-gray-700">{{ s.docenteNombre }}</span>
                  <span v-else class="text-muted">Nadie</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Tab 2: eran suyas, con hora fijada, y la hora pasó sin cerrarse -->
    <template v-else>
      <p v-if="agendadas.length === 0" class="text-sm text-muted py-10 text-center">
        No tienes citas vencidas sin atender.
      </p>
      <div v-else class="px-6 sm:px-8 pt-5">
        <div class="rounded-xl border border-gray-200 overflow-hidden">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="text-left text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200">
                <th class="py-3 px-4">Alumno</th>
                <th class="py-3 px-4">Categoría</th>
                <th class="py-3 px-4">Modalidad</th>
                <th class="py-3 px-4">Fecha / Hora agendada</th>
                <th class="py-3 px-4">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in agendadas" :key="s.id" class="border-b border-gray-100 last:border-b-0">
                <td class="py-4 px-4">
                  <div class="flex items-center gap-3">
                    <Avatar :nombre="s.clienteNombre ?? '?'" :fotoUrl="s.clienteFotoUrl" size="w-11 h-11" />
                    <div class="min-w-0">
                      <p class="font-semibold text-heading text-sm truncate">{{ s.clienteNombre }}</p>
                      <p class="text-xs text-muted">Solicitado {{ tiempoRelativo(s.creadoEn) }}</p>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-4">
                  <span class="px-2.5 py-1 rounded-full text-xs font-medium" :class="colorCategoria(s.sectorNombre)">
                    {{ s.sectorNombre ?? '—' }}
                  </span>
                </td>
                <td class="py-4 px-4">
                  <div class="flex items-center gap-1.5 text-sm text-gray-600">
                    <FontAwesomeIcon :icon="s.tipo === 'video' ? faVideo : faComments" class="w-3.5 h-3.5" />
                    {{ s.tipo === 'video' ? 'Videollamada' : 'Chat' }}
                  </div>
                </td>
                <td class="py-4 px-4 text-sm text-muted">
                  <span class="flex items-center gap-1">
                    <FontAwesomeIcon :icon="faCalendarDays" class="w-2.5 h-2.5" />
                    {{ formatFechaHoraVideo(s) }}
                  </span>
                </td>
                <td class="py-4 px-4">
                  <span class="px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-600 inline-flex items-center gap-1.5">
                    <FontAwesomeIcon :icon="faClock" class="w-2.5 h-2.5" />
                    Venció sin atender
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </PageShell>
</template>
