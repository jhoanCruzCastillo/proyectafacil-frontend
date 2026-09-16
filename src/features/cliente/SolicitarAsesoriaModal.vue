<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faXmark, faComments, faVideo, faPaperPlane, faTriangleExclamation,
  faWandMagicSparkles, faCheck, faChevronLeft, faChevronRight, faChevronDown, faChevronUp,
  faCalendarCheck, faSearch, sectorIcons,
} from '@/lib/icons';
import { useUsuariosQuery } from '@/composables/useUsuarios';
import { useTicketsConsultaQuery } from '@/composables/useTicketsConsulta';
import { useDisponibilidadHorariosQuery } from '@/composables/useDisponibilidadHorarios';
import { ocurrenciasEnRango } from '@/lib/horarioRecurrencia';
import { useCrearSolicitudAsesoria, useAgendadosPorRangoQuery } from '@/composables/useAsesoria';
import { useTemasEspecialidadCatalogoQuery } from '@/composables/useTemasEspecialidad';
import { useSubtemasCatalogoQuery } from '@/composables/useSubtemasEspecialidad';
import { useSessionStore } from '@/stores/session';
import { cuentaEfectivaDe } from '@/lib/permisos';
import { addOns } from '@/data/planes';
import ComprarAddOnModal from '@/features/settings/ComprarAddOnModal.vue';
import type { TipoAsesoria, SolicitudAsesoria, TemaEspecialidad, SubtemaEspecialidad } from '@/types';

const props = defineProps<{ isOpen: boolean; ejemploId?: string }>();
const emit = defineEmits<{ close: []; creada: [solicitud: SolicitudAsesoria] }>();

const DIAS_LARGO = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_CORTO = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const ADDON_CONSULTA = addOns.find((a) => a.id === 'consultoria-1a1') ?? null;

const session = useSessionStore();
const { data: usuariosData } = useUsuariosQuery();
const cuentaId = computed(() => (session.sesion ? cuentaEfectivaDe(usuariosData.value ?? [], session.sesion) : ''));
const { data: tickets } = useTicketsConsultaQuery(cuentaId);
const disponibles = computed(() => (tickets.value ?? []).filter((t) => t.estado === 'disponible'));
const ticketsDisponibles = computed(() => disponibles.value.length);
const sinSaldo = computed(() => ticketsDisponibles.value === 0);
const fichasChat = computed(() => disponibles.value.filter((t) => t.modalidad === 'chat'));
const fichasVideo = computed(() => disponibles.value.filter((t) => t.modalidad === 'video'));
const duracionChat = computed(() => fichasChat.value[0]?.duracionMinutos ?? null);
const duracionVideo = computed(() => fichasVideo.value[0]?.duracionMinutos ?? null);
const showComprarAddon = ref(false);

const { data: temas } = useTemasEspecialidadCatalogoQuery();
const { data: subtemas } = useSubtemasCatalogoQuery();
const crearSolicitud = useCrearSolicitudAsesoria();

type Paso = 'modalidad' | 'chatbot' | 'horario';
type TemaConSubtemas = TemaEspecialidad & { subtemas: SubtemaEspecialidad[] };

const paso = ref<Paso>('modalidad');
const subPaso = ref(1);
const enSelectorTemas = computed(() => paso.value === 'chatbot' && subPaso.value === 1);
const tipo = ref<TipoAsesoria | null>(null);
const subtemaIdsSeleccionados = ref<Set<string>>(new Set());
const temasExpandidos = ref<Set<string>>(new Set());
const busqueda = ref('');
const duda = ref('');
const enviando = ref(false);
// `loteOffset` pagina de a 7 días (0 = el lote que arranca hoy, 1 = los 7 siguientes, …) — no
// puede ir negativo, esas fechas ya pasaron y no se pueden agendar. `diaOffset` es la pestaña
// seleccionada DENTRO del lote visible (0-6).
const loteOffset = ref(0);
const diaOffset = ref(0);
const horarioElegido = ref<{ horaInicio: string; horaFin: string } | null>(null);

function reset() {
  paso.value = 'modalidad';
  subPaso.value = 1;
  tipo.value = null;
  subtemaIdsSeleccionados.value = new Set();
  temasExpandidos.value = new Set();
  busqueda.value = '';
  duda.value = '';
  loteOffset.value = 0;
  diaOffset.value = 0;
  horarioElegido.value = null;
}

function handleClose() {
  reset();
  emit('close');
}

function elegirModalidad(t: TipoAsesoria) {
  tipo.value = t;
  paso.value = 'chatbot';
  subPaso.value = 1;
  const primero = temasConSubtemas.value.find((tema) => tema.subtemas.length > 0);
  temasExpandidos.value = primero ? new Set([primero.id]) : new Set();
}

const temasConSubtemas = computed<TemaConSubtemas[]>(() =>
  (temas.value ?? []).map((t) => ({
    ...t,
    subtemas: (subtemas.value ?? []).filter((s) => s.temaId === t.id),
  })),
);

const temasFiltrados = computed<TemaConSubtemas[]>(() => {
  const q = busqueda.value.trim().toLowerCase();
  if (!q) return temasConSubtemas.value;
  return temasConSubtemas.value
    .map((t) => {
      const temaMatch = t.nombre.toLowerCase().includes(q);
      return {
        ...t,
        subtemas: temaMatch ? t.subtemas : t.subtemas.filter((s) => s.nombre.toLowerCase().includes(q)),
      };
    })
    .filter((t) => t.nombre.toLowerCase().includes(q) || t.subtemas.length > 0);
});

const cantidadSeleccionados = computed(() => subtemaIdsSeleccionados.value.size);

const subtemasElegidos = computed(() => {
  const map = new Map((subtemas.value ?? []).map((s) => [s.id, s]));
  const temaMap = new Map((temas.value ?? []).map((t) => [t.id, t.nombre]));
  return Array.from(subtemaIdsSeleccionados.value)
    .map((id) => {
      const st = map.get(id);
      if (!st) return null;
      return { id, nombre: st.nombre, temaNombre: temaMap.get(st.temaId) ?? null };
    })
    .filter((x): x is { id: string; nombre: string; temaNombre: string | null } => x !== null);
});

function estaExpandido(temaId: string): boolean {
  if (busqueda.value.trim()) return true;
  return temasExpandidos.value.has(temaId);
}

function toggleTemaExpandido(temaId: string) {
  const next = new Set(temasExpandidos.value);
  if (next.has(temaId)) next.delete(temaId);
  else next.add(temaId);
  temasExpandidos.value = next;
}

function toggleSubtema(id: string) {
  const next = new Set(subtemaIdsSeleccionados.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  subtemaIdsSeleccionados.value = next;
}

function seleccionadosEnTema(tema: TemaConSubtemas): number {
  return tema.subtemas.filter((s) => subtemaIdsSeleccionados.value.has(s.id)).length;
}

function temaMarcado(tema: TemaConSubtemas): boolean {
  return seleccionadosEnTema(tema) > 0;
}

function toggleTemaCompleto(tema: TemaConSubtemas, event: Event) {
  event.stopPropagation();
  const next = new Set(subtemaIdsSeleccionados.value);
  const ids = tema.subtemas.map((s) => s.id);
  if (temaMarcado(tema)) {
    for (const id of ids) next.delete(id);
  } else {
    for (const id of ids) next.add(id);
    const exp = new Set(temasExpandidos.value);
    exp.add(tema.id);
    temasExpandidos.value = exp;
  }
  subtemaIdsSeleccionados.value = next;
}

function limpiarSeleccion() {
  subtemaIdsSeleccionados.value = new Set();
}

function continuarTemas() {
  if (cantidadSeleccionados.value === 0) return;
  subPaso.value = 2;
}

function enviarDuda() {
  if (!duda.value.trim()) return;
  if (tipo.value === 'video') {
    paso.value = 'horario';
  } else {
    void enviarSolicitud();
  }
}

async function enviarSolicitud(horario?: { fecha: string; horaInicio: string; horaFin: string }) {
  const ids = Array.from(subtemaIdsSeleccionados.value);
  if (!session.sesion || !tipo.value || ids.length === 0) return;
  enviando.value = true;
  try {
    const solicitud = await crearSolicitud.mutateAsync({
      clienteId: session.sesion.usuarioId,
      tipo: tipo.value,
      subtemaIds: ids,
      mensajeInicial: duda.value.trim(),
      ejemploId: props.ejemploId,
      horarioFecha: horario?.fecha,
      horarioHoraInicio: horario?.horaInicio,
      horarioHoraFin: horario?.horaFin,
    });
    reset();
    emit('creada', solicitud);
  } finally {
    enviando.value = false;
  }
}

// --- Ruta video: grilla de horarios agregados de todos los asesores, próximos 7 días ---
const { data: bloquesAgregados } = useDisponibilidadHorariosQuery(() => paso.value === 'horario');

// `toISOString()` convierte a UTC — en Lima (UTC-5), cualquier hora local desde las 7pm en
// adelante cae ya en el día siguiente en UTC, desalineando el `iso` enviado al backend respecto
// al `diaSemana` mostrado (que sí es local). Se arma el ISO a mano con los componentes locales.
function fechaISOLocal(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function mesCorto(fecha: Date): string {
  return fecha.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '');
}

const proximosDias = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + loteOffset.value * 7 + i);
    const jsDay = d.getDay();
    return { fecha: d, diaSemana: jsDay === 0 ? 7 : jsDay, iso: fechaISOLocal(d) };
  }),
);
const diaActivo = computed(() => proximosDias.value[diaOffset.value]);

function loteAnterior() {
  if (loteOffset.value === 0) return;
  loteOffset.value -= 1;
  diaOffset.value = 0;
  horarioElegido.value = null;
}
function loteSiguiente() {
  loteOffset.value += 1;
  diaOffset.value = 0;
  horarioElegido.value = null;
}

// Bloques ya agendados dentro del lote visible — para saber, cuando un horario recurrente lo
// ofrece más de un asesor, si TODOS ya están ocupados esa fecha puntual o si todavía queda
// alguno libre (ver AsesoriaController::agendadosPorRango).
const { data: agendadosData } = useAgendadosPorRangoQuery(
  () => proximosDias.value[0].iso,
  () => proximosDias.value[6].iso,
  () => paso.value === 'horario',
);

function horaADecimal(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h + m / 60;
}

function horaDeDecimal(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

// Cápsulas de 1 hora completamente contenidas en [horaInicio, horaFin) — pedido explícito del
// usuario: un bloque "todo el día" (00:00-23:59) no debe ofrecerse como un único horario gigante,
// sino como un catálogo de franjas de 1 hora para elegir (igual que cualquier otro bloque largo).
// "23:59" es el sentinel de "todo el día" (ver DocentesController::actualizarHorario) — se trata
// como fin de día para no perder la última cápsula (23:00-23:59).
function capsulasEnRango(horaInicio: string, horaFin: string): Array<{ horaInicio: string; horaFin: string }> {
  const inicio = horaADecimal(horaInicio);
  const fin = horaFin === '23:59' ? 24 : horaADecimal(horaFin);
  const capsulas: Array<{ horaInicio: string; horaFin: string }> = [];
  for (let h = Math.ceil(inicio); h + 1 <= fin; h++) {
    capsulas.push({ horaInicio: horaDeDecimal(h), horaFin: h + 1 === 24 ? '23:59' : horaDeDecimal(h + 1) });
  }
  return capsulas;
}

function horaCapsulaLabel(hora: string): string {
  const h = Number(hora.split(':')[0]);
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
}

const bloquesDelDia = computed(() => {
  const crudos = ocurrenciasEnRango(bloquesAgregados.value ?? [], diaActivo.value.iso, diaActivo.value.iso);
  const porHorario = new Map<string, Set<string>>();
  for (const b of crudos) {
    for (const capsula of capsulasEnRango(b.horaInicio, b.horaFin)) {
      const clave = `${capsula.horaInicio}|${capsula.horaFin}`;
      const docentes = porHorario.get(clave) ?? new Set<string>();
      docentes.add(b.docenteId);
      porHorario.set(clave, docentes);
    }
  }

  const ocupados = new Set(
    (agendadosData.value ?? [])
      .filter((a) => a.fecha === diaActivo.value.iso)
      .map((a) => `${a.docenteId}|${a.horaInicio}|${a.horaFin}`),
  );

  return Array.from(porHorario.entries())
    .map(([clave, docentes]) => {
      const [horaInicio, horaFin] = clave.split('|');
      const libre = Array.from(docentes).some((docenteId) => !ocupados.has(`${docenteId}|${horaInicio}|${horaFin}`));
      return { horaInicio, horaFin, disponible: libre, label: `${horaCapsulaLabel(horaInicio)} a ${horaCapsulaLabel(horaFin)}` };
    })
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
});

watch(diaOffset, () => { horarioElegido.value = null; });

function confirmarHorario() {
  if (!horarioElegido.value) return;
  void enviarSolicitud({ fecha: diaActivo.value.iso, ...horarioElegido.value });
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="handleClose">
      <Transition name="pop" appear>
        <div
          v-if="isOpen"
          class="bg-white rounded-2xl shadow-modal w-full max-h-[90vh] flex flex-col"
          :class="enSelectorTemas ? 'max-w-xl' : 'max-w-lg'"
          @click.stop
        >
          <div class="flex items-start justify-between p-6 pb-3 shrink-0" :class="enSelectorTemas ? 'pb-2' : 'pb-4'">
            <div v-if="!enSelectorTemas">
              <h2 class="text-lg font-bold text-heading">
                {{ paso === 'modalidad' ? '¿Cómo prefieres tu asesoría?' : paso === 'horario' ? 'Elige un horario para tu videollamada' : 'Cuéntanos tu consulta' }}
              </h2>
              <p class="text-sm text-muted mt-0.5">
                {{ paso === 'modalidad' ? 'Elige la modalidad que más te acomode.' : paso === 'horario' ? 'No verás qué asesor te atenderá hasta que se confirme tu cita.' : 'Un poco de contexto nos ayuda a asignarte mejor.' }}
              </p>
            </div>
            <div v-else />
            <button @click="handleClose" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100 shrink-0">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <div class="px-6 pb-6 overflow-y-auto flex-1 min-h-0">
            <!-- Sin saldo -->
            <div v-if="sinSaldo" class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <FontAwesomeIcon :icon="faTriangleExclamation" class="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div class="flex-1">
                <p>No tienes consultas disponibles.</p>
                <button v-if="ADDON_CONSULTA" @click="showComprarAddon = true" type="button" class="mt-1 font-semibold underline hover:text-amber-900">
                  Comprar consulta adicional · ${{ ADDON_CONSULTA.precio }}
                </button>
              </div>
            </div>

            <!-- Paso 0: modalidad -->
            <div v-else-if="paso === 'modalidad'" class="grid grid-cols-2 gap-3">
              <button
                @click="elegirModalidad('chat')"
                type="button"
                :disabled="fichasChat.length === 0"
                :title="fichasChat.length === 0 ? 'No tienes fichas de chat disponibles' : undefined"
                class="p-5 rounded-xl border border-gray-200 hover:border-brand-500 hover:bg-brand-50/50 transition-colors text-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-transparent"
              >
                <div class="w-12 h-12 mx-auto rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mb-3">
                  <FontAwesomeIcon :icon="faComments" class="w-5 h-5" />
                </div>
                <p class="font-semibold text-heading text-sm">Por chat</p>
                <p class="text-xs text-muted mt-1">Recibe respuesta cuando el asesor esté disponible, no es en tiempo real.</p>
                <p class="text-[11px] font-medium mt-2" :class="fichasChat.length > 0 ? 'text-brand-600' : 'text-red-500'">
                  {{ fichasChat.length }} ficha{{ fichasChat.length === 1 ? '' : 's' }} disponible{{ fichasChat.length === 1 ? '' : 's' }}<template v-if="duracionChat"> · {{ duracionChat }} min</template>
                </p>
              </button>
              <button
                @click="elegirModalidad('video')"
                type="button"
                :disabled="fichasVideo.length === 0"
                :title="fichasVideo.length === 0 ? 'No tienes fichas de videoconferencia disponibles' : undefined"
                class="p-5 rounded-xl border border-gray-200 hover:border-brand-500 hover:bg-brand-50/50 transition-colors text-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-transparent"
              >
                <div class="w-12 h-12 mx-auto rounded-full bg-violet-100 text-violet-600 flex items-center justify-center mb-3">
                  <FontAwesomeIcon :icon="faVideo" class="w-5 h-5" />
                </div>
                <p class="font-semibold text-heading text-sm">Por videollamada</p>
                <p class="text-xs text-muted mt-1">Agenda un horario y conéctate en vivo con un asesor.</p>
                <p class="text-[11px] font-medium mt-2" :class="fichasVideo.length > 0 ? 'text-violet-600' : 'text-red-500'">
                  {{ fichasVideo.length }} ficha{{ fichasVideo.length === 1 ? '' : 's' }} disponible{{ fichasVideo.length === 1 ? '' : 's' }}<template v-if="duracionVideo"> · {{ duracionVideo }} min</template>
                </p>
              </button>
            </div>

            <!-- Pasos: temas/subtemas (multi-select) → duda -->
            <div v-else-if="paso === 'chatbot' && subPaso === 1" class="space-y-4">
              <div class="flex items-start gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 class="text-base font-bold text-heading leading-snug">¿Sobre qué tema es tu consulta?</h3>
                  <p class="text-sm text-muted mt-0.5">Selecciona uno o varios temas y subtemas que se relacionen con tu consulta.</p>
                </div>
              </div>

              <div class="relative">
                <FontAwesomeIcon :icon="faSearch" class="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  v-model="busqueda"
                  type="text"
                  placeholder="Buscar temas o subtemas..."
                  class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                />
              </div>

              <p v-if="temasFiltrados.length === 0" class="text-sm text-muted py-6 text-center">
                No hay temas ni subtemas que coincidan con "{{ busqueda }}".
              </p>

              <div v-else class="space-y-2 max-h-[42vh] overflow-y-auto pr-0.5">
                <div
                  v-for="tema in temasFiltrados"
                  :key="tema.id"
                  class="rounded-xl border overflow-hidden transition-colors duration-75"
                  :class="temaMarcado(tema) ? 'border-brand-400 bg-brand-50/70' : 'border-gray-200 bg-white'"
                >
                  <div
                    class="flex items-center gap-2.5 px-3.5 py-3 cursor-pointer select-none"
                    role="button"
                    tabindex="0"
                    @click="toggleTemaExpandido(tema.id)"
                    @keydown.enter.prevent="toggleTemaExpandido(tema.id)"
                    @keydown.space.prevent="toggleTemaExpandido(tema.id)"
                  >
                    <div
                      class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      :style="{ backgroundColor: tema.colorAccent + '18', color: tema.colorAccent }"
                    >
                      <FontAwesomeIcon v-if="sectorIcons[tema.icono]" :icon="sectorIcons[tema.icono]" class="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="checkbox"
                      class="rounded border-gray-300 text-brand-600 focus:ring-brand-300 shrink-0 w-4 h-4"
                      :checked="temaMarcado(tema)"
                      :aria-label="`Seleccionar ${tema.nombre}`"
                      @click.prevent.stop="toggleTemaCompleto(tema, $event)"
                    />
                    <span class="flex-1 min-w-0 text-sm font-semibold text-heading leading-snug">{{ tema.nombre }}</span>
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/80 text-muted border border-gray-200/80 shrink-0 whitespace-nowrap">
                      {{ tema.subtemas.length }} subtema{{ tema.subtemas.length === 1 ? '' : 's' }}
                    </span>
                    <FontAwesomeIcon
                      :icon="estaExpandido(tema.id) ? faChevronUp : faChevronDown"
                      class="w-3 h-3 text-gray-400 shrink-0"
                    />
                  </div>

                  <div v-if="estaExpandido(tema.id)" class="px-2 pb-2">
                    <label
                      v-for="sub in tema.subtemas"
                      :key="sub.id"
                      class="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer"
                      :class="subtemaIdsSeleccionados.has(sub.id) ? 'bg-brand-100/70' : 'hover:bg-white/70'"
                    >
                      <input
                        type="checkbox"
                        class="rounded border-gray-300 text-brand-600 focus:ring-brand-300 w-4 h-4"
                        :checked="subtemaIdsSeleccionados.has(sub.id)"
                        @change="toggleSubtema(sub.id)"
                      />
                      <span class="text-sm text-heading leading-snug">{{ sub.nombre }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-between pt-1">
                <p class="text-sm font-medium" :class="cantidadSeleccionados > 0 ? 'text-brand-600' : 'text-muted'">
                  {{ cantidadSeleccionados }} subtema{{ cantidadSeleccionados === 1 ? '' : 's' }} seleccionado{{ cantidadSeleccionados === 1 ? '' : 's' }}
                </p>
                <button
                  v-if="cantidadSeleccionados > 0"
                  type="button"
                  class="text-sm text-muted hover:text-heading"
                  @click="limpiarSeleccion"
                >
                  Limpiar selección
                </button>
              </div>

              <div class="flex justify-end">
                <button
                  type="button"
                  :disabled="cantidadSeleccionados === 0"
                  class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center gap-2"
                  @click="continuarTemas"
                >
                  Continuar
                  <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3" />
                </button>
              </div>
            </div>

            <div v-else-if="paso === 'chatbot'" class="space-y-4">
              <p class="text-xs font-semibold text-brand-600">Paso 2 de {{ tipo === 'video' ? 3 : 2 }}</p>

              <div class="flex items-start gap-2">
                <div class="w-7 h-7 rounded-full bg-gray-100 text-brand-600 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3 h-3" />
                </div>
                <div class="flex-1 space-y-2">
                  <div class="bg-gray-50 rounded-xl rounded-tl-none px-3 py-2 text-sm text-heading">Cuéntame más detalles de tu consulta</div>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span
                      v-for="st in subtemasElegidos"
                      :key="st.id"
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-xs font-medium"
                    >
                      {{ st.nombre }}
                      <FontAwesomeIcon :icon="faCheck" class="w-2.5 h-2.5" />
                    </span>
                    <button type="button" class="text-xs font-medium text-brand-600 hover:text-brand-700" @click="subPaso = 1">
                      Cambiar
                    </button>
                  </div>
                  <textarea
                    v-model="duda"
                    rows="4"
                    placeholder="Explica qué necesitas, en qué parte estás atascado y cualquier dato que le sirva al asesor..."
                    class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
                  />
                </div>
              </div>

              <button
                @click="enviarDuda"
                :disabled="!duda.trim() || enviando"
                type="button"
                class="w-full px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center justify-center gap-2"
              >
                <FontAwesomeIcon :icon="faPaperPlane" class="w-3.5 h-3.5" />
                {{ tipo === 'video' ? 'Continuar' : 'Enviar consulta' }}
              </button>
            </div>

            <!-- Ruta video: horario -->
            <div v-else-if="paso === 'horario'" class="space-y-4">
              <div class="flex items-center gap-2">
                <button
                  @click="loteAnterior"
                  :disabled="loteOffset === 0"
                  type="button"
                  class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-75 shrink-0"
                >
                  <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
                </button>
                <div class="flex-1 grid grid-cols-7 gap-1">
                  <button
                    v-for="(d, i) in proximosDias"
                    :key="d.iso"
                    @click="diaOffset = i"
                    type="button"
                    class="relative py-2 rounded-lg border text-center transition-colors"
                    :class="i === diaOffset ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'"
                  >
                    <p class="text-[10px] font-medium">{{ DIAS_CORTO[d.diaSemana] }}</p>
                    <p class="text-xs font-bold">{{ d.fecha.getDate() }}</p>
                    <span class="absolute bottom-0.5 right-1 text-[7px] uppercase" :class="i === diaOffset ? 'text-brand-400' : 'text-gray-400'">{{ mesCorto(d.fecha) }}</span>
                  </button>
                </div>
                <button
                  @click="loteSiguiente"
                  type="button"
                  class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors duration-75 shrink-0"
                >
                  <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3" />
                </button>
              </div>

              <p class="text-sm font-semibold text-heading">Horarios disponibles para {{ DIAS_LARGO[diaActivo.diaSemana] }} {{ diaActivo.fecha.getDate() }}</p>

              <p v-if="bloquesDelDia.length === 0" class="text-sm text-muted py-6 text-center">No hay horarios disponibles este día — prueba otro día.</p>
              <div v-else class="grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto">
                <button
                  v-for="(b, i) in bloquesDelDia"
                  :key="i"
                  @click="b.disponible && (horarioElegido = { horaInicio: b.horaInicio, horaFin: b.horaFin })"
                  :disabled="!b.disponible"
                  :title="!b.disponible ? 'Agendado' : b.label"
                  type="button"
                  class="px-2 py-2 rounded-lg border text-xs text-center transition-colors flex flex-col items-center justify-center gap-0.5"
                  :class="!b.disponible
                    ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                    : horarioElegido?.horaInicio === b.horaInicio ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                >
                  <span class="truncate w-full">{{ b.label }}</span>
                  <span v-if="!b.disponible" class="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Agendado</span>
                  <FontAwesomeIcon v-else-if="horarioElegido?.horaInicio === b.horaInicio" :icon="faCheck" class="w-3 h-3" />
                </button>
              </div>

              <button
                @click="confirmarHorario"
                :disabled="!horarioElegido || enviando"
                type="button"
                class="w-full px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center justify-center gap-2"
              >
                <FontAwesomeIcon :icon="faCalendarCheck" class="w-3.5 h-3.5" />
                Confirmar horario
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>

  <ComprarAddOnModal :is-open="showComprarAddon" :usuario-id="cuentaId" :addon="ADDON_CONSULTA" @close="showComprarAddon = false" />
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
