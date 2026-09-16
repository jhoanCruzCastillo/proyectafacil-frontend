<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faFolderOpen, faHeadset, faLock, faArrowRight, faCircleCheck, faVideo, faComments,
  faClock, instrumentoIcons, instrumentoLabelsPlural,
} from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import Avatar from '@/components/Avatar.vue';
import { useSessionStore } from '@/stores/session';
import { puedeAccederProyectosIA, cuentaEfectivaDe, puedeVerFicha } from '@/lib/permisos';
import { useEjemplosQuery } from '@/composables/useEjemplos';
import { usePlantillasQuery } from '@/composables/usePlantillas';
import { useUsuariosQuery } from '@/composables/useUsuarios';
import { useMisSolicitudesQuery } from '@/composables/useAsesoria';
import { validarValoresPlantilla, calcularProgresoValores } from '@/lib/valorValidation';
import { ventanaDeLlamada } from '@/lib/consultaAsesorUI';
import type { TipoInstrumento } from '@/types';

// Portada de entrada — pedido explícito del cliente: al ingresar, elegir entre "Proyectos de
// Inversión con IA" e "ILPIIE Live" antes de entrar a cualquiera de los dos. "Proyectos de
// Inversión con IA" se bloquea (visible, sin poder entrar) para quien no tiene plan vigente ni es
// alumno vigente — mismo chequeo que usan el guard del router y el candado del sidebar
// (`puedeAccederProyectosIA`, único lugar donde vive la regla).
//
// Manual de diseño v1.0, Figura 5: rediseño con las 4 tarjetas de módulo, el widget ILPIIE Live
// enriquecido y las tarjetas de progreso/próxima asesoría — todo con datos reales (fichas y
// solicitudes propias). "Asesores en línea ahora" usa el toggle real `disponible` de cada
// asesor (no presencia WebSocket); si ninguno está marcado disponible, se oculta ese bloque.
const router = useRouter();
const session = useSessionStore();

const desbloqueadoProyectosIA = computed(() => (session.sesion ? puedeAccederProyectosIA(session.sesion) : false));

const subtituloProyectosIA = computed(() => {
  if (!session.sesion) return '';
  if (session.sesion.alumnoVigente) {
    const hasta = session.sesion.vigenciaAlumnoHasta;
    return hasta
      ? `Acceso de alumno hasta el ${new Date(hasta + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}`
      : 'Acceso de alumno activo';
  }
  if (session.sesion.tienePlan) return 'Incluido en tu plan actual';
  return 'Disponible con un plan o como alumno del programa';
});

// Chip del hero ("Plan Alumno · Incluido") — mismo criterio que el subtítulo de arriba, solo que
// condensado para el chip. Sin nombre de plan puntual (requeriría otra consulta de facturación
// más solo para el chip); "activo" ya es la información que importa acá.
const chipPlan = computed(() => {
  if (!session.sesion || !desbloqueadoProyectosIA.value) return null;
  return session.sesion.alumnoVigente ? 'Alumno del programa · Activo' : 'Plan activo · Incluido';
});

function verPlanes() {
  router.push({ name: 'elegir-plan' });
}
function irAIlpiieLive() {
  router.push({ name: 'asesorias-chat' });
}
function irAVideollamada() {
  router.push({ name: 'asesorias-video' });
}

// --- Mis fichas: misma lógica de filtrado/progreso que MisFichasLista.vue, para las 4 tarjetas
//     de módulo, "Tu progreso" y (implícitamente) el candado de arriba. ---
const { data: ejemplosData } = useEjemplosQuery();
const { data: plantillasData } = usePlantillasQuery();
const { data: usuariosData } = useUsuariosQuery();
const usuarios = computed(() => usuariosData.value ?? []);
const cuentaId = computed(() => (session.sesion ? cuentaEfectivaDe(usuarios.value, session.sesion) : null));
const esTitular = computed(() => !!session.sesion && session.sesion.usuarioId === cuentaId.value);

const misFichas = computed(() => {
  if (!cuentaId.value || !session.sesion) return [];
  return (ejemplosData.value ?? [])
    .filter((e) => e.propietarioId === cuentaId.value)
    .filter((e) => puedeVerFicha(e, session.sesion!.usuarioId, esTitular.value))
    .map((ejemplo) => {
      const plantilla = (plantillasData.value ?? []).find((p) => p.id === ejemplo.plantillaId);
      if (!plantilla) return null;
      const completo = Object.keys(validarValoresPlantilla(plantilla, ejemplo.valores)).length === 0;
      const progreso = calcularProgresoValores(plantilla, ejemplo.valores);
      return { ejemplo, plantilla, completo, progreso };
    })
    .filter((f): f is NonNullable<typeof f> => !!f);
});

const TIPOS_MODULO: TipoInstrumento[] = ['formato', 'ficha_tecnica', 'ioarr', 'perfil'];
const RUTA_TIPO: Record<TipoInstrumento, string> = {
  formato: '/formatos',
  ficha_tecnica: '/fichas-tecnicas',
  ioarr: '/ioarr',
  perfil: '/perfiles',
};
const DESCRIPCION_TIPO: Record<TipoInstrumento, string> = {
  formato: 'Formatos oficiales listos para llenar con ayuda de la IA.',
  ficha_tecnica: 'Fichas 6A y 6B con asistencia paso a paso.',
  ioarr: 'Formatos de operación y mantenimiento.',
  perfil: 'Perfiles por sector productivo.',
};

const modulos = computed(() =>
  TIPOS_MODULO.map((tipo) => {
    const fichas = misFichas.value.filter((f) => f.plantilla.instrumento === tipo);
    const enProgreso = fichas.filter((f) => !f.completo).length;
    return {
      tipo,
      to: RUTA_TIPO[tipo],
      label: instrumentoLabelsPlural[tipo],
      descripcion: DESCRIPCION_TIPO[tipo],
      total: fichas.length,
      enProgreso,
    };
  }),
);

// "Tu progreso": la primera ficha todavía no completa — no hay un registro de "última editada"
// disponible acá sin sumar otra consulta (useHistorialCambios) solo para esto.
const fichaEnProgreso = computed(() => misFichas.value.find((f) => !f.completo) ?? null);

// --- Próxima asesoría: la videollamada agendada más cercana que todavía no terminó.
// Las del seed/demo ya vencidas (ej. "24 ago") no cuentan — si no hay una real por delante,
// el bloque no se renderiza.
const clienteId = computed(() => session.sesion?.usuarioId ?? '');
const { data: misSolicitudes } = useMisSolicitudesQuery(clienteId, 'cliente');
const proximaVideollamada = computed(() => {
  const candidatas = (misSolicitudes.value ?? [])
    .filter((s) => s.tipo === 'video' && s.estado === 'agendado' && s.horarioFecha && s.horarioHoraInicio)
    .filter((s) => ventanaDeLlamada(s).texto !== 'La videollamada ya finalizó')
    .sort((a, b) => `${a.horarioFecha}T${a.horarioHoraInicio}`.localeCompare(`${b.horarioFecha}T${b.horarioHoraInicio}`));
  return candidatas[0] ?? null;
});
const columnaDerecha = computed(() => desbloqueadoProyectosIA.value || !!proximaVideollamada.value);
function formatoFechaHora(fecha: string, hora: string) {
  const fechaTexto = new Date(fecha + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
  return `${fechaTexto} · ${hora}`;
}

// Asesores con toggle `disponible` activo — preview del mock "ASESORES EN LÍNEA AHORA".
const asesoresDisponibles = computed(() =>
  usuarios.value.filter((u) => u.rol === 'asesor' && u.estado === 'activo' && u.disponible === true),
);
const asesoresPreview = computed(() => asesoresDisponibles.value.slice(0, 3));
const asesoresExtra = computed(() => Math.max(0, asesoresDisponibles.value.length - 3));
</script>

<template>
  <PageShell
    :icon="faFolderOpen"
    compact
    title="¿Qué quieres hacer hoy?"
    description="Elige con qué herramienta de Proyecta Fácil quieres trabajar."
  >
    <template v-if="chipPlan" #actions>
      <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-dim text-brand-300 text-xs font-semibold">
        <span class="w-1.5 h-1.5 rounded-full bg-brand-400" />
        {{ chipPlan }}
      </span>
    </template>

    <!-- Proyectos de Inversión con IA: 4 tarjetas de módulo si hay acceso, o la tarjeta única
         bloqueada de siempre si no. -->
    <template v-if="desbloqueadoProyectosIA">
      <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">Proyectos de inversión con IA</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div v-for="modulo in modulos" :key="modulo.tipo" class="flex flex-col rounded-2xl border border-border-light bg-white p-5 shadow-card">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-brand-100 text-brand-600">
            <FontAwesomeIcon :icon="instrumentoIcons[modulo.tipo]" class="w-5 h-5" />
          </div>
          <p class="text-lg font-heading font-semibold text-heading">{{ modulo.label }}</p>
          <p class="text-xs text-muted mt-1 mb-3 flex-1">{{ modulo.descripcion }}</p>
          <p class="text-[11px] text-muted mb-3">
            <template v-if="modulo.total === 0">Ninguna creada todavía</template>
            <template v-else>{{ modulo.total }} {{ modulo.total === 1 ? 'ficha' : 'fichas' }}<template v-if="modulo.enProgreso"> · {{ modulo.enProgreso }} en progreso</template></template>
          </p>
          <RouterLink
            :to="modulo.to"
            class="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors duration-75"
          >
            Abrir
            <FontAwesomeIcon :icon="faArrowRight" class="w-3 h-3" />
          </RouterLink>
        </div>
      </div>
    </template>
    <div v-else class="relative flex flex-col rounded-2xl border border-border-light bg-gray-50 p-6 mb-6 max-w-md">
      <div class="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-gray-200 text-gray-400">
        <FontAwesomeIcon :icon="faFolderOpen" class="w-6 h-6" />
      </div>
      <p class="text-lg font-heading font-semibold text-gray-400">Proyectos de Inversión con IA</p>
      <p class="text-[0.8rem] mt-1 mb-5 text-gray-400">
        Formatos, fichas técnicas, IOARR y perfiles — llena tus documentos de inversión con ayuda de IA.
      </p>
      <p class="text-[0.75rem] font-medium mb-4 flex items-center gap-1.5 text-gray-400">
        <FontAwesomeIcon :icon="faLock" class="w-3 h-3" />
        {{ subtituloProyectosIA }}
      </p>
      <button
        @click="verPlanes"
        type="button"
        class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-600 text-[0.8rem] font-semibold hover:bg-gray-100 transition-colors duration-75"
      >
        Ver planes
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- ILPIIE Live — foto de fondo + gradiente rojo (mock Figura 5). -->
      <div
        class="ilpiie-live-card relative overflow-hidden flex flex-col rounded-2xl border border-red-500/35 p-6 sm:p-7 min-h-[300px]"
        :class="columnaDerecha ? 'lg:col-span-2' : 'lg:col-span-3'"
      >
        <div class="relative z-10 flex flex-col gap-5 max-w-xl">
          <div class="flex items-center gap-3 flex-wrap">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center bg-red-500 text-white shrink-0 shadow-lg shadow-red-900/40">
              <FontAwesomeIcon :icon="faHeadset" class="w-5 h-5" />
            </div>
            <div class="flex items-center gap-2.5 flex-wrap">
              <p class="text-xl font-heading font-bold text-white tracking-tight">ILPIIE Live</p>
              <span class="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider bg-red-500 text-white px-2.5 py-1 rounded-full shrink-0">
                <span class="w-1.5 h-1.5 rounded-full bg-white live-pulse-dot" />
                LIVE
              </span>
            </div>
          </div>

          <p class="text-sm text-white/90 leading-relaxed">
            Asesoría en vivo por chat o videollamada sobre temas y subtemas puntuales de tu proyecto, con especialistas del ILPIIE.
          </p>

          <div v-if="asesoresPreview.length > 0" class="flex flex-col gap-2.5">
            <p class="text-[10px] font-semibold tracking-[0.14em] uppercase text-white/70">
              Asesores en línea ahora
            </p>
            <div class="flex items-center gap-3">
              <div class="flex -space-x-2">
                <div
                  v-for="asesor in asesoresPreview"
                  :key="asesor.id"
                  class="relative rounded-full ring-2 ring-[#260e11]"
                >
                  <Avatar :nombre="asesor.nombre" :foto-url="asesor.fotoUrl" size="w-9 h-9" />
                  <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#260e11]" />
                </div>
              </div>
              <div v-if="asesoresExtra > 0" class="leading-tight">
                <p class="text-sm font-semibold text-white">+{{ asesoresExtra }} más</p>
                <p class="text-[11px] text-white/55">respuesta ~ 5 min</p>
              </div>
              <div v-else class="leading-tight">
                <p class="text-[11px] text-white/55">respuesta ~ 5 min</p>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-3 pt-0.5">
            <button
              @click="irAIlpiieLive"
              type="button"
              class="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 shadow-lg shadow-red-950/30 transition-colors duration-75"
            >
              <FontAwesomeIcon :icon="faComments" class="w-3.5 h-3.5" />
              Iniciar chat
            </button>
            <button
              @click="irAVideollamada"
              type="button"
              class="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-white/35 bg-black/25 text-white text-sm font-semibold hover:bg-black/40 backdrop-blur-[2px] transition-colors duration-75"
            >
              <FontAwesomeIcon :icon="faVideo" class="w-3.5 h-3.5" />
              Agendar videollamada
            </button>
          </div>

          <p class="text-[0.75rem] font-medium text-white/70 flex items-center gap-1.5">
            <FontAwesomeIcon :icon="faCircleCheck" class="w-3.5 h-3.5 text-white/80" />
            Siempre disponible · Incluido en tu plan actual
          </p>
        </div>
      </div>

      <div v-if="columnaDerecha" class="flex flex-col gap-6">
        <!-- Tu progreso -->
        <div v-if="desbloqueadoProyectosIA" class="rounded-2xl border border-border-light bg-white p-5 shadow-card">
          <p class="text-sm font-heading font-semibold text-heading mb-3">Tu progreso</p>
          <template v-if="fichaEnProgreso">
            <p class="text-sm font-medium text-heading truncate">{{ fichaEnProgreso.ejemplo.nombre }}</p>
            <p class="text-xs text-muted mb-3">{{ instrumentoLabelsPlural[fichaEnProgreso.plantilla.instrumento] }}</p>
            <div class="h-2 rounded-full bg-border-light overflow-hidden">
              <div class="h-full rounded-full bg-brand-600" :style="{ width: `${fichaEnProgreso.progreso.porcentaje}%` }" />
            </div>
            <p class="text-[11px] text-muted mt-1.5 mb-4">{{ fichaEnProgreso.progreso.llenos }} de {{ fichaEnProgreso.progreso.total }} campos</p>
            <RouterLink
              :to="`/mis-fichas/${fichaEnProgreso.ejemplo.id}`"
              class="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors duration-75"
            >
              Continuar donde quedaste
              <FontAwesomeIcon :icon="faArrowRight" class="w-3 h-3" />
            </RouterLink>
          </template>
          <template v-else-if="misFichas.length > 0">
            <p class="text-xs text-muted">Todas tus fichas están completas. ¡Bien ahí! 🎉</p>
          </template>
          <template v-else>
            <p class="text-xs text-muted">Todavía no empezaste ninguna ficha — crea la primera desde Formatos, Fichas técnicas, IOARR o Perfiles.</p>
          </template>
        </div>

        <!-- Próxima asesoría: solo si hay una videollamada agendada que todavía no pasó. -->
        <div v-if="proximaVideollamada" class="rounded-2xl border border-navy-700 bg-sidebar p-5 flex-1">
          <p class="text-sm font-heading font-semibold mb-3 text-text-primary">Próxima asesoría</p>
          <p class="text-sm font-medium text-text-primary">{{ proximaVideollamada.docenteNombre ?? 'Asesor por confirmar' }}</p>
          <p class="text-xs text-dark-muted mt-1 mb-4 flex items-center gap-1.5">
            <FontAwesomeIcon :icon="faClock" class="w-3 h-3" />
            {{ formatoFechaHora(proximaVideollamada.horarioFecha!, proximaVideollamada.horarioHoraInicio!) }}
          </p>
          <a
            v-if="proximaVideollamada.linkReunion"
            :href="proximaVideollamada.linkReunion"
            target="_blank"
            rel="noopener"
            class="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-brand-400 text-brand-300 text-xs font-semibold hover:bg-brand-500/10 transition-colors duration-75"
          >
            Unirme a la sala
          </a>
          <p v-else class="text-[11px] text-dark-muted">El enlace de la reunión aparecerá cerca del horario.</p>
        </div>
      </div>
    </div>
  </PageShell>
</template>

<style scoped>
.ilpiie-live-card {
  background-color: #260e11;
  background-image:
    linear-gradient(
      105deg,
      #260e11 0%,
      #260e11 36%,
      rgba(38, 14, 17, 0.94) 50%,
      rgba(38, 14, 17, 0.55) 68%,
      rgba(38, 14, 17, 0.18) 84%,
      transparent 100%
    ),
    url('/bg-ilpiie-live.webp');
  background-size: cover, cover;
  background-position: center, right center;
  background-repeat: no-repeat;
}

@keyframes live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}
.live-pulse-dot {
  animation: live-pulse 1.4s infinite;
}
</style>
