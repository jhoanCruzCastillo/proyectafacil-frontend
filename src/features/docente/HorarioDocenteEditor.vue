<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faCalendarWeek, faCalendarDays, faCalendarXmark, faChevronLeft, faChevronRight, faSave, faPlus,
  faLock, faXmark, faVideo, faLightbulb, faEllipsisVertical, faTrash,
} from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import ConfirmModal from '@/components/ConfirmModal.vue';
import { useSessionStore } from '@/stores/session';
import {
  useDocentesQuery, useActualizarHorarioDocente,
  useExcepcionesHorarioQuery, useActualizarExcepcionesHorario,
} from '@/composables/useDocentes';
import { useUiStore } from '@/stores/ui';
import type { BloqueHorario, BloqueExcepcion } from '@/api/contracts/docentes';
import { ocurrenciasEnRango, REPETICION_LABELS, type TipoRepeticion } from '@/lib/horarioRecurrencia';

// Horario recurrente de referencia (no es un calendario de citas con fechas puntuales) — el
// cliente lo ve al elegir a quién solicitarle asesoría, para saber cuándo suele estar disponible
// este docente. Pedido explícito del usuario: ya no es una grilla clicleable — la única forma de
// agregar disponibilidad es el modal "Agregar horario disponible" (fecha ancla + repetición), y
// lo agregado se dibuja como rectángulos posicionados sobre la grilla, mismo patrón que
// CronogramaPage.vue. Las excepciones (ver más abajo) siguen siendo por fecha puntual — permiten
// marcar "ocupado" un día específico aunque una regla recurrente diga que sí.
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

// `id` acá es un id de cliente (crypto.randomUUID), no el id del servidor — permite identificar
// cada regla para poder quitarla con un clic incluso antes de guardar. El guardado reemplaza todo
// el horario del docente (ver actualizarHorario()), así que el backend no necesita este id.
interface ReglaEditor extends BloqueHorario {
  id: string;
}

const bloques = ref<ReglaEditor[]>([]);
const excepciones = ref<BloqueExcepcion[]>([]);
const cargado = ref(false);

watch(docentes, (lista) => {
  if (cargado.value || !lista) return;
  const propio = lista.find((d) => d.id === docenteId.value);
  bloques.value = propio
    ? propio.horario.map((h) => ({
        id: crypto.randomUUID(),
        fechaInicio: h.fechaInicio,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
        todoElDia: h.todoElDia,
        tipoRepeticion: h.tipoRepeticion,
      }))
    : [];
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

function horaLabel(slot: number): string {
  const h24 = Math.floor(slot);
  const ampm = h24 < 12 ? 'am' : 'pm';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12} ${ampm}`;
}

function horaCorta(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function quitarBloque(id: string) {
  bloques.value = bloques.value.filter((b) => b.id !== id);
}

function fechaISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function quitarExcepcion(exc: BloqueExcepcion) {
  excepciones.value = excepciones.value.filter((e) => e !== exc);
}

// Pedido explícito del usuario: ya no se elimina con un solo clic sobre el bloque — hace falta
// abrir el menú de tres puntos, elegir "Eliminar" y confirmar en la ventana de confirmación.
const menuAbierto = ref<string | null>(null);
function toggleMenu(clave: string) {
  menuAbierto.value = menuAbierto.value === clave ? null : clave;
}

const confirmarEliminar = ref<{ tipo: 'bloque' | 'excepcion'; bloqueId?: string; excepcion?: BloqueExcepcion; mensaje: string } | null>(null);

function pedirEliminarBloque(id: string, mensaje: string) {
  menuAbierto.value = null;
  confirmarEliminar.value = { tipo: 'bloque', bloqueId: id, mensaje };
}
function pedirEliminarExcepcion(exc: BloqueExcepcion, mensaje: string) {
  menuAbierto.value = null;
  confirmarEliminar.value = { tipo: 'excepcion', excepcion: exc, mensaje };
}
function confirmarEliminarAhora() {
  if (!confirmarEliminar.value) return;
  if (confirmarEliminar.value.tipo === 'bloque' && confirmarEliminar.value.bloqueId) {
    quitarBloque(confirmarEliminar.value.bloqueId);
  } else if (confirmarEliminar.value.tipo === 'excepcion' && confirmarEliminar.value.excepcion) {
    quitarExcepcion(confirmarEliminar.value.excepcion);
  }
  confirmarEliminar.value = null;
}

// Navegación de semana — solo de orientación para ver dónde caen las ocurrencias; lo que se
// guarda son las reglas (fecha ancla + repetición), no una semana puntual.
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

// Ocurrencias reales de las reglas dentro de la semana visible — único lugar donde se expande la
// recurrencia (ver src/lib/horarioRecurrencia.ts).
const ocurrenciasSemana = computed(() => ocurrenciasEnRango(bloques.value, fechaISO(fechasSemana.value[0]), fechaISO(fechasSemana.value[6])));
const ocurrenciasTodoElDia = computed(() => ocurrenciasSemana.value.filter((o) => o.todoElDia));
const ocurrenciasConHorario = computed(() => ocurrenciasSemana.value.filter((o) => !o.todoElDia));

function todoElDiaEnDia(fechaIso: string) {
  return ocurrenciasTodoElDia.value.filter((o) => o.fecha === fechaIso);
}

function bloquesDisponibleDia(fechaIso: string) {
  return ocurrenciasConHorario.value
    .filter((o) => o.fecha === fechaIso)
    .map((o) => ({
      id: o.id,
      tipoRepeticion: o.tipoRepeticion,
      rango: `${horaCorta(o.horaInicio)} - ${horaCorta(o.horaFin)}`,
      top: topPx(horaADecimal(o.horaInicio)),
      alto: Math.max((horaADecimal(o.horaFin) - horaADecimal(o.horaInicio)) * (FILA_PX + GAP_PX) - GAP_PX, 36),
    }));
}

function excepcionesEnDia(fechaIso: string) {
  return excepciones.value
    .filter((e) => e.fecha === fechaIso)
    .map((e) => ({
      exc: e,
      rango: `${horaCorta(e.horaInicio)} - ${horaCorta(e.horaFin)}`,
      top: topPx(horaADecimal(e.horaInicio)),
      alto: Math.max((horaADecimal(e.horaFin) - horaADecimal(e.horaInicio)) * (FILA_PX + GAP_PX) - GAP_PX, 36),
    }));
}

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

// Hora en la que arranca la grilla: 6am por defecto, pero se adelanta si hay una ocurrencia con
// horario puntual (no "todo el día", que va en su propia franja) o una excepción "ocupado" que
// empiecen antes de esa hora dentro de la semana visible.
const horaInicioGrid = computed(() => {
  let min = 6;
  for (const o of ocurrenciasConHorario.value) {
    min = Math.min(min, Math.floor(horaADecimal(o.horaInicio)));
  }
  for (const e of excepciones.value) {
    if (fechasSemana.value.some((f) => fechaISO(f) === e.fecha)) min = Math.min(min, Math.floor(horaADecimal(e.horaInicio)));
  }
  return Math.max(min, 0);
});

const slots = computed(() => {
  const lista: number[] = [];
  for (let h = horaInicioGrid.value; h < 24; h++) lista.push(h);
  return lista;
});
const alturaTotalPx = computed(() => slots.value.length * FILA_PX + (slots.value.length - 1) * GAP_PX + 2 * PADDING_PX);

function topPx(horaDecimal: number): number {
  return PADDING_PX + (horaDecimal - horaInicioGrid.value) * (FILA_PX + GAP_PX);
}

// Líneas horizontales de fondo, una por hora — la grilla ya no es clicleable, solo referencia
// visual detrás de los rectángulos.
const lineasHoraCss = `repeating-linear-gradient(180deg, #e2e8f0 0px, #e2e8f0 1px, transparent 1px, transparent ${FILA_PX + GAP_PX}px)`;

// Modal "Agregar horario disponible" — única forma de agregar disponibilidad (pedido explícito
// del usuario). Fecha exacta (con el día de semana mostrado como referencia) + repetición, en vez
// de un día de semana suelto.
const showAgregarDisponible = ref(false);
const nuevoTodoElDia = ref(false);
const nuevaFecha = ref('');
const nuevoDesde = ref('09:00');
const nuevoHasta = ref('13:00');
const nuevaRepeticion = ref<TipoRepeticion>('semanal');

function abrirAgregarDisponible() {
  nuevoTodoElDia.value = false;
  nuevaFecha.value = fechaISO(fechasSemana.value[0]);
  nuevoDesde.value = '09:00';
  nuevoHasta.value = '13:00';
  nuevaRepeticion.value = 'semanal';
  showAgregarDisponible.value = true;
}

const nuevaFechaDiaSemana = computed(() => {
  if (!nuevaFecha.value) return '';
  const [anio, mes, dia] = nuevaFecha.value.split('-').map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-PE', { weekday: 'long' });
});

function confirmarAgregarDisponible() {
  if (!nuevaFecha.value) {
    ui.toast('Elige una fecha', 'error');
    return;
  }
  if (!nuevoTodoElDia.value && nuevoDesde.value >= nuevoHasta.value) {
    ui.toast('La hora de inicio debe ser antes que la hora de fin', 'error');
    return;
  }

  bloques.value = [...bloques.value, {
    id: crypto.randomUUID(),
    fechaInicio: nuevaFecha.value,
    horaInicio: nuevoTodoElDia.value ? '00:00' : nuevoDesde.value,
    horaFin: nuevoTodoElDia.value ? '23:59' : nuevoHasta.value,
    todoElDia: nuevoTodoElDia.value,
    tipoRepeticion: nuevaRepeticion.value,
  }];
  showAgregarDisponible.value = false;
}

// Modal "Marcar como ocupado" (puntual, por fecha real) — sin cambios respecto al comportamiento
// anterior, ya era por fecha exacta.
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
    actualizarHorario.mutateAsync({
      docenteId: docenteId.value,
      horario: bloques.value.map(({ fechaInicio, horaInicio, horaFin, todoElDia, tipoRepeticion }) => ({ fechaInicio, horaInicio, horaFin, todoElDia, tipoRepeticion })),
    }),
    actualizarExcepciones.mutateAsync({ docenteId: docenteId.value, excepciones: excepciones.value }),
  ]);
  ui.toast('Horario actualizado');
}

// Arranca el scroll de la grilla mostrando desde las 6am, en vez de medianoche.
// getBoundingClientRect en vez de offsetTop/offsetParent: la columna de horas es
// `position:relative` (para ubicar los rectángulos encima con `position:absolute`), lo que rompe
// la cadena de offsetParent.
const scrollRef = ref<HTMLElement | null>(null);
function irA6am() {
  const cont = scrollRef.value;
  const filaSeisAm = cont?.querySelector<HTMLElement>('[data-slot="6"]');
  if (!cont || !filaSeisAm) return;
  cont.scrollTop += filaSeisAm.getBoundingClientRect().top - cont.getBoundingClientRect().top;
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
        <p class="text-[11px] text-muted mt-0.5">Las reglas que agregues se repiten según lo que elijas</p>
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

          <div class="grid gap-1 px-1 pb-1" style="grid-template-columns: 64px repeat(7, 1fr)">
            <div class="flex items-start justify-end pr-2 pt-1 text-[10px] text-gray-400">Todo el día</div>
            <div v-for="(dia, i) in DIAS" :key="`tdia-${dia.valor}`" class="flex flex-col gap-1 bg-white rounded-md p-1 min-h-[30px]">
              <div
                v-for="o in todoElDiaEnDia(fechaISO(fechasSemana[i]))"
                :key="`tdia-${o.id}-${o.fecha}`"
                :title="`Disponible todo el día · ${REPETICION_LABELS[o.tipoRepeticion]}`"
                class="relative w-full rounded-md bg-green-500 text-[10px] font-bold text-white py-1.5 pl-2 pr-1 uppercase tracking-wide flex items-center justify-between gap-1"
              >
                <span class="truncate">Todo el día</span>
                <button
                  @click.stop="toggleMenu(`tdia-${o.id}`)"
                  type="button"
                  class="shrink-0 w-4 h-4 rounded hover:bg-black/15 flex items-center justify-center"
                >
                  <FontAwesomeIcon :icon="faEllipsisVertical" class="w-2.5 h-2.5" />
                </button>
                <div
                  v-if="menuAbierto === `tdia-${o.id}`"
                  class="absolute top-full right-0 mt-1 z-20 bg-white rounded-lg shadow-modal border border-gray-200 py-1 w-32 normal-case tracking-normal font-normal"
                  @click.stop
                >
                  <button
                    @click="pedirEliminarBloque(o.id, `¿Eliminar la regla “Disponible todo el día” (${REPETICION_LABELS[o.tipoRepeticion]})? Esta acción no se puede deshacer.`)"
                    type="button"
                    class="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5"
                  >
                    <FontAwesomeIcon :icon="faTrash" class="w-2.5 h-2.5" />
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div ref="scrollRef" class="overflow-y-auto" :style="{ maxHeight: `${ALTO_VISIBLE_PX}px` }">
            <div class="grid p-1 divide-x divide-gray-200" style="grid-template-columns: 64px repeat(7, 1fr)">
              <div
                class="relative"
                :style="{ height: `${alturaTotalPx}px`, backgroundImage: lineasHoraCss, backgroundPosition: `0 ${PADDING_PX}px` }"
              >
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

              <div
                v-for="(dia, i) in DIAS"
                :key="dia.valor"
                class="relative bg-white"
                :style="{ height: `${alturaTotalPx}px`, backgroundImage: lineasHoraCss, backgroundPosition: `0 ${PADDING_PX}px` }"
              >
                <div
                  v-for="b in bloquesDisponibleDia(fechaISO(fechasSemana[i]))"
                  :key="`disp-${b.id}`"
                  :title="`${b.rango} · ${REPETICION_LABELS[b.tipoRepeticion]}`"
                  class="absolute left-0.5 right-0.5 rounded-md bg-green-50 border-l-[3px] border-green-500 flex flex-col justify-center overflow-visible px-1.5 py-0.5 text-left"
                  :style="{ top: `${b.top}px`, height: `${b.alto}px` }"
                >
                  <button
                    @click.stop="toggleMenu(`disp-${b.id}`)"
                    type="button"
                    class="absolute top-0 right-0 w-3.5 h-3.5 rounded hover:bg-black/10 flex items-center justify-center text-gray-500"
                  >
                    <FontAwesomeIcon :icon="faEllipsisVertical" class="w-2 h-2" />
                  </button>
                  <div
                    v-if="menuAbierto === `disp-${b.id}`"
                    class="absolute top-4 right-0 z-20 bg-white rounded-lg shadow-modal border border-gray-200 py-1 w-28"
                    @click.stop
                  >
                    <button
                      @click="pedirEliminarBloque(b.id, `¿Eliminar el bloque disponible ${b.rango} (${REPETICION_LABELS[b.tipoRepeticion]})? Esta acción no se puede deshacer.`)"
                      type="button"
                      class="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5"
                    >
                      <FontAwesomeIcon :icon="faTrash" class="w-2.5 h-2.5" />
                      Eliminar
                    </button>
                  </div>
                  <span class="text-[10px] font-semibold text-heading leading-tight truncate pr-3">{{ b.rango }}</span>
                  <span class="flex items-center gap-1 text-[9px] font-medium text-green-600 leading-tight truncate">
                    <FontAwesomeIcon :icon="faVideo" class="w-2 h-2 shrink-0" />
                    Disponible
                  </span>
                </div>

                <div
                  v-for="e in excepcionesEnDia(fechaISO(fechasSemana[i]))"
                  :key="`exc-${e.exc.fecha}-${e.exc.horaInicio}`"
                  title="Ocupado"
                  class="absolute left-0.5 right-0.5 rounded-md bg-gray-100 border-l-[3px] border-gray-400 flex flex-col justify-center overflow-visible px-1.5 py-0.5 text-left"
                  :style="{ top: `${e.top}px`, height: `${e.alto}px` }"
                >
                  <button
                    @click.stop="toggleMenu(`exc-${e.exc.fecha}-${e.exc.horaInicio}`)"
                    type="button"
                    class="absolute top-0 right-0 w-3.5 h-3.5 rounded hover:bg-black/10 flex items-center justify-center text-gray-500"
                  >
                    <FontAwesomeIcon :icon="faEllipsisVertical" class="w-2 h-2" />
                  </button>
                  <div
                    v-if="menuAbierto === `exc-${e.exc.fecha}-${e.exc.horaInicio}`"
                    class="absolute top-4 right-0 z-20 bg-white rounded-lg shadow-modal border border-gray-200 py-1 w-28"
                    @click.stop
                  >
                    <button
                      @click="pedirEliminarExcepcion(e.exc, `¿Eliminar la excepción “Ocupado” del ${e.exc.fecha} (${e.rango})? Esta acción no se puede deshacer.`)"
                      type="button"
                      class="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5"
                    >
                      <FontAwesomeIcon :icon="faTrash" class="w-2.5 h-2.5" />
                      Eliminar
                    </button>
                  </div>
                  <span class="text-[10px] font-semibold text-heading leading-tight truncate pr-3">{{ e.rango }}</span>
                  <span class="flex items-center gap-1 text-[9px] font-medium text-gray-500 leading-tight truncate">
                    <FontAwesomeIcon :icon="faLock" class="w-2 h-2 shrink-0" />
                    Ocupado
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2.5 px-4 py-3 border-t border-gray-100 bg-blue-50 text-[11px] text-blue-800">
        <FontAwesomeIcon :icon="faLightbulb" class="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <span>
          <span class="font-semibold">Consejo:</span> usa el menú de tres puntos de cada bloque para eliminarlo — para agregar disponibilidad u ocupado, usa los botones de arriba.
        </span>
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

        <label class="flex items-center gap-2 mb-4 cursor-pointer select-none">
          <input v-model="nuevoTodoElDia" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-2 focus:ring-brand-300" />
          <span class="text-sm font-medium text-heading">Todo el día</span>
        </label>

        <label class="block text-xs font-medium text-heading mb-1.5">Fecha</label>
        <input v-model="nuevaFecha" type="date" class="w-full mb-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
        <p v-if="nuevaFechaDiaSemana" class="text-[11px] text-muted mb-4 capitalize">{{ nuevaFechaDiaSemana }}</p>

        <div v-if="!nuevoTodoElDia" class="flex items-center gap-3 mb-4">
          <div class="flex-1">
            <label class="block text-xs font-medium text-heading mb-1.5">Desde</label>
            <input v-model="nuevoDesde" type="time" class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
          <div class="flex-1">
            <label class="block text-xs font-medium text-heading mb-1.5">Hasta</label>
            <input v-model="nuevoHasta" type="time" class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
        </div>

        <label class="block text-xs font-medium text-heading mb-1.5">Repetir</label>
        <select v-model="nuevaRepeticion" class="w-full mb-5 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
          <option v-for="(label, valor) in REPETICION_LABELS" :key="valor" :value="valor">{{ label }}</option>
        </select>

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
        <p class="text-xs text-muted mb-4">Marca una fecha puntual en la que no podrás atender, aunque normalmente sí estés disponible ese día.</p>

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

  <ConfirmModal
    :is-open="!!confirmarEliminar"
    title="¿Eliminar este horario?"
    :message="confirmarEliminar?.mensaje ?? ''"
    confirm-label="Sí, eliminar"
    @confirm="confirmarEliminarAhora"
    @close="confirmarEliminar = null"
  />
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
