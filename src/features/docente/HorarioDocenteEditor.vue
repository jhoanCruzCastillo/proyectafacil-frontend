<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCalendarWeek, faCalendarDays, faCalendarXmark, faChevronLeft, faChevronRight, faSave, faPlus, faLock, faXmark } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import { useSessionStore } from '@/stores/session';
import {
  useDocentesQuery, useActualizarHorarioDocente,
  useExcepcionesHorarioQuery, useActualizarExcepcionesHorario,
} from '@/composables/useDocentes';
import { useUiStore } from '@/stores/ui';
import { horaAmPm } from '@/lib/consultaAsesorUI';
import type { BloqueHorario, BloqueExcepcion } from '@/api/contracts/docentes';

// Horario semanal de referencia (no es un calendario de citas con fechas puntuales) — el cliente
// lo ve al elegir a quién solicitarle asesoría, para saber cuándo suele estar disponible este
// docente. La navegación de semana de abajo es solo para mostrar fechas reales de orientación;
// el patrón marcado se repite todas las semanas. Las excepciones (ver más abajo) sí son por fecha
// puntual — permiten marcar "ocupado" un día específico aunque el patrón recurrente diga que sí.
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
// Rango visible sin necesidad de hacer scroll: 6am–9pm (15 franjas de una hora). El resto del día
// (antes de las 6am, después de las 9pm) sigue disponible haciendo scroll.
const ALTO_VISIBLE_PX = 15 * (FILA_PX + GAP_PX);

const session = useSessionStore();
const ui = useUiStore();
const docenteId = computed(() => session.sesion?.usuarioId ?? '');

const { data: docentes, isLoading } = useDocentesQuery();
const actualizarHorario = useActualizarHorarioDocente();
const { data: excepcionesData } = useExcepcionesHorarioQuery(docenteId);
const actualizarExcepciones = useActualizarExcepcionesHorario();

const bloques = ref<BloqueHorario[]>([]);
const excepciones = ref<BloqueExcepcion[]>([]);
const cargado = ref(false);

watch(docentes, (lista) => {
  if (cargado.value || !lista) return;
  const propio = lista.find((d) => d.id === docenteId.value);
  bloques.value = propio ? propio.horario.map((h) => ({ diaSemana: h.diaSemana, horaInicio: h.horaInicio, horaFin: h.horaFin })) : [];
  cargado.value = true;
}, { immediate: true });

const excepcionesCargadas = ref(false);
watch(excepcionesData, (lista) => {
  if (excepcionesCargadas.value || !lista) return;
  excepciones.value = lista.map((e) => ({ fecha: e.fecha, horaInicio: e.horaInicio, horaFin: e.horaFin }));
  excepcionesCargadas.value = true;
}, { immediate: true });

function horaADecimal(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h + m / 60;
}

function horaAString(decimal: number): string {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Pedido explícito del usuario: filas de hora en hora (12 am, 1 pm, 2 pm…), no de media hora en
// media hora, para que quepan más horas en la pantalla sin scroll.
const PASO = 1;

function horaLabel(slot: number): string {
  const h24 = Math.floor(slot);
  const ampm = h24 < 12 ? 'am' : 'pm';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12} ${ampm}`;
}

// Pedido explícito del usuario: por defecto arrancar en las 6am (no medianoche), pero mostrar
// horas antes de esa si hay algo real ahí — un bloque disponible recurrente o una excepción
// "ocupado" puntual dentro de la semana visible. `horaInicioGrid` se calcula más abajo, una vez
// que `bloques`/`excepciones`/`fechasSemana` existen.
const slots = computed(() => {
  const lista: number[] = [];
  for (let h = horaInicioGrid.value; h < 24; h += PASO) lista.push(h);
  return lista;
});

// Traslape con la franja [slot, slot+PASO) — no "contiene el punto entero" (eso dejaba invisible
// cualquier bloque que no cruzara una hora en punto, ej. 20:50-21:00).
function estaDisponible(dia: number, slot: number): boolean {
  return bloques.value.some((b) => b.diaSemana === dia && horaADecimal(b.horaInicio) < slot + PASO && horaADecimal(b.horaFin) > slot);
}

// El bloque, si lo hay, que arranca justo en esta casilla — para pintar el rango "8:00am-11:00am"
// una sola vez, en la primera casilla del bloque (no en cada hora que ocupa).
function bloqueQueEmpiezaEn(dia: number, slot: number): BloqueHorario | undefined {
  return bloques.value.find((b) => b.diaSemana === dia && Math.floor(horaADecimal(b.horaInicio)) === slot);
}

// Reconstruye el día completo como un set de medias horas marcadas, aplica el toggle, y vuelve a
// comprimir en intervalos contiguos — más simple y robusto que partir/fusionar un bloque a mano.
function toggleSlot(dia: number, slot: number) {
  const yaDisponible = estaDisponible(dia, slot);
  const otrosDias = bloques.value.filter((b) => b.diaSemana !== dia);
  const propios = bloques.value.filter((b) => b.diaSemana === dia);

  const marcados = new Set<number>();
  for (const b of propios) {
    for (let s = horaADecimal(b.horaInicio); s < horaADecimal(b.horaFin) - 0.001; s += PASO) {
      marcados.add(Math.round(s / PASO) * PASO);
    }
  }
  if (yaDisponible) marcados.delete(slot);
  else marcados.add(slot);

  bloques.value = [...otrosDias, ...comprimirEnBloques(dia, marcados)];
}

function comprimirEnBloques(dia: number, marcados: Set<number>): BloqueHorario[] {
  const ordenados = Array.from(marcados).sort((a, b) => a - b);
  const nuevos: BloqueHorario[] = [];
  let inicio: number | null = null;
  let anterior: number | null = null;
  for (const s of ordenados) {
    if (inicio === null) {
      inicio = s;
      anterior = s;
      continue;
    }
    if (s === anterior! + PASO) {
      anterior = s;
      continue;
    }
    nuevos.push({ diaSemana: dia, horaInicio: horaAString(inicio), horaFin: horaAString(anterior! + PASO) });
    inicio = s;
    anterior = s;
  }
  if (inicio !== null) nuevos.push({ diaSemana: dia, horaInicio: horaAString(inicio), horaFin: horaAString(anterior! + PASO) });
  return nuevos;
}

// Excepciones puntuales — "ocupado" en una fecha real específica, por encima del patrón
// recurrente. Independientes de `bloques`: no se tocan entre sí.
function fechaISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function excepcionEn(fechaIso: string, slot: number): BloqueExcepcion | undefined {
  return excepciones.value.find((e) => e.fecha === fechaIso && horaADecimal(e.horaInicio) < slot + PASO && horaADecimal(e.horaFin) > slot);
}

function quitarExcepcion(exc: BloqueExcepcion) {
  excepciones.value = excepciones.value.filter((e) => e !== exc);
}

// Navegación de semana — solo de orientación, no cambia qué se guarda (el horario es recurrente).
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

// Hora en la que arranca la grilla: 6am por defecto, pero se adelanta si hay un bloque disponible
// recurrente (aplica sin importar la semana) o una excepción "ocupado" puntual dentro de la semana
// visible que empiecen antes de esa hora.
const horaInicioGrid = computed(() => {
  let min = 6;
  for (const b of bloques.value) {
    min = Math.min(min, Math.floor(horaADecimal(b.horaInicio)));
  }
  const fechasSemanaIso = new Set(fechasSemana.value.map(fechaISO));
  for (const e of excepciones.value) {
    if (fechasSemanaIso.has(e.fecha)) min = Math.min(min, Math.floor(horaADecimal(e.horaInicio)));
  }
  return Math.max(min, 0);
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

// Modal "Agregar horario disponible" (recurrente, por día de semana).
const showAgregarDisponible = ref(false);
const nuevoDia = ref(1);
const nuevoDesde = ref('09:00');
const nuevoHasta = ref('13:00');

function abrirAgregarDisponible() {
  nuevoDia.value = DIAS[0].valor;
  nuevoDesde.value = '09:00';
  nuevoHasta.value = '13:00';
  showAgregarDisponible.value = true;
}

// Fusiona intervalos en horas decimales SIN redondear a la cuadrícula de horas enteras (a
// diferencia de comprimirEnBloques, pensada para el click-toggle) — así el modal respeta minutos
// exactos, incluyendo bloques de menos de una hora (ej. 20:00-20:10).
function fusionarIntervalos(dia: number, intervalos: { inicio: number; fin: number }[]): BloqueHorario[] {
  const ordenados = [...intervalos].sort((a, b) => a.inicio - b.inicio);
  const fusionados: { inicio: number; fin: number }[] = [];
  for (const actual of ordenados) {
    const ultimo = fusionados[fusionados.length - 1];
    if (ultimo && actual.inicio <= ultimo.fin) {
      ultimo.fin = Math.max(ultimo.fin, actual.fin);
    } else {
      fusionados.push({ ...actual });
    }
  }
  return fusionados.map((f) => ({ diaSemana: dia, horaInicio: horaAString(f.inicio), horaFin: horaAString(f.fin) }));
}

function confirmarAgregarDisponible() {
  if (nuevoDesde.value >= nuevoHasta.value) {
    ui.toast('La hora de inicio debe ser antes que la hora de fin', 'error');
    return;
  }
  const propios = bloques.value.filter((b) => b.diaSemana === nuevoDia.value);
  const intervalos = propios.map((b) => ({ inicio: horaADecimal(b.horaInicio), fin: horaADecimal(b.horaFin) }));
  intervalos.push({ inicio: horaADecimal(nuevoDesde.value), fin: horaADecimal(nuevoHasta.value) });

  bloques.value = [...bloques.value.filter((b) => b.diaSemana !== nuevoDia.value), ...fusionarIntervalos(nuevoDia.value, intervalos)];
  showAgregarDisponible.value = false;
}

// Modal "Marcar como ocupado" (puntual, por fecha real).
const showMarcarOcupado = ref(false);
const ocupadoFecha = ref('');
const ocupadoDesde = ref('09:00');
const ocupadoHasta = ref('13:00');

function abrirMarcarOcupado() {
  ocupadoFecha.value = fechaISO(fechasSemana.value[0]);
  ocupadoDesde.value = '09:00';
  ocupadoHasta.value = '13:00';
  showMarcarOcupado.value = true;
}

function confirmarMarcarOcupado() {
  if (!ocupadoFecha.value) {
    ui.toast('Elige una fecha', 'error');
    return;
  }
  if (ocupadoDesde.value >= ocupadoHasta.value) {
    ui.toast('La hora de inicio debe ser antes que la hora de fin', 'error');
    return;
  }
  excepciones.value = [...excepciones.value, { fecha: ocupadoFecha.value, horaInicio: ocupadoDesde.value, horaFin: ocupadoHasta.value }];
  showMarcarOcupado.value = false;
}

async function guardar() {
  await Promise.all([
    actualizarHorario.mutateAsync({ docenteId: docenteId.value, horario: bloques.value }),
    actualizarExcepciones.mutateAsync({ docenteId: docenteId.value, excepciones: excepciones.value }),
  ]);
  ui.toast('Horario actualizado');
}

// Arranca el scroll de la grilla mostrando desde las 6am, en vez de medianoche. Se calcula desde
// la posición real del elemento (offsetTop) en vez de estimarla a mano, para que no se desalinee
// si cambian el padding/gap de la grilla. Ligado a `isLoading` (no a onMounted a secas) porque la
// grilla recién existe en el DOM cuando termina de cargar — antes de eso `v-if="isLoading"` la
// oculta por completo.
const scrollRef = ref<HTMLElement | null>(null);
function irA6am() {
  const filaSeisAm = scrollRef.value?.querySelector<HTMLElement>('[data-slot="6"]');
  // offsetTop no es relativo a scrollRef (no tiene position:relative) sino al offsetParent común
  // más cercano — se restan ambos offsets para obtener la posición real dentro del contenedor.
  if (scrollRef.value && filaSeisAm) scrollRef.value.scrollTop = filaSeisAm.offsetTop - scrollRef.value.offsetTop;
}
watch(isLoading, async (cargando) => {
  if (cargando) return;
  // Con datos ya en caché (ej. al volver de otra pantalla) `isLoading` puede arrancar en false y
  // el watch con `immediate` dispara antes de que `v-else` termine de montar la grilla — un solo
  // nextTick no siempre alcanza, así que se reintenta también en el próximo frame pintado.
  await nextTick();
  irA6am();
  requestAnimationFrame(irA6am);
}, { immediate: true });
</script>

<template>
  <PageShell :icon="faCalendarWeek" title="Mi disponibilidad" description="Marca los horarios en los que puedes atender videollamadas.">
    <template #actions>
      <button
        @click="guardar"
        :disabled="actualizarHorario.isPending.value || actualizarExcepciones.isPending.value"
        type="button"
        class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faSave" class="w-3.5 h-3.5" />
        Guardar cambios
      </button>
    </template>

    <div class="flex items-center justify-between gap-3 mb-4">
      <button
        @click="semanaOffset--"
        type="button"
        class="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
        Semana anterior
      </button>
      <div class="text-center">
        <p class="flex items-center justify-center gap-2 text-sm font-bold text-heading">
          <FontAwesomeIcon :icon="faCalendarDays" class="w-3.5 h-3.5 text-muted" />
          {{ rangoSemanaTexto }}
        </p>
        <p class="text-[11px] text-muted mt-0.5">Este horario se repite todas las semanas</p>
      </div>
      <button
        @click="semanaOffset++"
        type="button"
        class="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-2"
      >
        Semana siguiente
        <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3" />
      </button>
    </div>

    <div class="flex items-center gap-2.5 mb-4">
      <button
        @click="abrirAgregarDisponible"
        type="button"
        class="px-4 py-2 rounded-lg border border-brand-200 text-brand-700 hover:bg-brand-50 text-sm font-medium transition-colors flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faPlus" class="w-3.5 h-3.5" />
        Agregar horario disponible
      </button>
      <button
        @click="abrirMarcarOcupado"
        type="button"
        class="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faCalendarXmark" class="w-3.5 h-3.5" />
        Marcar como ocupado
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
              <template v-for="slot in slots" :key="slot">
                <div :data-slot="slot" class="text-[10px] text-gray-400 text-right pr-2 flex items-center justify-end" :style="{ height: `${FILA_PX}px` }">
                  {{ horaLabel(slot) }}
                </div>
                <template v-for="(dia, i) in DIAS" :key="`${dia.valor}-${slot}`">
                  <button
                    v-if="excepcionEn(fechaISO(fechasSemana[i]), slot)"
                    @click="quitarExcepcion(excepcionEn(fechaISO(fechasSemana[i]), slot)!)"
                    type="button"
                    title="Ocupado — clic para quitar esta excepción"
                    class="rounded bg-gray-300 hover:bg-gray-400 transition-colors duration-75 flex items-center justify-center"
                    :style="{ height: `${FILA_PX}px` }"
                  >
                    <FontAwesomeIcon :icon="faLock" class="w-2.5 h-2.5 text-white" />
                  </button>
                  <button
                    v-else
                    @click="toggleSlot(dia.valor, slot)"
                    type="button"
                    class="rounded transition-colors duration-75 flex items-center justify-center overflow-hidden px-0.5"
                    :class="estaDisponible(dia.valor, slot) ? 'bg-brand-500 hover:bg-brand-600' : 'bg-white hover:bg-brand-50 border border-gray-100'"
                    :style="{ height: `${FILA_PX}px` }"
                  >
                    <span
                      v-if="bloqueQueEmpiezaEn(dia.valor, slot)"
                      class="text-[9px] font-semibold text-white leading-none truncate"
                    >
                      {{ horaAmPm(bloqueQueEmpiezaEn(dia.valor, slot)!.horaInicio) }}-{{ horaAmPm(bloqueQueEmpiezaEn(dia.valor, slot)!.horaFin) }}
                    </span>
                  </button>
                </template>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-gray-100 text-[11px] text-muted">
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-brand-500" /> Disponible</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded border border-gray-300 bg-white" /> Sin marcar (no disponible)</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-gray-300 flex items-center justify-center"><FontAwesomeIcon :icon="faLock" class="w-1.5 h-1.5 text-white" /></span> Ocupado</span>
        <span class="hidden sm:inline text-gray-300">· Haz clic en una casilla para marcarla o desmarcarla.</span>
      </div>
    </div>
  </PageShell>

  <Transition name="fade">
    <div v-if="showAgregarDisponible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="showAgregarDisponible = false">
      <div class="bg-white rounded-2xl shadow-modal w-full max-w-sm p-6" @click.stop>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-bold text-heading">Agregar horario disponible</h2>
          <button @click="showAgregarDisponible = false" type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
            <FontAwesomeIcon :icon="faXmark" />
          </button>
        </div>

        <label class="block text-xs font-medium text-heading mb-1.5">Día de la semana</label>
        <select v-model.number="nuevoDia" class="w-full mb-4 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
          <option v-for="dia in DIAS" :key="dia.valor" :value="dia.valor">{{ dia.corta }}</option>
        </select>

        <div class="flex items-center gap-3 mb-5">
          <div class="flex-1">
            <label class="block text-xs font-medium text-heading mb-1.5">Desde</label>
            <input v-model="nuevoDesde" type="time" class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
          <div class="flex-1">
            <label class="block text-xs font-medium text-heading mb-1.5">Hasta</label>
            <input v-model="nuevoHasta" type="time" class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
        </div>

        <button @click="confirmarAgregarDisponible" type="button" class="w-full py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
          Agregar
        </button>
      </div>
    </div>
  </Transition>

  <Transition name="fade">
    <div v-if="showMarcarOcupado" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="showMarcarOcupado = false">
      <div class="bg-white rounded-2xl shadow-modal w-full max-w-sm p-6" @click.stop>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-bold text-heading">Marcar como ocupado</h2>
          <button @click="showMarcarOcupado = false" type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
            <FontAwesomeIcon :icon="faXmark" />
          </button>
        </div>
        <p class="text-xs text-muted mb-4">Marca una fecha puntual en la que no podrás atender, aunque normalmente sí estés disponible ese día de la semana.</p>

        <label class="block text-xs font-medium text-heading mb-1.5">Fecha</label>
        <input v-model="ocupadoFecha" type="date" class="w-full mb-4 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />

        <div class="flex items-center gap-3 mb-5">
          <div class="flex-1">
            <label class="block text-xs font-medium text-heading mb-1.5">Desde</label>
            <input v-model="ocupadoDesde" type="time" class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
          <div class="flex-1">
            <label class="block text-xs font-medium text-heading mb-1.5">Hasta</label>
            <input v-model="ocupadoHasta" type="time" class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
        </div>

        <button @click="confirmarMarcarOcupado" type="button" class="w-full py-2.5 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 transition-colors flex items-center justify-center gap-2">
          <FontAwesomeIcon :icon="faLock" class="w-3.5 h-3.5" />
          Marcar como ocupado
        </button>
      </div>
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
</style>
