<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faCalendarWeek, faCalendarDays, faCalendarXmark, faChevronLeft, faChevronRight, faSave, faPlus,
  faLock, faXmark, faVideo, faLightbulb, faEllipsisVertical, faTrash, faCalendarCheck, faRotate,
  faCircleCheck,
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
async function confirmarEliminarAhora() {
  if (!confirmarEliminar.value) return;
  try {
    if (confirmarEliminar.value.tipo === 'bloque' && confirmarEliminar.value.bloqueId) {
      quitarBloque(confirmarEliminar.value.bloqueId);
      await guardarHorario();
    } else if (confirmarEliminar.value.tipo === 'excepcion' && confirmarEliminar.value.excepcion) {
      quitarExcepcion(confirmarEliminar.value.excepcion);
      await guardarExcepciones();
    }
    ui.toast('Horario actualizado');
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
  } finally {
    confirmarEliminar.value = null;
  }
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
// del usuario). Fecha ancla + N rangos horarios ese día + repetición opcional (con selector de
// días de la semana cuando la repetición es semanal) — ya no existe la opción "todo el día".
const showAgregarDisponible = ref(false);
const nuevaFecha = ref('');
const nuevoRangos = ref<{ desde: string; hasta: string }[]>([]);
const nuevoRepetir = ref(true);
// Solo 4 frecuencias en este selector (pedido explícito, calcado de la imagen de referencia) —
// 'lunes_a_viernes' sigue existiendo en el tipo/modelo pero no se ofrece acá.
type RepeticionModal = Extract<TipoRepeticion, 'semanal' | 'mensual' | 'anual' | 'diaria'>;
const FRECUENCIAS: { valor: RepeticionModal; label: string; descripcion: string; icono: typeof faCalendarWeek; chip: string }[] = [
  { valor: 'diaria', label: 'Diariamente', descripcion: 'Se repetirá todos los días', icono: faRotate, chip: 'bg-sky-50 text-sky-600' },
  { valor: 'semanal', label: 'Semanalmente', descripcion: 'Se repetirá cada semana', icono: faCalendarWeek, chip: 'bg-brand-50 text-brand-600' },
  { valor: 'mensual', label: 'Mensualmente', descripcion: 'Se repetirá cada mes', icono: faCalendarDays, chip: 'bg-violet-50 text-violet-600' },
  { valor: 'anual', label: 'Anualmente', descripcion: 'Se repetirá cada año', icono: faCalendarCheck, chip: 'bg-amber-50 text-amber-600' },
];
const nuevaRepeticion = ref<RepeticionModal>('semanal');
// Días de la semana (solo aplica con repetición semanal) — ISO 1=lunes..7=domingo, mismo criterio
// que DIAS más arriba. Al menos uno siempre queda seleccionado.
const nuevoDiasSemana = ref<number[]>([]);

function diaSemanaIso(fechaIso: string): number {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  const dow = new Date(anio, mes - 1, dia).getDay();
  return dow === 0 ? 7 : dow;
}

// Rangos que YA aplican en esa fecha (según las reglas ya guardadas, expandidas con la misma
// lógica de recurrencia que dibuja la grilla) — pedido explícito: al reabrir el modal en una
// fecha con horario ya guardado, mostrar esos rangos en vez de siempre arrancar en 09:00-13:00.
function rangosExistentesEnFecha(fechaIso: string): { desde: string; hasta: string }[] {
  return ocurrenciasEnRango(bloques.value, fechaIso, fechaIso)
    .filter((o) => !o.todoElDia)
    .map((o) => ({ desde: o.horaInicio, hasta: o.horaFin }))
    .sort((a, b) => a.desde.localeCompare(b.desde));
}

function abrirAgregarDisponible() {
  nuevaFecha.value = fechaISO(fechasSemana.value[0]);
  const existentes = rangosExistentesEnFecha(nuevaFecha.value);
  nuevoRangos.value = existentes.length > 0 ? existentes : [{ desde: '09:00', hasta: '13:00' }];
  nuevoRepetir.value = true;
  nuevaRepeticion.value = 'semanal';
  nuevoDiasSemana.value = [diaSemanaIso(nuevaFecha.value)];
  showAgregarDisponible.value = true;
}

// Igual al reabrir: si dentro del modal se cambia la fecha a mano, los rangos Y el día de semana
// seleccionado se refrescan para reflejar la fecha nueva — antes solo se refrescaban los rangos,
// así que cambiar la fecha (ej. de lunes a sábado) guardaba igual "Lun" en Días de la semana,
// aplicando la regla al día equivocado sin que se notara en el modal.
watch(nuevaFecha, (fecha) => {
  if (!showAgregarDisponible.value || !fecha) return;
  nuevoDiasSemana.value = [diaSemanaIso(fecha)];
  const existentes = rangosExistentesEnFecha(fecha);
  nuevoRangos.value = existentes.length > 0 ? existentes : [{ desde: '09:00', hasta: '13:00' }];
});

const nuevaFechaDiaSemana = computed(() => {
  if (!nuevaFecha.value) return '';
  const [anio, mes, dia] = nuevaFecha.value.split('-').map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-PE', { weekday: 'long' });
});

// Tarjeta de fecha (día grande + mes abreviado + año) — el input real sigue siendo un
// `<input type="date">` nativo, solo transparente y superpuesto, para no perder el datepicker
// del navegador ni la edición por teclado.
const nuevaFechaPartes = computed(() => {
  if (!nuevaFecha.value) return null;
  const [anio, mes, dia] = nuevaFecha.value.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return { dia, mes: mesCorto(fecha).toUpperCase(), anio };
});

// Calendario propio para elegir la fecha (en vez del datepicker nativo del navegador) — pedido
// explícito del usuario, con el mismo estilo del resto de la app. Se posiciona con `fixed` +
// Teleport, mismo patrón que CampoListaInput.vue, para no quedar recortado por el overflow del
// modal.
const calendarioAbierto = ref(false);
const mesVisto = ref(new Date());
const fechaCardRef = ref<HTMLElement | null>(null);
const calendarioPanelRef = ref<HTMLElement | null>(null);
const calendarioPos = ref<{ top: number; left: number } | null>(null);

function situarCalendario() {
  const r = fechaCardRef.value?.getBoundingClientRect();
  if (!r) return;
  calendarioPos.value = { top: r.bottom + 6, left: r.left };
}

function abrirCalendario() {
  const base = nuevaFecha.value ? fechaLocalDesdeIsoCal(nuevaFecha.value) : new Date();
  mesVisto.value = new Date(base.getFullYear(), base.getMonth(), 1);
  calendarioAbierto.value = true;
  situarCalendario();
}
function cerrarCalendario() {
  calendarioAbierto.value = false;
}
function alternarCalendario() {
  if (calendarioAbierto.value) cerrarCalendario();
  else abrirCalendario();
}

function fechaLocalDesdeIsoCal(fechaIso: string): Date {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

function mesAnterior() {
  mesVisto.value = new Date(mesVisto.value.getFullYear(), mesVisto.value.getMonth() - 1, 1);
}
function mesSiguiente() {
  mesVisto.value = new Date(mesVisto.value.getFullYear(), mesVisto.value.getMonth() + 1, 1);
}

const mesVistoTexto = computed(() => {
  const mes = mesVisto.value.toLocaleDateString('es-PE', { month: 'long' });
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${mesVisto.value.getFullYear()}`;
});

interface CeldaCalendario { fechaIso: string; numero: number; enMes: boolean; esHoy: boolean; esSeleccionado: boolean }

// Grilla de 6 semanas (42 celdas) arrancando en lunes, incluyendo días del mes anterior/siguiente
// para completar la primera y última semana — mismo criterio visual de cualquier datepicker.
const celdasCalendario = computed<CeldaCalendario[]>(() => {
  const primerDiaMes = new Date(mesVisto.value.getFullYear(), mesVisto.value.getMonth(), 1);
  const dowLunes0 = (primerDiaMes.getDay() + 6) % 7; // 0=lunes..6=domingo
  const inicioGrid = new Date(primerDiaMes);
  inicioGrid.setDate(primerDiaMes.getDate() - dowLunes0);

  const hoyIso = fechaISO(new Date());
  const celdas: CeldaCalendario[] = [];
  for (let i = 0; i < 42; i++) {
    const fecha = new Date(inicioGrid);
    fecha.setDate(inicioGrid.getDate() + i);
    const iso = fechaISO(fecha);
    celdas.push({
      fechaIso: iso,
      numero: fecha.getDate(),
      enMes: fecha.getMonth() === mesVisto.value.getMonth(),
      esHoy: iso === hoyIso,
      esSeleccionado: iso === nuevaFecha.value,
    });
  }
  return celdas;
});

function elegirDia(iso: string) {
  nuevaFecha.value = iso;
  cerrarCalendario();
}
function irAHoy() {
  const hoy = new Date();
  nuevaFecha.value = fechaISO(hoy);
  mesVisto.value = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  cerrarCalendario();
}

function onDocClickCalendario(e: MouseEvent) {
  if (!calendarioAbierto.value) return;
  const dentro = fechaCardRef.value?.contains(e.target as Node) || calendarioPanelRef.value?.contains(e.target as Node);
  if (!dentro) cerrarCalendario();
}
function onReposicionarCalendario(e: Event) {
  if (!calendarioAbierto.value) return;
  if (calendarioPanelRef.value?.contains(e.target as Node)) return;
  situarCalendario();
}
onMounted(() => {
  document.addEventListener('click', onDocClickCalendario, true);
  window.addEventListener('scroll', onReposicionarCalendario, true);
  window.addEventListener('resize', onReposicionarCalendario);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClickCalendario, true);
  window.removeEventListener('scroll', onReposicionarCalendario, true);
  window.removeEventListener('resize', onReposicionarCalendario);
});
watch(showAgregarDisponible, (abierto) => { if (!abierto) cerrarCalendario(); });

function agregarRango() {
  nuevoRangos.value = [...nuevoRangos.value, { desde: '09:00', hasta: '13:00' }];
}
function quitarRango(indice: number) {
  if (nuevoRangos.value.length <= 1) return;
  nuevoRangos.value = nuevoRangos.value.filter((_, i) => i !== indice);
}

function toggleDiaSemana(iso: number) {
  const i = nuevoDiasSemana.value.indexOf(iso);
  if (i === -1) {
    nuevoDiasSemana.value = [...nuevoDiasSemana.value, iso].sort((a, b) => a - b);
  } else if (nuevoDiasSemana.value.length > 1) {
    nuevoDiasSemana.value = nuevoDiasSemana.value.filter((d) => d !== iso);
  }
}

// Ancla cada día de semana elegido a la fecha real (dentro de la misma semana que `nuevaFecha`)
// que le corresponde — necesario porque 'semanal' evalúa recurrencia contando días exactos desde
// `fechaInicio` (ver horarioRecurrencia.ts), así que cada día de semana necesita su propia ancla.
function fechaParaDiaSemana(fechaBase: string, isoObjetivo: number): string {
  const [anio, mes, dia] = fechaBase.split('-').map(Number);
  const base = new Date(anio, mes - 1, dia);
  const delta = isoObjetivo - diaSemanaIso(fechaBase);
  base.setDate(base.getDate() + delta);
  return fechaISO(base);
}

interface NuevaOcurrenciaPreview { fecha: string; diaCorto: string; horaInicio: string; horaFin: string }

// Combinaciones que se van a crear — rango(s) × día(s) de semana si repite semanalmente, o
// rango(s) sobre la única fecha elegida en cualquier otro caso (incluida "no repetir").
const nuevasOcurrencias = computed<NuevaOcurrenciaPreview[]>(() => {
  const rangos = nuevoRangos.value.filter((r) => r.desde && r.hasta && r.desde < r.hasta);
  if (!nuevaFecha.value || rangos.length === 0) return [];

  const fechasBase = nuevoRepetir.value && nuevaRepeticion.value === 'semanal'
    ? nuevoDiasSemana.value.map((iso) => fechaParaDiaSemana(nuevaFecha.value, iso))
    : [nuevaFecha.value];

  return fechasBase.flatMap((fecha) => rangos.map((r) => ({
    fecha,
    diaCorto: DIAS[diaSemanaIso(fecha) - 1]?.corta ?? '',
    horaInicio: r.desde,
    horaFin: r.hasta,
  })));
});

async function confirmarAgregarDisponible() {
  if (!nuevaFecha.value) {
    ui.toast('Elige una fecha', 'error');
    return;
  }
  if (nuevoRangos.value.some((r) => r.desde >= r.hasta)) {
    ui.toast('En cada rango, la hora de inicio debe ser antes que la hora de fin', 'error');
    return;
  }
  if (nuevasOcurrencias.value.length === 0) {
    ui.toast('Agrega al menos un rango de disponibilidad', 'error');
    return;
  }

  const tipoRepeticion: TipoRepeticion = nuevoRepetir.value ? nuevaRepeticion.value : 'unica';
  const bloquesAnteriores = bloques.value;
  // Si el modal se reabrió sobre una fecha que ya mostraba estos rangos (ver
  // rangosExistentesEnFecha) y se guarda sin cambios, no duplicar la regla ya guardada.
  const yaExiste = (fechaInicio: string, horaInicio: string, horaFin: string) =>
    bloques.value.some((b) => b.fechaInicio === fechaInicio && b.horaInicio === horaInicio && b.horaFin === horaFin && b.tipoRepeticion === tipoRepeticion);
  const nuevas = nuevasOcurrencias.value.filter((o) => !yaExiste(o.fecha, o.horaInicio, o.horaFin));

  if (nuevas.length === 0) {
    ui.toast('Ese horario ya estaba guardado');
    showAgregarDisponible.value = false;
    return;
  }

  bloques.value = [
    ...bloques.value,
    ...nuevas.map((o) => ({
      id: crypto.randomUUID(),
      fechaInicio: o.fecha,
      horaInicio: o.horaInicio,
      horaFin: o.horaFin,
      todoElDia: false,
      tipoRepeticion,
    })),
  ];

  try {
    await guardarHorario();
    ui.toast('Horario actualizado');
    showAgregarDisponible.value = false;
  } catch (e) {
    bloques.value = bloquesAnteriores;
    ui.toast(e instanceof Error ? e.message : 'No se pudo guardar el horario', 'error');
  }
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

async function confirmarMarcarOcupado() {
  if (!ocupadoFecha.value) {
    ui.toast('Elige una fecha', 'error');
    return;
  }
  if (ocupadoDesde.value >= ocupadoHasta.value) {
    ui.toast('La hora de inicio debe ser antes que la hora de fin', 'error');
    return;
  }

  const excepcionesAnteriores = excepciones.value;
  excepciones.value = [...excepciones.value, { fecha: ocupadoFecha.value, horaInicio: ocupadoDesde.value, horaFin: ocupadoHasta.value }];

  try {
    await guardarExcepciones();
    ui.toast('Horario actualizado');
    showMarcarOcupado.value = false;
  } catch (e) {
    excepciones.value = excepcionesAnteriores;
    ui.toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
  }
}

// Cada acción (agregar disponible, marcar ocupado, eliminar) guarda de inmediato — pedido
// explícito del usuario, ya no existe un botón "Guardar cambios" aparte a nivel de página.
async function guardarHorario() {
  await actualizarHorario.mutateAsync({
    docenteId: docenteId.value,
    horario: bloques.value.map(({ fechaInicio, horaInicio, horaFin, todoElDia, tipoRepeticion }) => ({ fechaInicio, horaInicio, horaFin, todoElDia, tipoRepeticion })),
  });
}
async function guardarExcepciones() {
  await actualizarExcepciones.mutateAsync({ docenteId: docenteId.value, excepciones: excepciones.value });
}

// Arranca el scroll de la grilla mostrando desde `horaInicioGrid` (6am por defecto, pero antes si
// hay una ocurrencia más temprana esa semana — ver el computed) — antes esto estaba fijo en "6",
// lo que dejaba bloques tempranos (ej. 2:20am) scrolleados fuera de vista aunque la grilla ya los
// mostrara arriba: no era un desincronizado de datos, solo un scroll inicial que los tapaba.
// getBoundingClientRect en vez de offsetTop/offsetParent: la columna de horas es
// `position:relative` (para ubicar los rectángulos encima con `position:absolute`), lo que rompe
// la cadena de offsetParent.
const scrollRef = ref<HTMLElement | null>(null);
function irAInicioGrid() {
  const cont = scrollRef.value;
  const primeraFila = cont?.querySelector<HTMLElement>(`[data-slot="${horaInicioGrid.value}"]`);
  if (!cont || !primeraFila) return;
  cont.scrollTop += primeraFila.getBoundingClientRect().top - cont.getBoundingClientRect().top;
}
watch(isLoading, async (cargando) => {
  if (cargando) return;
  // Con datos ya en caché (ej. al volver de otra pantalla) `isLoading` puede arrancar en false y
  // el watch con `immediate` dispara antes de que `v-else` termine de montar la grilla — un solo
  // nextTick no siempre alcanza, así que se reintenta también en el próximo frame pintado.
  await nextTick();
  irAInicioGrid();
  requestAnimationFrame(irAInicioGrid);
}, { immediate: true });
</script>

<template>
  <PageShell :icon="faCalendarWeek" title="Mi disponibilidad" description="Marca los horarios en los que puedes atender videollamadas.">

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
      <div class="bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto" @click.stop>
        <div class="flex items-start justify-between gap-3 p-6 bg-gradient-to-r from-sidebar to-brand-800 rounded-t-2xl">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-white text-brand-600 flex items-center justify-center shrink-0">
              <FontAwesomeIcon :icon="faCalendarDays" class="w-4 h-4" />
            </div>
            <div>
              <h2 class="text-lg font-bold text-white leading-tight">Agregar horario disponible</h2>
              <p class="text-sm text-white/60 mt-0.5">Define los horarios en los que estarás disponible para videollamadas.</p>
            </div>
          </div>
          <button @click="showAgregarDisponible = false" type="button" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors duration-100 shrink-0">
            <FontAwesomeIcon :icon="faXmark" />
          </button>
        </div>

        <div class="px-6 pt-6 pb-6 space-y-5">
          <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-5">
            <div>
              <label class="block text-sm font-semibold text-heading mb-1.5">Fecha</label>
              <button
                ref="fechaCardRef"
                @click="alternarCalendario"
                type="button"
                class="w-full rounded-lg border-2 px-4 py-3 text-center transition-colors duration-75"
                :class="calendarioAbierto ? 'border-brand-400' : 'border-gray-200 hover:border-gray-300'"
              >
                <p class="text-2xl font-bold text-heading leading-none">{{ nuevaFechaPartes?.dia }}</p>
                <p class="text-xs font-bold text-brand-600 uppercase tracking-wide mt-1.5">{{ nuevaFechaPartes?.mes }}</p>
                <p class="text-xs text-muted mt-0.5">{{ nuevaFechaPartes?.anio }}</p>
              </button>
              <p v-if="nuevaFechaDiaSemana" class="text-xs text-muted mt-1.5 text-center capitalize">{{ nuevaFechaDiaSemana }}</p>
            </div>

            <div>
              <h3 class="text-sm font-bold text-heading">Rangos de disponibilidad</h3>
              <p class="text-xs text-muted mt-0.5 mb-3">Agrega uno o más rangos de horas en los que estarás disponible.</p>

              <div class="space-y-3">
              <div v-for="(rango, i) in nuevoRangos" :key="i" class="flex items-end gap-3">
                <div class="flex-1">
                  <label class="block text-xs font-medium text-heading mb-1.5">Desde</label>
                  <input v-model="rango.desde" type="time" class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
                <div class="flex-1">
                  <label class="block text-xs font-medium text-heading mb-1.5">Hasta</label>
                  <input v-model="rango.hasta" type="time" class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
                <button
                  v-if="nuevoRangos.length > 1"
                  @click="quitarRango(i)"
                  type="button"
                  title="Quitar este rango"
                  class="w-10 h-10 rounded-lg bg-red-50 border border-red-100 text-red-500 hover:bg-red-100 flex items-center justify-center shrink-0 transition-colors duration-75"
                >
                  <FontAwesomeIcon :icon="faTrash" class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <button
              @click="agregarRango"
              type="button"
              class="w-full mt-3 py-2.5 rounded-lg border border-dashed border-brand-300 text-brand-600 text-sm font-medium hover:bg-brand-50 transition-colors duration-75 flex items-center justify-center gap-2"
            >
              <FontAwesomeIcon :icon="faPlus" class="w-3 h-3" />
              Agregar otro rango
            </button>
            </div>
          </div>

          <div class="border-t border-gray-100 pt-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="text-sm font-bold text-heading">Repetir <span class="font-normal text-muted">(opcional)</span></h3>
                <p class="text-xs text-muted mt-0.5">Si activas esta opción, el horario se repetirá según la frecuencia que elijas.</p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="nuevoRepetir"
                @click="nuevoRepetir = !nuevoRepetir"
                class="w-11 h-6 rounded-full p-0.5 flex items-center transition-colors duration-100 shrink-0"
                :class="nuevoRepetir ? 'bg-brand-500 justify-end' : 'bg-gray-300 justify-start'"
              >
                <span class="w-5 h-5 rounded-full bg-white shadow block" />
              </button>
            </div>

            <template v-if="nuevoRepetir">
              <div class="mt-4">
                <h4 class="text-xs font-semibold text-heading mb-1">Frecuencia de repetición</h4>
                <p class="text-xs text-muted mb-3">Selecciona cada cuánto se repetirá este horario.</p>
                <div class="grid grid-cols-4 gap-2.5">
                  <button
                    v-for="f in FRECUENCIAS"
                    :key="f.valor"
                    @click="nuevaRepeticion = f.valor"
                    type="button"
                    class="relative flex flex-col items-start gap-2 p-3 rounded-lg border text-left transition-colors duration-75"
                    :class="nuevaRepeticion === f.valor ? 'border-brand-300 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'"
                  >
                    <FontAwesomeIcon
                      v-if="nuevaRepeticion === f.valor"
                      :icon="faCircleCheck"
                      class="w-4 h-4 text-brand-500 absolute top-2 right-2"
                    />
                    <div class="w-8 h-8 rounded-md flex items-center justify-center shrink-0" :class="f.chip">
                      <FontAwesomeIcon :icon="f.icono" class="w-3.5 h-3.5" />
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-heading">{{ f.label }}</p>
                      <p class="text-[11px] text-muted leading-tight mt-0.5">{{ f.descripcion }}</p>
                    </div>
                  </button>
                </div>
              </div>

              <div v-if="nuevaRepeticion === 'semanal'" class="mt-4">
                <h4 class="text-xs font-semibold text-heading mb-1">Días de la semana</h4>
                <p class="text-xs text-muted mb-3">Selecciona los días en los que se repetirá este horario.</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="dia in DIAS"
                    :key="dia.valor"
                    @click="toggleDiaSemana(dia.valor)"
                    type="button"
                    class="px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors duration-75"
                    :class="nuevoDiasSemana.includes(dia.valor) ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'"
                  >
                    {{ dia.corta }}
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button @click="showAgregarDisponible = false" type="button" class="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors duration-75">
            Cancelar
          </button>
          <button
            @click="confirmarAgregarDisponible"
            :disabled="actualizarHorario.isPending.value"
            type="button"
            class="px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors duration-75 flex items-center gap-2"
          >
            <FontAwesomeIcon :icon="faSave" class="w-3.5 h-3.5" />
            {{ actualizarHorario.isPending.value ? 'Guardando…' : 'Guardar horario' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <Teleport to="body">
    <div
      v-if="calendarioAbierto && calendarioPos"
      ref="calendarioPanelRef"
      class="fixed z-[60] w-72 rounded-xl border border-gray-200 bg-white shadow-modal p-3"
      :style="{ top: `${calendarioPos.top}px`, left: `${calendarioPos.left}px` }"
      @click.stop
    >
      <div class="flex items-center justify-between mb-2">
        <button @click="mesAnterior" type="button" class="w-7 h-7 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors duration-75">
          <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
        </button>
        <p class="text-sm font-bold text-heading capitalize">{{ mesVistoTexto }}</p>
        <button @click="mesSiguiente" type="button" class="w-7 h-7 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors duration-75">
          <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3" />
        </button>
      </div>

      <div class="grid grid-cols-7 mb-1">
        <span v-for="dia in DIAS" :key="dia.valor" class="text-center text-[10px] font-semibold text-muted uppercase py-1">{{ dia.corta }}</span>
      </div>

      <div class="grid grid-cols-7 gap-y-0.5">
        <button
          v-for="celda in celdasCalendario"
          :key="celda.fechaIso"
          @click="elegirDia(celda.fechaIso)"
          type="button"
          class="w-9 h-9 rounded-full text-sm flex items-center justify-center mx-auto transition-colors duration-75"
          :class="[
            celda.esSeleccionado ? 'bg-brand-600 text-white font-bold' : celda.enMes ? 'text-heading hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-50',
            celda.esHoy && !celda.esSeleccionado ? 'font-bold text-brand-600' : '',
          ]"
        >
          {{ celda.numero }}
        </button>
      </div>

      <div class="text-center pt-2 mt-1 border-t border-gray-100">
        <button @click="irAHoy" type="button" class="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors duration-75">
          Hoy
        </button>
      </div>
    </div>
  </Teleport>

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

        <button
          @click="confirmarMarcarOcupado"
          :disabled="actualizarExcepciones.isPending.value"
          type="button"
          class="w-full py-2.5 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          <FontAwesomeIcon :icon="faLock" class="w-3.5 h-3.5" />
          {{ actualizarExcepciones.isPending.value ? 'Guardando…' : 'Marcar como ocupado' }}
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
