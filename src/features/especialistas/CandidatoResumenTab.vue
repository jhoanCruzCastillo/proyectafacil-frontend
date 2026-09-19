<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faIdCard, faTags, faListCheck, faCalendarWeek, faLink, faQuoteLeft, faFileLines,
  faDownload, faCalendarCheck, faCircleXmark, faCheck, faClock, faMagnifyingGlass, faCircleCheck,
} from '@/lib/icons';
import { useCambiarEstadoCandidato } from '@/composables/useCandidatos';
import { descargarCvCandidato } from '@/api/http/candidatos.http';
import { ESTADO_CANDIDATO_LABEL } from '@/lib/estadoCandidato';
import { formatoFechaHora } from '@/lib/fechas';
import { useUiStore } from '@/stores/ui';
import type { CandidatoDetalle, EstadoCandidato } from '@/types';
import CandidatoNotasPanel from './CandidatoNotasPanel.vue';

const props = defineProps<{ detalle: CandidatoDetalle }>();

const ui = useUiStore();
const cambiarEstadoMutation = useCambiarEstadoCandidato();

function accionProximamente() {
  ui.toast('Esta función estará disponible próximamente');
}

const esTerminal = computed(() => props.detalle.estado === 'aprobado' || props.detalle.estado === 'desaprobado');

// Flujo lineal pedido por el cliente (ver también CandidatosController::TRANSICIONES en el
// backend, que re-valida esto mismo): registrado → en_evaluacion → para_entrevista →
// (aprobado | desaprobado). "Pasar a evaluación" y "Programar entrevista" siempre se muestran
// (deshabilitados fuera de su turno); "Aprobar"/"Desaprobar" recién aparecen en para_entrevista.
const cambiandoEstado = ref<EstadoCandidato | null>(null);
async function transicionar(nuevoEstado: EstadoCandidato) {
  if (cambiandoEstado.value) return;
  cambiandoEstado.value = nuevoEstado;
  try {
    await cambiarEstadoMutation.mutateAsync({ id: props.detalle.id, estado: nuevoEstado });
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
  const d = props.detalle;
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
  descargandoCv.value = true;
  try {
    await descargarCvCandidato(props.detalle.id, props.detalle.cvNombreOriginal);
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo descargar el CV', 'error');
  } finally {
    descargandoCv.value = false;
  }
}
</script>

<template>
  <div class="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
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

      <CandidatoNotasPanel :candidato-id="detalle.id" />
    </div>
  </div>
</template>
