<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faFolderOpen, faHeadset, faLock, faArrowRight, faCircleCheck } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import { useSessionStore } from '@/stores/session';
import { puedeAccederProyectosIA } from '@/lib/permisos';

// Portada de entrada — pedido explícito del cliente: al ingresar, elegir entre "Proyectos de
// Inversión con IA" e "ILPIIE Live" antes de entrar a cualquiera de los dos. "Proyectos de
// Inversión con IA" se bloquea (visible, sin poder entrar) para quien no tiene plan vigente ni es
// alumno vigente — mismo chequeo que usan el guard del router y el candado del sidebar
// (`puedeAccederProyectosIA`, único lugar donde vive la regla).
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

function irAProyectosIA() {
  router.push({ name: 'formatos' });
}
function verPlanes() {
  router.push({ name: 'elegir-plan' });
}
function irAIlpiieLive() {
  router.push({ name: 'asesorias-chat' });
}
</script>

<template>
  <PageShell
    :icon="faFolderOpen"
    compact
    title="¿Qué quieres hacer hoy?"
    description="Elige con qué herramienta de Proyecta Fácil quieres trabajar."
  >
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
      <!-- Proyectos de Inversión con IA -->
      <div
        class="relative flex flex-col rounded-2xl border p-6 transition-colors duration-100"
        :class="desbloqueadoProyectosIA ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50'"
      >
        <div
          class="w-14 h-14 rounded-full flex items-center justify-center mb-4"
          :class="desbloqueadoProyectosIA ? 'bg-brand-100 text-brand-600' : 'bg-gray-200 text-gray-400'"
        >
          <FontAwesomeIcon :icon="faFolderOpen" class="w-6 h-6" />
        </div>
        <p class="text-lg font-bold" :class="desbloqueadoProyectosIA ? 'text-heading' : 'text-gray-400'">Proyectos de Inversión con IA</p>
        <p class="text-[0.8rem] mt-1 mb-5 flex-1" :class="desbloqueadoProyectosIA ? 'text-muted' : 'text-gray-400'">
          Formatos, fichas técnicas, IOARR y perfiles — llena tus documentos de inversión con ayuda de IA.
        </p>
        <p class="text-[0.75rem] font-medium mb-4 flex items-center gap-1.5" :class="desbloqueadoProyectosIA ? 'text-brand-600' : 'text-gray-400'">
          <FontAwesomeIcon :icon="desbloqueadoProyectosIA ? faCircleCheck : faLock" class="w-3 h-3" />
          {{ subtituloProyectosIA }}
        </p>
        <button
          v-if="desbloqueadoProyectosIA"
          @click="irAProyectosIA"
          type="button"
          class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-[0.8rem] font-semibold hover:bg-brand-700 transition-colors duration-75"
        >
          Entrar
          <FontAwesomeIcon :icon="faArrowRight" class="w-3 h-3" />
        </button>
        <button
          v-else
          @click="verPlanes"
          type="button"
          class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-600 text-[0.8rem] font-semibold hover:bg-gray-100 transition-colors duration-75"
        >
          Ver planes
        </button>
      </div>

      <!-- ILPIIE Live -->
      <div class="relative flex flex-col rounded-2xl border border-gray-200 bg-white p-6">
        <div class="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-purple-100 text-purple-600">
          <FontAwesomeIcon :icon="faHeadset" class="w-6 h-6" />
        </div>
        <p class="text-lg font-bold text-heading">ILPIIE Live</p>
        <p class="text-[0.8rem] text-muted mt-1 mb-5 flex-1">
          Asesoría en vivo por chat o videollamada sobre temas y subtemas puntuales de tu proyecto.
        </p>
        <p class="text-[0.75rem] font-medium text-purple-600 mb-4 flex items-center gap-1.5">
          <FontAwesomeIcon :icon="faCircleCheck" class="w-3 h-3" />
          Siempre disponible
        </p>
        <button
          @click="irAIlpiieLive"
          type="button"
          class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 text-white text-[0.8rem] font-semibold hover:bg-purple-700 transition-colors duration-75"
        >
          Entrar
          <FontAwesomeIcon :icon="faArrowRight" class="w-3 h-3" />
        </button>
      </div>
    </div>
  </PageShell>
</template>
