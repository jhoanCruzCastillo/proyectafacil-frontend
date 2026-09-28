<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faFolderOpen, faHeadset, faLock, faArrowRight, faChevronRight, faCircleCheck, faVideo, faComments,
  faClock, instrumentoIcons, instrumentoLabelsPlural,
} from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import Avatar from '@/components/Avatar.vue';
import AppLoadingScreen from '@/components/AppLoadingScreen.vue';
import { useSessionStore } from '@/stores/session';
import { puedeAccederProyectosIA, cuentaEfectivaDe, puedeVerFicha, tieneServicioIlpiieLive } from '@/lib/permisos';
import { useEjemplosQuery } from '@/composables/useEjemplos';
import { usePlantillasQuery } from '@/composables/usePlantillas';
import { useUsuariosQuery } from '@/composables/useUsuarios';
import { useMisSolicitudesQuery } from '@/composables/useAsesoria';
import { useTicketsConsultaQuery } from '@/composables/useTicketsConsulta';
import { validarValoresPlantilla, calcularProgresoValores } from '@/lib/valorValidation';
import { ventanaDeLlamada } from '@/lib/consultaAsesorUI';
import type { TipoInstrumento } from '@/types';

// Portada de entrada — al ingresar, elegir entre "Proyectos de Inversión con IA" e "ILPIIE Live".
// Si el cliente todavía no contrató un servicio, la tarjeta se ve gris con candado pero SÍ se
// puede entrar. El color de marca (módulos verdes / banner rojo) vuelve cuando lo adquiere:
// PI+IA = plan o alumno vigente; ILPIIE Live = al menos una ficha de chat/video.
const router = useRouter();
const session = useSessionStore();

const desbloqueadoProyectosIA = computed(() => (session.sesion ? puedeAccederProyectosIA(session.sesion) : false));

const chipPlan = computed(() => {
  if (!session.sesion || !desbloqueadoProyectosIA.value) return null;
  return session.sesion.alumnoVigente ? 'Alumno del programa · Activo' : 'Plan activo · Incluido';
});

function irAProyectosIA() {
  router.push({ name: 'formatos' });
}
function irAIlpiieLive() {
  router.push({ name: 'asesorias-chat' });
}
function irAVideollamada() {
  router.push({ name: 'asesorias-video' });
}

// --- Mis fichas: misma lógica de filtrado/progreso que MisFichasLista.vue, para las 4 tarjetas
//     de módulo, "Tu progreso" y (implícitamente) el candado de arriba. ---
const { data: ejemplosData, isPending: cargandoEjemplos } = useEjemplosQuery();
const { data: plantillasData, isPending: cargandoPlantillas } = usePlantillasQuery();
const { data: usuariosData, isPending: cargandoUsuarios } = useUsuariosQuery();
const usuarios = computed(() => usuariosData.value ?? []);
const cuentaId = computed(() => (session.sesion ? cuentaEfectivaDe(usuarios.value, session.sesion) : null));
const esTitular = computed(() => !!session.sesion && session.sesion.usuarioId === cuentaId.value);
const { data: ticketsConsulta, isPending: cargandoTickets } = useTicketsConsultaQuery(() => cuentaId.value ?? '');
const tieneIlpiieLive = computed(() => tieneServicioIlpiieLive(ticketsConsulta.value));

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
  formato: 'Formatos oficiales listos para llenar con ayuda de la IA. Ahorra tiempo con preguntas guiadas y validaciones automáticas.',
  ficha_tecnica: 'Fichas 6A y 6B con asistencia paso a paso. La IA te guía en cada sección según la normativa vigente.',
  ioarr: 'Formatos de operación y mantenimiento. Completa con ayuda de la IA y verifica criterios automáticamente.',
  perfil: 'Perfiles por sector productivo con estructura validada. La IA te ayuda a desarrollar un perfil completo y listo para revisión.',
};

/**
 * Texto del contador de cada tarjeta, escrito entero en vez de armarlo en el template.
 *
 * Antes salía de `instrumentoLabelsPlural[tipo].toLowerCase()` + " creados", lo que producía dos
 * errores visibles: "0 ioarr creados" (IOARR es una sigla, no se escribe en minúscula) y
 * "4 fichas técnicas creados" (concordancia de género equivocada). Como son cuatro y no cambian,
 * el literal es más claro que cualquier regla de pluralización.
 */
const CONTEO_TIPO: Record<TipoInstrumento, string> = {
  formato: 'formatos creados',
  ficha_tecnica: 'fichas creadas',
  ioarr: 'IOARR creados',
  perfil: 'perfiles creados',
};

/**
 * Identidad visual por módulo (mockup del cliente): imagen de fondo decorativa
 * (docs/images/webp/crd1-4.webp, copiadas a frontend/public/bg-card-*.webp) + color propio.
 *
 * Rediseño 2026-09-28: la tarjeta vuelve a ser BLANCA. Antes la imagen se estiraba con
 * `bg-cover bg-right` y teñía la tarjeta entera, así que las cuatro competían entre sí y el botón
 * —el único elemento que de verdad hay que ver— perdía peso. Ahora el gráfico ocupa solo la esquina
 * superior derecha (ver `bg-[length:...]` en el template) y el color vive en tres puntos: el badge
 * del ícono (pastel, no sólido), el contador y el botón (degradado).
 */
const ESTILO_TIPO: Record<TipoInstrumento, { badge: string; icono: string; boton: string; contador: string; fondo: string }> = {
  formato: {
    badge: 'bg-brand-50 text-brand-600',
    icono: 'text-brand-600',
    boton: 'bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700',
    contador: 'bg-brand-50 text-brand-600',
    fondo: 'url(/bg-card-formatos.webp)',
  },
  ficha_tecnica: {
    badge: 'bg-blue-50 text-blue-600',
    icono: 'text-blue-600',
    boton: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    contador: 'bg-blue-50 text-blue-600',
    fondo: 'url(/bg-card-fichas-tecnicas.webp)',
  },
  ioarr: {
    badge: 'bg-orange-50 text-orange-600',
    icono: 'text-orange-600',
    boton: 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
    contador: 'bg-orange-50 text-orange-600',
    fondo: 'url(/bg-card-ioarr.webp)',
  },
  perfil: {
    badge: 'bg-violet-50 text-violet-600',
    icono: 'text-violet-600',
    boton: 'bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700',
    contador: 'bg-violet-50 text-violet-600',
    fondo: 'url(/bg-card-perfiles.webp)',
  },
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
      estilo: ESTILO_TIPO[tipo],
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
const { data: misSolicitudes, isPending: cargandoSolicitudes } = useMisSolicitudesQuery(clienteId, 'cliente');

// Todas las consultas de las que depende esta portada (fichas, plantillas, usuarios, tickets,
// solicitudes de videollamada) — mientras cualquiera siga sin resolver, los conteos/candados que se
// arman a partir de datos parciales (ej. "Ninguna creada todavía" antes de que ejemplosData llegue,
// aunque el usuario sí tenga fichas) muestran un estado incorrecto que luego "salta" al correcto.
// Se espera a que TODO esté listo antes de mostrar nada, en vez de corregir el parpadeo a medias.
const cargando = computed(
  () => cargandoEjemplos.value || cargandoPlantillas.value || cargandoUsuarios.value || cargandoTickets.value || cargandoSolicitudes.value,
);
const proximaVideollamada = computed(() => {
  const candidatas = (misSolicitudes.value ?? [])
    .filter((s) => s.tipo === 'video' && s.estado === 'agendado' && s.horarioFecha && s.horarioHoraInicio)
    .filter((s) => ventanaDeLlamada(s).texto !== 'La videollamada ya finalizó')
    .sort((a, b) => `${a.horarioFecha}T${a.horarioHoraInicio}`.localeCompare(`${b.horarioFecha}T${b.horarioHoraInicio}`));
  return candidatas[0] ?? null;
});
// "Tu progreso" oculto temporalmente (ver más abajo) — mientras tanto la columna derecha
// solo depende de si hay una próxima videollamada.
const columnaDerecha = computed(() => tieneIlpiieLive.value && !!proximaVideollamada.value);

// "Tu progreso" oculto temporalmente a pedido del cliente (no `false` literal, para que
// vue-tsc no elimine el bloque como código muerto y rompa el narrowing de fichaEnProgreso).
const mostrarTuProgreso = ref(false);
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
  <AppLoadingScreen v-if="cargando" />
  <PageShell
    v-else
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

    <div
      class="mb-6"
      :class="!desbloqueadoProyectosIA && !tieneIlpiieLive ? 'grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto' : ''"
    >
    <!-- Proyectos de Inversión con IA: 4 módulos con color de marca si ya lo adquirió;
         si no, tarjeta gris con candado — se puede entrar igual. -->
    <template v-if="desbloqueadoProyectosIA">
      <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3 md:col-span-2">Proyectos de inversión con IA</p>
      <!-- 4 columnas recién en `xl`, no en `lg`: con el sidebar abierto, a 1100px de ventana cada
           tarjeta quedaba en 155px — el contador se truncaba a "0.. C.." y "Abrir Fichas técnicas"
           se partía en tres líneas. Entre 1024 y 1280 se ven mejor dos columnas anchas. -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:col-span-2">
        <!-- El gráfico decorativo se ancla arriba a la derecha y se limita al 55 % del ancho, en vez
             del `bg-cover` que antes lo estiraba sobre toda la tarjeta. -->
        <div
          v-for="modulo in modulos"
          :key="modulo.tipo"
          class="group flex flex-col rounded-2xl border border-border-light p-5 shadow-card bg-white bg-no-repeat bg-right-top bg-[length:55%_auto] overflow-hidden transition-shadow duration-100 hover:shadow-modal"
          :style="{ backgroundImage: modulo.estilo.fondo }"
        >
          <div class="w-12 h-12 rounded-xl flex items-center justify-center mb-4" :class="modulo.estilo.badge">
            <FontAwesomeIcon :icon="instrumentoIcons[modulo.tipo]" class="w-5 h-5" />
          </div>
          <p class="text-lg font-heading font-semibold text-heading">{{ modulo.label }}</p>
          <p class="text-xs text-muted leading-relaxed mt-1.5 mb-4 flex-1">{{ modulo.descripcion }}</p>
          <!-- El contador pasa a ser su propio bloque enmarcado y navegable: en el diseño anterior
               era texto suelto y se leía como parte de la descripción. Lleva al mismo destino que el
               botón, así que la tarjeta ofrece dos entradas al mismo sitio, no dos acciones. -->
          <RouterLink
            :to="modulo.to"
            class="flex items-center gap-2.5 rounded-xl border border-border-light bg-surface/70 px-3 py-2.5 mb-3 transition-colors duration-75 hover:bg-surface"
          >
            <span class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" :class="modulo.estilo.contador">
              <FontAwesomeIcon :icon="instrumentoIcons[modulo.tipo]" class="w-3.5 h-3.5" />
            </span>
            <span class="leading-tight min-w-0 flex-1 text-[11px]">
              <span class="block font-semibold text-heading truncate">{{ modulo.total }} {{ CONTEO_TIPO[modulo.tipo] }}</span>
              <span class="block text-muted truncate">
                <template v-if="modulo.total === 0">Comienza tu primer proyecto</template>
                <template v-else-if="modulo.enProgreso">{{ modulo.enProgreso }} en progreso</template>
                <template v-else>Todas completas</template>
              </span>
            </span>
            <FontAwesomeIcon :icon="faChevronRight" class="w-2.5 h-2.5 text-gray-300 shrink-0" />
          </RouterLink>
          <RouterLink
            :to="modulo.to"
            class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-xs font-semibold shadow-sm transition-colors duration-75"
            :class="modulo.estilo.boton"
          >
            Abrir {{ modulo.label }}
            <FontAwesomeIcon :icon="faArrowRight" class="w-3 h-3" />
          </RouterLink>
        </div>
      </div>
    </template>
    <div
      v-else
      class="relative flex flex-col items-center text-center rounded-2xl border border-gray-200 bg-gray-100 p-8"
      :class="tieneIlpiieLive ? 'max-w-md' : ''"
    >
      <div class="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-gray-200 text-gray-400">
        <FontAwesomeIcon :icon="faFolderOpen" class="w-7 h-7" />
      </div>
      <p class="text-lg font-heading font-semibold text-gray-600">Proyectos de Inversión con IA</p>
      <p class="text-[0.8rem] mt-1 mb-5 text-gray-400">
        Formatos, fichas técnicas, IOARR y perfiles — llena tus documentos de inversión con ayuda de IA.
      </p>
      <p class="text-[0.75rem] font-medium mb-5 flex items-center justify-center gap-1.5 text-gray-400">
        <FontAwesomeIcon :icon="faLock" class="w-3 h-3" />
        Aún no has adquirido este beneficio
      </p>
      <button
        @click="irAProyectosIA"
        type="button"
        class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-300 text-gray-700 text-[0.8rem] font-semibold hover:bg-gray-400/70 transition-colors duration-75"
      >
        Entrar
        <FontAwesomeIcon :icon="faArrowRight" class="w-3 h-3" />
      </button>
    </div>

    <div
      v-if="!tieneIlpiieLive"
      class="relative flex flex-col items-center text-center rounded-2xl border border-gray-200 bg-gray-100 p-8"
      :class="desbloqueadoProyectosIA ? 'max-w-md' : ''"
    >
      <div class="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-gray-200 text-gray-400">
        <FontAwesomeIcon :icon="faHeadset" class="w-7 h-7" />
      </div>
      <p class="text-lg font-heading font-semibold text-gray-600">ILPIIE Live</p>
      <p class="text-[0.8rem] mt-1 mb-5 text-gray-400">
        Asesoría en vivo por chat o videollamada sobre temas y subtemas puntuales de tu proyecto.
      </p>
      <p class="text-[0.75rem] font-medium mb-5 flex items-center justify-center gap-1.5 text-gray-400">
        <FontAwesomeIcon :icon="faLock" class="w-3 h-3" />
        Aún no has adquirido este servicio
      </p>
      <button
        @click="irAIlpiieLive"
        type="button"
        class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-300 text-gray-700 text-[0.8rem] font-semibold hover:bg-gray-400/70 transition-colors duration-75"
      >
        Entrar
        <FontAwesomeIcon :icon="faArrowRight" class="w-3 h-3" />
      </button>
    </div>
    </div>

    <div v-if="tieneIlpiieLive" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
        <!-- Tu progreso: oculto temporalmente a pedido del cliente. -->
        <div v-if="mostrarTuProgreso && desbloqueadoProyectosIA" class="rounded-2xl border border-border-light bg-white p-5 shadow-card">
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
