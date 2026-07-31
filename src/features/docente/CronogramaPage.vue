<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCalendarCheck, faCalendarDays, faChevronLeft, faChevronRight } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import { useSessionStore } from '@/stores/session';
import { useDocentesQuery } from '@/composables/useDocentes';
import { useMisSolicitudesQuery } from '@/composables/useAsesoria';

// Mismo patrón de grilla semanal que "Mi disponibilidad" (HorarioDocenteEditor.vue) — misma
// escala de filas (FILA_PX + GAP_PX por hora) para que los bloques de citas reales, que NO están
// alineados a la grilla (pedido explícito: "los rectángulos de colores pueden ir sobre las
// grillas"), se puedan posicionar en px a partir de su hora real sin depender de measurements.
const DIAS: { valor: number; corta: string }[] = [
  { valor: 1, corta: 'Lun' },
  { valor: 2, corta: 'Mar' },
  { valor: 3, corta: 'Mié' },
  { valor: 4, corta: 'Jue' },
  { valor: 5, corta: 'Vie' },
  { valor: 6, corta: 'Sáb' },
  { valor: 7, corta: 'Dom' },
];

const FILA_PX = 32;
const GAP_PX = 4;
const PADDING_PX = 4;
const ALTO_VISIBLE_PX = 15 * (FILA_PX + GAP_PX);

const slots = computed(() => {
  const lista: number[] = [];
  for (let h = 0; h < 24; h++) lista.push(h);
  return lista;
});
const alturaTotalPx = slots.value.length * FILA_PX + (slots.value.length - 1) * GAP_PX + 2 * PADDING_PX;

function topPx(horaDecimal: number): number {
  return PADDING_PX + horaDecimal * (FILA_PX + GAP_PX);
}

function horaLabel(slot: number): string {
  const ampm = slot < 12 ? 'am' : 'pm';
  const h12 = slot % 12 === 0 ? 12 : slot % 12;
  return `${h12} ${ampm}`;
}

function horaADecimal(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h + m / 60;
}

function horaCorta(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const session = useSessionStore();
const docenteId = computed(() => session.sesion?.usuarioId ?? '');

const { data: docentes, isLoading: cargandoDocentes } = useDocentesQuery();
const { data: solicitudes, isLoading: cargandoSolicitudes } = useMisSolicitudesQuery(docenteId, 'asesor');
const isLoading = computed(() => cargandoDocentes.value || cargandoSolicitudes.value);

const propio = computed(() => docentes.value?.find((d) => d.id === docenteId.value));

// Navegación de semana — igual a HorarioDocenteEditor.vue.
const semanaOffset = ref(0);

function inicioSemana(offset: number): Date {
  const hoy = new Date();
  const diaSemanaHoy = hoy.getDay();
  const diffALunes = diaSemanaHoy === 0 ? -6 : 1 - diaSemanaHoy;
  const lunes = new Date(hoy);
  lunes.setHours(0, 0, 0, 0);
  lunes.setDate(hoy.getDate() + diffALunes + offset * 7);
  return lunes;
}

const fechasSemana = computed(() => {
  const lunes = inicioSemana(semanaOffset.value);
  return DIAS.map((_, i) => {
    const fecha = new Date(lunes);
    fecha.setDate(lunes.getDate() + i);
    return fecha;
  });
});

const rangoSemanaTexto = computed(() => {
  const primero = fechasSemana.value[0];
  const ultimo = fechasSemana.value[6];
  const mesPrimero = primero.toLocaleDateString('es-PE', { month: 'long' });
  const mesUltimo = ultimo.toLocaleDateString('es-PE', { month: 'long' });
  const anio = ultimo.getFullYear();
  return mesPrimero === mesUltimo
    ? `${primero.getDate()} - ${ultimo.getDate()} de ${mesUltimo}, ${anio}`
    : `${primero.getDate()} de ${mesPrimero} - ${ultimo.getDate()} de ${mesUltimo}, ${anio}`;
});

function mesCorto(fecha: Date): string {
  return fecha.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '');
}

function fechaISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

// "Disponible" — el horario recurrente ya viene como bloques con horaInicio/horaFin, uno por
// franja contigua, así que se dibuja directo sin recorrer hora por hora.
function bloquesDisponibleDia(diaValor: number) {
  const horario = propio.value?.horario ?? [];
  return horario
    .filter((h) => h.diaSemana === diaValor)
    .map((h) => ({
      id: h.id,
      top: topPx(horaADecimal(h.horaInicio)),
      alto: (horaADecimal(h.horaFin) - horaADecimal(h.horaInicio)) * (FILA_PX + GAP_PX) - GAP_PX,
    }));
}

// "Agendado"/"Atendido" — citas reales de video con fecha/hora propia (el chat no tiene horario
// fijo, así que no puede ubicarse en esta grilla). "Reprogramado" no tiene modelo de datos propio
// todavía (mismo vacío intencional que el tab "Reprogramadas" de Mis Consultas) — queda en la
// leyenda como referencia visual hasta que se defina cómo modelarlo.
const citasSemana = computed(() => {
  const fechasIso = new Set(fechasSemana.value.map(fechaISO));
  return (solicitudes.value ?? []).filter(
    (s) =>
      s.tipo === 'video' &&
      (s.estado === 'agendado' || s.estado === 'completado') &&
      s.horarioFecha &&
      s.horarioHoraInicio &&
      s.horarioHoraFin &&
      fechasIso.has(s.horarioFecha),
  );
});

function bloquesCitaDia(fechaIso: string) {
  return citasSemana.value
    .filter((s) => s.horarioFecha === fechaIso)
    .map((s) => ({
      id: s.id,
      nombre: s.clienteNombre ?? 'Alumno',
      rango: `${horaCorta(s.horarioHoraInicio!)} - ${horaCorta(s.horarioHoraFin!)}`,
      estado: s.estado,
      top: topPx(horaADecimal(s.horarioHoraInicio!)),
      alto: Math.max((horaADecimal(s.horarioHoraFin!) - horaADecimal(s.horarioHoraInicio!)) * (FILA_PX + GAP_PX) - GAP_PX, 30),
    }));
}

const scrollRef = ref<HTMLElement | null>(null);
// getBoundingClientRect en vez de offsetTop/offsetParent: acá la columna de horas es
// `position:relative` (para poder ubicar las citas encima con `position:absolute`), lo que rompe
// la cadena de offsetParent que usaba la versión original de este cálculo en HorarioDocenteEditor.vue.
function irA6am() {
  const cont = scrollRef.value;
  const filaSeisAm = cont?.querySelector<HTMLElement>('[data-slot="6"]');
  if (!cont || !filaSeisAm) return;
  cont.scrollTop += filaSeisAm.getBoundingClientRect().top - cont.getBoundingClientRect().top;
}
watch(isLoading, async (cargando) => {
  if (cargando) return;
  await nextTick();
  irA6am();
  requestAnimationFrame(irA6am);
}, { immediate: true });
</script>

<template>
  <PageShell :icon="faCalendarCheck" title="Cronograma" description="Visualiza tus horarios disponibles, agendados y atendidos.">
    <div class="flex items-center justify-between gap-3 mb-4">
      <button
        @click="semanaOffset--"
        type="button"
        class="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
        Semana anterior
      </button>
      <p class="flex items-center justify-center gap-2 text-sm font-bold text-heading">
        <FontAwesomeIcon :icon="faCalendarDays" class="w-3.5 h-3.5 text-muted" />
        {{ rangoSemanaTexto }}
      </p>
      <button
        @click="semanaOffset++"
        type="button"
        class="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-2"
      >
        Semana siguiente
        <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3" />
      </button>
    </div>

    <p v-if="isLoading" class="text-sm text-muted">Cargando…</p>

    <div v-else class="rounded-2xl border border-gray-200 overflow-hidden bg-gray-50">
      <div class="overflow-x-auto">
        <div class="min-w-[760px]">
          <div class="grid gap-1 px-1 pt-1" style="grid-template-columns: 64px repeat(7, 1fr)">
            <div class="bg-gray-50" />
            <div v-for="(dia, i) in DIAS" :key="dia.valor" class="text-center py-2.5 text-xs font-semibold text-heading bg-white rounded-md">
              {{ dia.corta }} {{ fechasSemana[i].getDate() }} {{ mesCorto(fechasSemana[i]) }}
            </div>
          </div>

          <div ref="scrollRef" class="overflow-y-auto" :style="{ maxHeight: `${ALTO_VISIBLE_PX}px` }">
            <div class="grid gap-1 p-1" style="grid-template-columns: 64px repeat(7, 1fr)">
              <div class="relative" :style="{ height: `${alturaTotalPx}px` }">
                <div
                  v-for="slot in slots"
                  :key="slot"
                  :data-slot="slot"
                  class="absolute left-0 right-0 text-[10px] text-gray-400 text-right pr-2 flex items-center justify-end"
                  :style="{ top: `${topPx(slot)}px`, height: `${FILA_PX}px` }"
                >
                  {{ horaLabel(slot) }}
                </div>
              </div>

              <div v-for="(dia, i) in DIAS" :key="dia.valor" class="relative bg-white rounded-md" :style="{ height: `${alturaTotalPx}px` }">
                <div
                  v-for="bloque in bloquesDisponibleDia(dia.valor)"
                  :key="`disp-${bloque.id}`"
                  class="absolute left-0.5 right-0.5 rounded-md border-2 border-brand-500/50 bg-transparent"
                  :style="{ top: `${bloque.top}px`, height: `${bloque.alto}px` }"
                />
                <div
                  v-for="bloque in bloquesCitaDia(fechaISO(fechasSemana[i]))"
                  :key="`cita-${bloque.id}`"
                  class="absolute left-0.5 right-0.5 rounded-md flex flex-col items-center justify-center text-center px-1 overflow-hidden leading-tight"
                  :class="bloque.estado === 'agendado'
                    ? 'bg-green-700/80 border border-green-800/80 text-white'
                    : 'bg-blue-600/80 border border-blue-700/80 text-white'"
                  :style="{ top: `${bloque.top}px`, height: `${bloque.alto}px` }"
                  :title="`${bloque.nombre} · ${bloque.rango}`"
                >
                  <span class="text-[10px] font-semibold truncate w-full">{{ bloque.nombre }}</span>
                  <span class="text-[9px] font-normal opacity-90 truncate w-full">{{ bloque.rango }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-gray-100 text-[11px] text-muted">
        <span class="flex items-center gap-1.5"><span class="w-3.5 h-3.5 rounded border-2 border-brand-500/50 bg-transparent" /> Disponible</span>
        <span class="flex items-center gap-1.5"><span class="w-3.5 h-3.5 rounded bg-green-700/80 border border-green-800/80" /> Agendado</span>
        <span class="flex items-center gap-1.5"><span class="w-3.5 h-3.5 rounded bg-blue-600/80 border border-blue-700/80" /> Atendido</span>
        <span class="flex items-center gap-1.5"><span class="w-3.5 h-3.5 rounded bg-orange-100 border-2 border-orange-500" /> Reprogramado</span>
      </div>
    </div>
  </PageShell>
</template>
