<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faXmark, faIdCard, faTags, faListCheck, faCalendarWeek, faLink, faQuoteLeft, faFileLines,
  faComments, faDownload, faPlus, faCalendarCheck, faCircleXmark, faCheck, faClock,
  faUser, faEnvelope, faPhone, faGraduationCap, faBriefcase, faStar, faPen,
  faCircleInfo, faBook, faMagnifyingGlass, faCircleCheck,
} from '@/lib/icons';
import Avatar from '@/components/Avatar.vue';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import { useCandidatoDetalleQuery, useNotasCandidatoQuery, useAgregarNotaCandidato, useCambiarEstadoCandidato } from '@/composables/useCandidatos';
import { descargarCvCandidato } from '@/api/http/candidatos.http';
import { ESTADO_CANDIDATO_LABEL, ESTADO_CANDIDATO_CLASE } from '@/lib/estadoCandidato';
import { useUiStore } from '@/stores/ui';
import type { EstadoCandidato } from '@/types';

const props = defineProps<{ isOpen: boolean; candidatoId: string | null }>();
const emit = defineEmits<{ close: [] }>();

const ui = useUiStore();
const { data: detalle, isLoading } = useCandidatoDetalleQuery(() => (props.isOpen ? props.candidatoId : null));
const { data: notas } = useNotasCandidatoQuery(() => (props.isOpen ? props.candidatoId : null));
const agregarNota = useAgregarNotaCandidato();
const cambiarEstadoMutation = useCambiarEstadoCandidato();

type Tab = 'resumen' | 'datos-personales' | 'especialidades' | 'experiencia';
const TABS: { value: Tab; label: string; icon: typeof faUser }[] = [
  { value: 'resumen', label: 'Resumen', icon: faUser },
  { value: 'datos-personales', label: 'Datos personales', icon: faIdCard },
  { value: 'especialidades', label: 'Especialidades', icon: faTags },
  { value: 'experiencia', label: 'Experiencia y actividades', icon: faStar },
];
const activeTab = ref<Tab>('resumen');
watch(() => props.candidatoId, () => { activeTab.value = 'resumen'; });

// Mismo catálogo fijo de 7 actividades del wizard público (OPCIONES_ACTIVIDAD en
// RegistroEspecialistaPage.vue) — acá se recorren todas, marcando cuáles sí eligió el postulante
// (detalle.actividades), en vez de mostrar solo las elegidas como chips sueltos.
const ACTIVIDADES_CATALOGO = [
  { valor: 'Asesorías en vivo (chat y videollamada)', titulo: 'Asesorías en vivo', descripcion: 'Por chat y videollamada con clientes de ILPIIE Live.' },
  { valor: 'Ponencias / Docencia', titulo: 'Ponencias / Docencia', descripcion: 'Webinars, talleres, cursos especializados y capacitaciones.' },
  { valor: 'Investigaciones', titulo: 'Investigaciones', descripcion: 'Estudios, análisis normativos y diagnósticos sectoriales.' },
  { valor: 'Publicaciones — Columnas', titulo: 'Publicaciones — Columnas', descripcion: 'Artículos de opinión y análisis para el blog del ILPIIE.' },
  { valor: 'Publicaciones — Artículos técnicos', titulo: 'Publicaciones — Artículos técnicos', descripcion: 'Papers, guías técnicas y documentos de profundidad.' },
  { valor: 'Publicaciones de libros', titulo: 'Publicaciones de libros', descripcion: 'Coautoría o revisión técnica de publicaciones institucionales.' },
  { valor: 'Otras actividades', titulo: 'Otras actividades', descripcion: 'Actividades no listadas arriba.' },
];

function formatoFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// "Editar datos"/"Editar especialidades"/disponibilidad "Ver detalle" todavía no están
// especificados — mismo tratamiento "inerte por ahora" que tuvo el propio botón "Ver" hasta la
// pasada anterior.
function accionProximamente() {
  ui.toast('Esta función estará disponible próximamente');
}

const esTerminal = computed(() => detalle.value?.estado === 'aprobado' || detalle.value?.estado === 'desaprobado');

// Flujo lineal pedido por el cliente (ver también CandidatosController::TRANSICIONES en el
// backend, que re-valida esto mismo): registrado → en_evaluacion → para_entrevista →
// (aprobado | desaprobado). "Pasar a evaluación" y "Programar entrevista" siempre se muestran
// (deshabilitados fuera de su turno); "Aprobar"/"Desaprobar" recién aparecen en para_entrevista.
const cambiandoEstado = ref<EstadoCandidato | null>(null);
async function transicionar(nuevoEstado: EstadoCandidato) {
  if (!props.candidatoId || cambiandoEstado.value) return;
  cambiandoEstado.value = nuevoEstado;
  try {
    await cambiarEstadoMutation.mutateAsync({ id: props.candidatoId, estado: nuevoEstado });
    ui.toast('Estado de la postulación actualizado');
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo actualizar el estado', 'error');
  } finally {
    cambiandoEstado.value = null;
  }
}

// Sin un historial de transiciones real todavía (fuera de alcance), la línea de tiempo es la mejor
// aproximación posible con lo que sí tenemos: `registrado` siempre se da por completado (created_at),
// los pasos intermedios se dan por completados si el estado actual ya los superó, y "Aprobado" /
// "Desaprobado" son dos desenlaces excluyentes — solo el que coincide con el estado actual se marca.
const ESTADOS_ORDEN: EstadoCandidato[] = ['registrado', 'en_evaluacion', 'para_entrevista'];
interface PasoTimeline { titulo: string; detalle: string; completado: boolean; negativo: boolean }
const pasosTimeline = computed<PasoTimeline[]>(() => {
  if (!detalle.value) return [];
  const d = detalle.value;
  const idxActual = ESTADOS_ORDEN.indexOf(d.estado as (typeof ESTADOS_ORDEN)[number]);
  const pasos: PasoTimeline[] = ESTADOS_ORDEN.map((estado, i) => {
    const completado = idxActual === -1 ? true : idxActual >= i;
    let detalleTexto = '—';
    if (estado === 'registrado') detalleTexto = formatoFechaHora(d.fechaRegistro);
    else if (d.estado === estado) detalleTexto = formatoFechaHora(d.actualizadoEn);
    else if (completado) detalleTexto = 'Completado';
    return { titulo: ESTADO_CANDIDATO_LABEL[estado], detalle: detalleTexto, completado, negativo: false };
  });
  pasos.push({
    titulo: 'Aprobado',
    detalle: d.estado === 'aprobado' ? formatoFechaHora(d.actualizadoEn) : '—',
    completado: d.estado === 'aprobado',
    negativo: false,
  });
  pasos.push({
    titulo: 'Desaprobado',
    detalle: d.estado === 'desaprobado' ? formatoFechaHora(d.actualizadoEn) : '—',
    completado: d.estado === 'desaprobado',
    negativo: true,
  });
  return pasos;
});

const descargandoCv = ref(false);
async function descargarCv() {
  if (!detalle.value) return;
  descargandoCv.value = true;
  try {
    await descargarCvCandidato(detalle.value.id, detalle.value.cvNombreOriginal);
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo descargar el CV', 'error');
  } finally {
    descargandoCv.value = false;
  }
}

const mostrarFormNota = ref(false);
const textoNota = ref('');
async function guardarNota() {
  const texto = textoNota.value.trim();
  if (!texto || !props.candidatoId) return;
  try {
    await agregarNota.mutateAsync({ id: props.candidatoId, texto });
    textoNota.value = '';
    mostrarFormNota.value = false;
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo agregar la nota', 'error');
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-4xl max-h-[90vh] overflow-y-auto" @click.stop>
          <LoadingSpinner v-if="isLoading" wrapper-class="px-6 pb-14 pt-8" />
          <template v-else-if="detalle">
            <div class="p-6 pb-4 flex items-start justify-between border-b border-gray-100">
              <div class="flex items-center gap-4">
                <Avatar :nombre="detalle.nombre" size="w-16 h-16" />
                <div>
                  <h2 class="text-xl font-bold text-heading">{{ detalle.nombre }}</h2>
                  <p class="text-sm text-muted">{{ detalle.correo }} · {{ detalle.telefono }}</p>
                  <p class="text-sm text-muted">{{ detalle.profesion }}</p>
                  <div class="flex flex-wrap gap-2 mt-2">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">{{ detalle.aniosExperiencia }} de experiencia</span>
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">{{ detalle.nivelAcademico }}</span>
                    <span v-if="detalle.colegiatura" class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">Colegiatura N.° {{ detalle.colegiatura }}</span>
                  </div>
                </div>
              </div>
              <div class="flex flex-col items-end gap-2 shrink-0">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" :class="ESTADO_CANDIDATO_CLASE[detalle.estado]">
                    <span class="w-1.5 h-1.5 rounded-full bg-current" />
                    {{ ESTADO_CANDIDATO_LABEL[detalle.estado] }}
                  </span>
                  <button @click="emit('close')" type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100">
                    <FontAwesomeIcon :icon="faXmark" />
                  </button>
                </div>
                <p class="text-xs text-muted">Postulación recibida el {{ formatoFechaHora(detalle.fechaRegistro) }}</p>
              </div>
            </div>

            <div class="px-6 border-b border-gray-100 flex gap-5 overflow-x-auto">
              <button
                v-for="tab in TABS"
                :key="tab.value"
                @click="activeTab = tab.value"
                type="button"
                class="flex items-center gap-2 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors duration-75"
                :class="activeTab === tab.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'"
              >
                <FontAwesomeIcon :icon="tab.icon" class="w-3.5 h-3.5" />
                {{ tab.label }}
              </button>
            </div>

            <div v-if="activeTab === 'datos-personales'" class="p-6">
              <div class="flex items-start justify-between mb-5">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon :icon="faUser" class="w-4 h-4" />
                  </div>
                  <div>
                    <h3 class="text-sm font-bold text-heading">Datos personales</h3>
                    <p class="text-xs text-muted">Información básica de identificación del postulante.</p>
                  </div>
                </div>
                <button @click="accionProximamente" type="button" class="px-3.5 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-1.5 shrink-0">
                  <FontAwesomeIcon :icon="faPen" class="w-3 h-3" />
                  Editar datos
                </button>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div class="rounded-xl border border-gray-200 p-4">
                  <h4 class="text-sm font-bold text-heading mb-3 flex items-center gap-2"><FontAwesomeIcon :icon="faIdCard" class="w-3.5 h-3.5 text-emerald-600" /> Información de identidad y contacto</h4>
                  <dl class="text-sm divide-y divide-gray-100">
                    <div class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faUser" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">Nombres y apellidos</dt><dd class="text-heading font-medium">{{ detalle.nombre }}</dd></div>
                    <div class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faIdCard" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">DNI / CE</dt><dd class="text-heading font-medium">{{ detalle.dni }}</dd></div>
                    <div class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faEnvelope" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">Correo electrónico</dt><dd class="text-heading font-medium">{{ detalle.correo }}</dd></div>
                    <div class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faPhone" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">Teléfono / WhatsApp</dt><dd class="text-heading font-medium">{{ detalle.telefono }}</dd></div>
                  </dl>
                </div>

                <div class="rounded-xl border border-gray-200 p-4">
                  <h4 class="text-sm font-bold text-heading mb-3 flex items-center gap-2"><FontAwesomeIcon :icon="faGraduationCap" class="w-3.5 h-3.5 text-emerald-600" /> Formación profesional</h4>
                  <dl class="text-sm divide-y divide-gray-100">
                    <div class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faBriefcase" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">Profesión</dt><dd class="text-heading font-medium">{{ detalle.profesion }}</dd></div>
                    <div v-if="detalle.colegiatura" class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faIdCard" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">Colegiatura / CIP</dt><dd class="text-heading font-medium">{{ detalle.colegiatura }}</dd></div>
                    <div class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faGraduationCap" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">Nivel académico</dt><dd class="text-heading font-medium">{{ detalle.nivelAcademico }}</dd></div>
                    <div class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faClock" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">Años de experiencia</dt><dd class="text-heading font-medium">{{ detalle.aniosExperiencia }}</dd></div>
                  </dl>
                </div>
              </div>

              <div v-if="detalle.linkedin || detalle.otrasRedes" class="rounded-xl border border-gray-200 p-4 mt-5">
                <h4 class="text-sm font-bold text-heading mb-3 flex items-center gap-2"><FontAwesomeIcon :icon="faLink" class="w-3.5 h-3.5 text-emerald-600" /> Enlaces</h4>
                <dl class="text-sm space-y-2">
                  <div v-if="detalle.linkedin" class="flex items-center gap-2.5"><dt class="text-muted shrink-0 w-20">LinkedIn</dt><dd class="truncate"><a :href="detalle.linkedin" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:underline inline-flex items-center gap-1.5">{{ detalle.linkedin }}</a></dd></div>
                  <div v-if="detalle.otrasRedes" class="flex items-center gap-2.5"><dt class="text-muted shrink-0 w-20">Otras redes</dt><dd class="truncate"><a :href="detalle.otrasRedes" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:underline inline-flex items-center gap-1.5">{{ detalle.otrasRedes }}</a></dd></div>
                </dl>
              </div>

              <div v-if="detalle.comentarios" class="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 mt-5">
                <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon :icon="faCircleInfo" class="w-3 h-3" />
                </div>
                <div>
                  <p class="text-sm font-bold text-heading mb-1">Sobre el postulante</p>
                  <p class="text-sm text-heading leading-relaxed">{{ detalle.comentarios }}</p>
                </div>
              </div>
            </div>

            <div v-else-if="activeTab === 'especialidades'" class="p-6">
              <div class="flex items-start justify-between mb-5">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon :icon="faBook" class="w-4 h-4" />
                  </div>
                  <div>
                    <h3 class="text-sm font-bold text-heading">Especialidades de asesoría</h3>
                    <p class="text-xs text-muted">Temas en los que el postulante puede brindar asesorías.</p>
                  </div>
                </div>
                <button @click="accionProximamente" type="button" class="px-3.5 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-1.5 shrink-0">
                  <FontAwesomeIcon :icon="faPen" class="w-3 h-3" />
                  Editar especialidades
                </button>
              </div>

              <div class="rounded-xl border border-gray-200 overflow-hidden">
                <div class="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <p class="text-xs font-semibold text-muted">Tema de asesoría</p>
                </div>
                <div v-if="detalle.temas.length === 0" class="p-4 text-sm text-muted">Sin temas seleccionados.</div>
                <div v-else class="divide-y divide-gray-100">
                  <div v-for="t in detalle.temas" :key="t.id" class="flex items-center gap-3 px-4 py-3">
                    <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <FontAwesomeIcon :icon="faCheck" class="w-2.5 h-2.5" />
                    </span>
                    <span class="text-sm text-heading">{{ t.nombre }}</span>
                  </div>
                </div>
              </div>

              <div v-if="detalle.otrosTemas" class="rounded-xl border border-gray-200 p-4 mt-5">
                <h4 class="text-sm font-bold text-heading mb-1.5 flex items-center gap-2"><FontAwesomeIcon :icon="faTags" class="w-3.5 h-3.5 text-emerald-600" /> Otros temas mencionados</h4>
                <p class="text-sm text-heading leading-relaxed">{{ detalle.otrosTemas }}</p>
              </div>

              <div class="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 mt-5">
                <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon :icon="faCircleInfo" class="w-3 h-3" />
                </div>
                <div>
                  <p class="text-sm font-bold text-heading mb-1">Información</p>
                  <p class="text-sm text-heading leading-relaxed">Estos son los temas que el postulante seleccionó al llenar el formulario de registro. Se validarán durante el proceso de evaluación.</p>
                </div>
              </div>
            </div>

            <div v-else-if="activeTab === 'experiencia'" class="p-6">
              <div class="flex items-center gap-3 mb-5">
                <div class="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon :icon="faBriefcase" class="w-4 h-4" />
                </div>
                <div>
                  <h3 class="text-sm font-bold text-heading">Experiencia y actividades</h3>
                  <p class="text-xs text-muted">Años de experiencia y actividades que el postulante puede realizar.</p>
                </div>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div class="rounded-xl border border-gray-200 p-4">
                  <h4 class="text-sm font-bold text-heading mb-3 flex items-center gap-2"><FontAwesomeIcon :icon="faBriefcase" class="w-3.5 h-3.5 text-emerald-600" /> Experiencia profesional</h4>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="rounded-lg bg-gray-50 p-3">
                      <FontAwesomeIcon :icon="faClock" class="w-3.5 h-3.5 text-gray-400 mb-1.5" />
                      <p class="text-sm font-bold text-heading">{{ detalle.aniosExperiencia }}</p>
                      <p class="text-xs text-muted">de experiencia</p>
                    </div>
                    <div class="rounded-lg bg-gray-50 p-3">
                      <FontAwesomeIcon :icon="faStar" class="w-3.5 h-3.5 text-gray-400 mb-1.5" />
                      <p class="text-sm font-bold text-heading">{{ detalle.nivelEspecialidad }}</p>
                      <p class="text-xs text-muted">nivel de especialidad</p>
                    </div>
                  </div>
                </div>

                <div class="rounded-xl border border-gray-200 p-4">
                  <h4 class="text-sm font-bold text-heading mb-1 flex items-center gap-2"><FontAwesomeIcon :icon="faListCheck" class="w-3.5 h-3.5 text-emerald-600" /> Actividades que realizará</h4>
                  <p class="text-xs text-muted mb-3">El postulante seleccionó las siguientes actividades:</p>
                  <div class="space-y-2">
                    <div
                      v-for="a in ACTIVIDADES_CATALOGO"
                      :key="a.valor"
                      class="flex items-start gap-2.5 p-2.5 rounded-lg"
                      :class="detalle.actividades.includes(a.valor) ? 'bg-emerald-50' : 'opacity-50'"
                    >
                      <span
                        class="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
                        :class="detalle.actividades.includes(a.valor) ? 'bg-emerald-500 text-white' : 'border border-gray-300'"
                      >
                        <FontAwesomeIcon v-if="detalle.actividades.includes(a.valor)" :icon="faCheck" class="w-2.5 h-2.5" />
                      </span>
                      <div>
                        <p class="text-sm font-medium text-heading">{{ a.titulo }}</p>
                        <p class="text-xs text-muted">{{ a.descripcion }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 mt-5">
                <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon :icon="faCircleInfo" class="w-3 h-3" />
                </div>
                <div>
                  <p class="text-sm font-bold text-heading mb-1">Nota</p>
                  <p class="text-sm text-heading leading-relaxed">La información de experiencia y actividades fue declarada por el postulante y será validada durante el proceso de evaluación.</p>
                </div>
              </div>
            </div>

            <div v-if="activeTab === 'resumen'" class="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div class="space-y-5">
                <div class="rounded-xl border border-gray-200 p-4">
                  <h3 class="text-sm font-bold text-heading mb-3 flex items-center gap-2"><FontAwesomeIcon :icon="faIdCard" class="w-3.5 h-3.5 text-muted" /> Información personal</h3>
                  <dl class="text-sm divide-y divide-gray-100">
                    <div class="flex justify-between py-1.5"><dt class="text-muted">Nombres y apellidos</dt><dd class="text-heading font-medium">{{ detalle.nombre }}</dd></div>
                    <div class="flex justify-between py-1.5"><dt class="text-muted">DNI / CE</dt><dd class="text-heading font-medium">{{ detalle.dni }}</dd></div>
                    <div class="flex justify-between py-1.5"><dt class="text-muted">Correo electrónico</dt><dd class="text-heading font-medium">{{ detalle.correo }}</dd></div>
                    <div class="flex justify-between py-1.5"><dt class="text-muted">Teléfono / WhatsApp</dt><dd class="text-heading font-medium">{{ detalle.telefono }}</dd></div>
                    <div class="flex justify-between py-1.5"><dt class="text-muted">Profesión</dt><dd class="text-heading font-medium">{{ detalle.profesion }}</dd></div>
                    <div class="flex justify-between py-1.5"><dt class="text-muted">Nivel académico</dt><dd class="text-heading font-medium">{{ detalle.nivelAcademico }}</dd></div>
                    <div v-if="detalle.colegiatura" class="flex justify-between py-1.5"><dt class="text-muted">N.° de colegiatura / CIP</dt><dd class="text-heading font-medium">{{ detalle.colegiatura }}</dd></div>
                    <div class="flex justify-between py-1.5"><dt class="text-muted">Años de experiencia</dt><dd class="text-heading font-medium">{{ detalle.aniosExperiencia }}</dd></div>
                  </dl>
                </div>

                <div class="rounded-xl border border-gray-200 p-4">
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="text-sm font-bold text-heading flex items-center gap-2"><FontAwesomeIcon :icon="faTags" class="w-3.5 h-3.5 text-muted" /> Temas de asesoría</h3>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <span v-for="t in detalle.temas" :key="t.id" class="px-2.5 py-1 rounded-full text-[11px] font-medium bg-brand-50 text-brand-700">{{ t.nombre }}</span>
                    <span v-if="detalle.temas.length === 0" class="text-xs text-muted">Sin temas seleccionados.</span>
                  </div>
                  <p v-if="detalle.otrosTemas" class="text-xs text-muted mt-2.5">Otros temas: {{ detalle.otrosTemas }}</p>
                </div>

                <div class="rounded-xl border border-gray-200 p-4">
                  <h3 class="text-sm font-bold text-heading mb-3 flex items-center gap-2"><FontAwesomeIcon :icon="faListCheck" class="w-3.5 h-3.5 text-muted" /> Actividades que realizarías</h3>
                  <div class="flex flex-wrap gap-2">
                    <span v-for="a in detalle.actividades" :key="a" class="px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700">{{ a }}</span>
                  </div>
                </div>

                <div class="rounded-xl border border-gray-200 p-4">
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="text-sm font-bold text-heading flex items-center gap-2"><FontAwesomeIcon :icon="faCalendarWeek" class="w-3.5 h-3.5 text-muted" /> Disponibilidad horaria</h3>
                    <button @click="accionProximamente" type="button" class="text-xs font-medium text-brand-600 hover:text-brand-700">Ver detalle</button>
                  </div>
                  <div class="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <div class="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 text-gray-500">
                      <FontAwesomeIcon :icon="faClock" class="w-3.5 h-3.5" />
                    </div>
                    <div class="text-sm">
                      <p class="font-medium text-heading">Disponible para asesorías</p>
                      <p class="text-xs text-muted">Lunes a sábado · Bloques de 1 hora · {{ detalle.disponibilidad.length }} bloque{{ detalle.disponibilidad.length === 1 ? '' : 's' }} marcado{{ detalle.disponibilidad.length === 1 ? '' : 's' }}</p>
                    </div>
                  </div>
                </div>

                <div v-if="detalle.linkedin || detalle.otrasRedes" class="rounded-xl border border-gray-200 p-4">
                  <h3 class="text-sm font-bold text-heading mb-3 flex items-center gap-2"><FontAwesomeIcon :icon="faLink" class="w-3.5 h-3.5 text-muted" /> Otros enlaces</h3>
                  <dl class="text-sm space-y-2">
                    <div v-if="detalle.linkedin" class="flex justify-between gap-3"><dt class="text-muted shrink-0">LinkedIn</dt><dd class="truncate"><a :href="detalle.linkedin" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:underline">{{ detalle.linkedin }}</a></dd></div>
                    <div v-if="detalle.otrasRedes" class="flex justify-between gap-3"><dt class="text-muted shrink-0">Otras redes / web</dt><dd class="truncate"><a :href="detalle.otrasRedes" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:underline">{{ detalle.otrasRedes }}</a></dd></div>
                  </dl>
                </div>

                <div v-if="detalle.comentarios" class="rounded-xl border border-gray-200 p-4">
                  <h3 class="text-sm font-bold text-heading mb-2 flex items-center gap-2"><FontAwesomeIcon :icon="faQuoteLeft" class="w-3.5 h-3.5 text-muted" /> Comentarios del postulante</h3>
                  <p class="text-sm text-heading leading-relaxed">{{ detalle.comentarios }}</p>
                </div>
              </div>

              <div class="space-y-5">
                <div class="rounded-xl border border-gray-200 p-4">
                  <h3 class="text-sm font-bold text-heading mb-3">Estado de postulación</h3>
                  <div class="relative">
                    <div class="absolute left-3 top-2 bottom-2 w-px bg-gray-200" />
                    <div class="space-y-4">
                      <div v-for="(paso, i) in pasosTimeline" :key="i" class="flex gap-3 relative">
                        <div
                          class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 relative"
                          :class="paso.completado ? (paso.negativo ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white') : 'bg-white border-2 border-gray-300'"
                        >
                          <FontAwesomeIcon v-if="paso.completado" :icon="paso.negativo ? faCircleXmark : faCheck" class="w-3 h-3" />
                        </div>
                        <div>
                          <p class="text-sm font-semibold" :class="paso.completado ? 'text-heading' : 'text-gray-400'">{{ paso.titulo }}</p>
                          <p class="text-xs mt-0.5" :class="paso.completado ? 'text-muted' : 'text-gray-300'">{{ paso.detalle }}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="!esTerminal" class="flex flex-col gap-2.5 mt-5">
                    <button
                      @click="transicionar('en_evaluacion')"
                      :disabled="detalle.estado !== 'registrado' || cambiandoEstado !== null"
                      type="button"
                      class="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-75 flex items-center justify-center gap-2"
                      :class="detalle.estado === 'registrado' ? 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60' : 'bg-gray-100 text-gray-400 cursor-not-allowed'"
                    >
                      <FontAwesomeIcon :icon="detalle.estado === 'registrado' ? faMagnifyingGlass : faCheck" class="w-3.5 h-3.5" />
                      {{ cambiandoEstado === 'en_evaluacion' ? 'Actualizando…' : 'Pasar a evaluación' }}
                    </button>
                    <button
                      @click="transicionar('para_entrevista')"
                      :disabled="detalle.estado !== 'en_evaluacion' || cambiandoEstado !== null"
                      type="button"
                      class="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-75 flex items-center justify-center gap-2"
                      :class="detalle.estado === 'en_evaluacion' ? 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60' : 'bg-gray-100 text-gray-400 cursor-not-allowed'"
                    >
                      <FontAwesomeIcon :icon="faCalendarCheck" class="w-3.5 h-3.5" />
                      {{ cambiandoEstado === 'para_entrevista' ? 'Actualizando…' : 'Programar entrevista' }}
                    </button>
                    <template v-if="detalle.estado === 'para_entrevista'">
                      <button
                        @click="transicionar('aprobado')"
                        :disabled="cambiandoEstado !== null"
                        type="button"
                        class="px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors duration-75 flex items-center justify-center gap-2"
                      >
                        <FontAwesomeIcon :icon="faCircleCheck" class="w-3.5 h-3.5" />
                        {{ cambiandoEstado === 'aprobado' ? 'Actualizando…' : 'Aprobar postulación' }}
                      </button>
                      <button
                        @click="transicionar('desaprobado')"
                        :disabled="cambiandoEstado !== null"
                        type="button"
                        class="px-4 py-2.5 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors duration-75 flex items-center justify-center gap-2"
                      >
                        <FontAwesomeIcon :icon="faCircleXmark" class="w-3.5 h-3.5" />
                        {{ cambiandoEstado === 'desaprobado' ? 'Actualizando…' : 'Desaprobar postulación' }}
                      </button>
                    </template>
                  </div>
                </div>

                <div class="rounded-xl border border-gray-200 p-4">
                  <h3 class="text-sm font-bold text-heading mb-3 flex items-center gap-2"><FontAwesomeIcon :icon="faFileLines" class="w-3.5 h-3.5 text-muted" /> Archivos del postulante</h3>
                  <div class="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                        <FontAwesomeIcon :icon="faFileLines" class="w-4 h-4" />
                      </div>
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-heading truncate">{{ detalle.cvNombreOriginal }}</p>
                        <p class="text-xs text-muted">CV / Currículum Vitae</p>
                      </div>
                    </div>
                    <button
                      @click="descargarCv"
                      :disabled="descargandoCv"
                      type="button"
                      class="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors duration-75 shrink-0"
                      title="Descargar CV"
                    >
                      <FontAwesomeIcon :icon="faDownload" class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div class="rounded-xl border border-gray-200 p-4">
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="text-sm font-bold text-heading flex items-center gap-2"><FontAwesomeIcon :icon="faComments" class="w-3.5 h-3.5 text-muted" /> Notas internas</h3>
                    <button @click="mostrarFormNota = !mostrarFormNota" type="button" class="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1">
                      <FontAwesomeIcon :icon="faPlus" class="w-3 h-3" />
                      Agregar nota
                    </button>
                  </div>

                  <div v-if="mostrarFormNota" class="mb-3 space-y-2">
                    <textarea
                      v-model="textoNota"
                      rows="3"
                      placeholder="Escribe una nota sobre esta postulación…"
                      class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                    />
                    <div class="flex justify-end gap-2">
                      <button @click="mostrarFormNota = false; textoNota = ''" type="button" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors duration-75">Cancelar</button>
                      <button
                        @click="guardarNota"
                        :disabled="!textoNota.trim() || agregarNota.isPending.value"
                        type="button"
                        class="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors duration-75"
                      >
                        {{ agregarNota.isPending.value ? 'Guardando…' : 'Guardar nota' }}
                      </button>
                    </div>
                  </div>

                  <div v-if="!notas || notas.length === 0" class="text-center py-6 px-3 rounded-lg bg-gray-50">
                    <FontAwesomeIcon :icon="faComments" class="w-5 h-5 text-gray-300 mb-1.5" />
                    <p class="text-sm text-muted">No hay notas aún.</p>
                    <p class="text-xs text-gray-400 mt-0.5">Agrega comentarios sobre la evaluación, la entrevista u otra información relevante.</p>
                  </div>
                  <div v-else class="space-y-3 max-h-64 overflow-y-auto">
                    <div v-for="n in notas" :key="n.id" class="p-3 rounded-lg bg-gray-50">
                      <p class="text-sm text-heading whitespace-pre-line">{{ n.texto }}</p>
                      <p class="text-[11px] text-muted mt-1.5">{{ n.autorNombre }} · {{ formatoFechaHora(n.creadoEn) }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
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
