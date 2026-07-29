<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faXmark, faComments, faVideo, faPaperPlane, faTriangleExclamation,
  faWandMagicSparkles, faCheck, faChevronLeft, faChevronRight, faCalendarCheck,
} from '@/lib/icons';
import { useSectoresQuery } from '@/composables/useSectores';
import { useUsuariosQuery } from '@/composables/useUsuarios';
import { useTicketsConsultaQuery } from '@/composables/useTicketsConsulta';
import { useDisponibilidadHorariosQuery } from '@/composables/useDisponibilidadHorarios';
import { useCrearSolicitudAsesoria } from '@/composables/useAsesoria';
import { useSessionStore } from '@/stores/session';
import { cuentaEfectivaDe } from '@/lib/permisos';
import { sectorIcons } from '@/lib/icons';
import { addOns } from '@/data/planes';
import ComprarAddOnModal from '@/features/settings/ComprarAddOnModal.vue';
import type { TipoAsesoria, TipoDocumento, SolicitudAsesoria } from '@/types';

const props = defineProps<{ isOpen: boolean; ejemploId?: string }>();
const emit = defineEmits<{ close: []; creada: [solicitud: SolicitudAsesoria] }>();

const TIPOS_DOCUMENTO: { value: TipoDocumento; label: string }[] = [
  { value: 'formatos', label: 'Formatos' },
  { value: 'ioarr', label: 'IOARR' },
  { value: 'fichas_tecnicas', label: 'Fichas Técnicas' },
  { value: 'perfiles', label: 'Perfiles' },
];
const DIAS_LARGO = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_CORTO = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const ADDON_CONSULTA = addOns.find((a) => a.id === 'consultoria-1a1') ?? null;
const UMBRAL_DUDA = 15;

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

const { data: sectores } = useSectoresQuery();
const crearSolicitud = useCrearSolicitudAsesoria();

type Paso = 'modalidad' | 'chatbot' | 'horario';
const paso = ref<Paso>('modalidad');
const subPaso = ref(1);
const tipo = ref<TipoAsesoria | null>(null);
const sectorId = ref<string | null>(null);
const tipoDocumento = ref<TipoDocumento | null>(null);
const duda = ref('');
const pidioAclaracion = ref(false);
const analizando = ref(false);
const enviando = ref(false);
const diaOffset = ref(0);
const horarioElegido = ref<{ horaInicio: string; horaFin: string } | null>(null);

function reset() {
  paso.value = 'modalidad';
  subPaso.value = 1;
  tipo.value = null;
  sectorId.value = null;
  tipoDocumento.value = null;
  duda.value = '';
  pidioAclaracion.value = false;
  analizando.value = false;
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
}

function elegirSector(id: string) {
  sectorId.value = id;
  subPaso.value = 2;
}

function elegirTipoDocumento(v: TipoDocumento) {
  tipoDocumento.value = v;
  subPaso.value = 3;
}

function enviarDuda() {
  const texto = duda.value.trim();
  if (!texto) return;

  if (!pidioAclaracion.value && texto.length < UMBRAL_DUDA) {
    analizando.value = true;
    setTimeout(() => {
      analizando.value = false;
      pidioAclaracion.value = true;
    }, 600);
    return;
  }

  analizando.value = true;
  setTimeout(() => {
    analizando.value = false;
    if (tipo.value === 'video') {
      paso.value = 'horario';
    } else {
      void enviarSolicitud();
    }
  }, 600);
}

async function enviarSolicitud(horario?: { fecha: string; horaInicio: string; horaFin: string }) {
  if (!session.sesion || !tipo.value || !sectorId.value || !tipoDocumento.value) return;
  enviando.value = true;
  const solicitud = await crearSolicitud.mutateAsync({
    clienteId: session.sesion.usuarioId,
    tipo: tipo.value,
    sectorId: sectorId.value,
    tipoDocumento: tipoDocumento.value,
    mensajeInicial: duda.value.trim(),
    ejemploId: props.ejemploId,
    horarioFecha: horario?.fecha,
    horarioHoraInicio: horario?.horaInicio,
    horarioHoraFin: horario?.horaFin,
  });
  enviando.value = false;
  reset();
  emit('creada', solicitud);
}

// --- Ruta video: grilla de horarios agregados de todos los asesores, próximos 7 días ---
const { data: bloquesAgregados } = useDisponibilidadHorariosQuery(() => paso.value === 'horario');

const proximosDias = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const jsDay = d.getDay();
    return { fecha: d, diaSemana: jsDay === 0 ? 7 : jsDay, iso: d.toISOString().slice(0, 10) };
  }),
);
const diaActivo = computed(() => proximosDias.value[diaOffset.value]);
const bloquesDelDia = computed(() =>
  (bloquesAgregados.value ?? [])
    .filter((b) => b.diaSemana === diaActivo.value.diaSemana)
    .slice()
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
);

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
        <div v-if="isOpen" class="bg-white rounded-2xl shadow-modal w-full max-w-lg max-h-[85vh] overflow-y-auto" @click.stop>
          <div class="flex items-start justify-between p-6 pb-4">
            <div>
              <h2 class="text-lg font-bold text-heading">
                {{ paso === 'modalidad' ? '¿Cómo prefieres tu asesoría?' : paso === 'horario' ? 'Elige un horario para tu videollamada' : 'Cuéntanos tu consulta' }}
              </h2>
              <p class="text-sm text-muted mt-0.5">
                {{ paso === 'modalidad' ? 'Elige la modalidad que más te acomode.' : paso === 'horario' ? 'No verás qué asesor te atenderá hasta que se confirme tu cita.' : 'Te haremos algunas preguntas para entender mejor tu duda.' }}
              </p>
            </div>
            <button @click="handleClose" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100 shrink-0">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <div class="px-6 pb-6">
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

            <!-- Pasos 1-3: chatbot guiado -->
            <div v-else-if="paso === 'chatbot'" class="space-y-4">
              <p class="text-xs font-semibold text-brand-600">Paso {{ subPaso }} de 3</p>

              <div class="flex items-start gap-2">
                <div class="w-7 h-7 rounded-full bg-gray-100 text-brand-600 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3 h-3" />
                </div>
                <div class="flex-1">
                  <div class="bg-gray-50 rounded-xl rounded-tl-none px-3 py-2 text-sm text-heading">¿Sobre qué sector es tu consulta?</div>
                  <div v-if="!sectorId" class="flex flex-wrap gap-2 mt-2">
                    <button
                      v-for="s in sectores"
                      :key="s.id"
                      @click="elegirSector(s.id)"
                      type="button"
                      class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-brand-500 hover:bg-brand-50 transition-colors flex items-center gap-1.5"
                    >
                      <FontAwesomeIcon v-if="sectorIcons[s.icono]" :icon="sectorIcons[s.icono]" class="w-3 h-3" />
                      {{ s.nombre }}
                    </button>
                  </div>
                  <div v-else class="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-xs font-medium">
                    {{ sectores?.find((s) => s.id === sectorId)?.nombre }}
                    <FontAwesomeIcon :icon="faCheck" class="w-2.5 h-2.5" />
                  </div>
                </div>
              </div>

              <div v-if="sectorId" class="flex items-start gap-2">
                <div class="w-7 h-7 rounded-full bg-gray-100 text-brand-600 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3 h-3" />
                </div>
                <div class="flex-1">
                  <div class="bg-gray-50 rounded-xl rounded-tl-none px-3 py-2 text-sm text-heading">¿Qué tipo de documento te genera dudas?</div>
                  <div v-if="!tipoDocumento" class="flex flex-wrap gap-2 mt-2">
                    <button
                      v-for="td in TIPOS_DOCUMENTO"
                      :key="td.value"
                      @click="elegirTipoDocumento(td.value)"
                      type="button"
                      class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-brand-500 hover:bg-brand-50 transition-colors"
                    >
                      {{ td.label }}
                    </button>
                  </div>
                  <div v-else class="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-xs font-medium">
                    {{ TIPOS_DOCUMENTO.find((td) => td.value === tipoDocumento)?.label }}
                    <FontAwesomeIcon :icon="faCheck" class="w-2.5 h-2.5" />
                  </div>
                </div>
              </div>

              <div v-if="tipoDocumento" class="flex items-start gap-2">
                <div class="w-7 h-7 rounded-full bg-gray-100 text-brand-600 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3 h-3" />
                </div>
                <div class="flex-1 space-y-2">
                  <div class="bg-gray-50 rounded-xl rounded-tl-none px-3 py-2 text-sm text-heading">Cuéntame tu duda específica</div>
                  <div v-if="pidioAclaracion" class="bg-gray-50 rounded-xl rounded-tl-none px-3 py-2 text-sm text-heading">
                    Cuéntame un poco más — ¿qué parte específica no te queda clara?
                  </div>
                  <textarea
                    v-model="duda"
                    rows="3"
                    placeholder="Escribe tu duda con el mayor detalle posible..."
                    class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none"
                  />
                  <p v-if="analizando" class="text-xs text-muted flex items-center gap-1.5">
                    <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3 h-3 animate-pulse" />
                    Analizando tu consulta...
                  </p>
                </div>
              </div>

              <button
                v-if="tipoDocumento"
                @click="enviarDuda"
                :disabled="!duda.trim() || analizando || enviando"
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
                  @click="diaOffset = Math.max(0, diaOffset - 1)"
                  :disabled="diaOffset === 0"
                  type="button"
                  class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors duration-75 shrink-0"
                >
                  <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
                </button>
                <div class="flex-1 grid grid-cols-7 gap-1">
                  <button
                    v-for="(d, i) in proximosDias"
                    :key="d.iso"
                    @click="diaOffset = i"
                    type="button"
                    class="py-2 rounded-lg border text-center transition-colors"
                    :class="i === diaOffset ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'"
                  >
                    <p class="text-[10px] font-medium">{{ DIAS_CORTO[d.diaSemana] }}</p>
                    <p class="text-xs font-bold">{{ d.fecha.getDate() }}</p>
                  </button>
                </div>
                <button
                  @click="diaOffset = Math.min(6, diaOffset + 1)"
                  :disabled="diaOffset === 6"
                  type="button"
                  class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors duration-75 shrink-0"
                >
                  <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3" />
                </button>
              </div>

              <p class="text-sm font-semibold text-heading">Horarios disponibles para {{ DIAS_LARGO[diaActivo.diaSemana] }} {{ diaActivo.fecha.getDate() }}</p>

              <p v-if="bloquesDelDia.length === 0" class="text-sm text-muted py-6 text-center">No hay horarios disponibles este día — prueba otro día.</p>
              <div v-else class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                <button
                  v-for="(b, i) in bloquesDelDia"
                  :key="i"
                  @click="horarioElegido = { horaInicio: b.horaInicio, horaFin: b.horaFin }"
                  type="button"
                  class="px-3 py-2.5 rounded-lg border text-sm text-left transition-colors flex items-center justify-between"
                  :class="horarioElegido?.horaInicio === b.horaInicio ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                >
                  {{ b.horaInicio }} - {{ b.horaFin }}
                  <FontAwesomeIcon v-if="horarioElegido?.horaInicio === b.horaInicio" :icon="faCheck" class="w-3 h-3" />
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
