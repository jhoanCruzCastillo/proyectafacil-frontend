<script setup lang="ts">
import { ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faClock, faCheck, faTriangleExclamation } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import { useConfiguracionSlaQuery, useActualizarConfiguracionSla } from '@/composables/useConfiguracionSla';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const { data: config, isLoading } = useConfiguracionSlaQuery();
const actualizar = useActualizarConfiguracionSla();

const tiempoEsperaChatHoras = ref(24);
const tiempoAceptacionVideoMinutos = ref(20);
const tiempoExtraConexionMinutos = ref(15);
const vigenciaHorarioDias = ref(1);
const cancelacionSinLimite = ref(false);
const cancelacionLimiteMinutos = ref(60);

watch(
  config,
  (c) => {
    if (!c) return;
    tiempoEsperaChatHoras.value = c.tiempoEsperaChatHoras;
    tiempoAceptacionVideoMinutos.value = c.tiempoAceptacionVideoMinutos;
    tiempoExtraConexionMinutos.value = c.tiempoExtraConexionMinutos;
    vigenciaHorarioDias.value = c.vigenciaHorarioDias;
    cancelacionSinLimite.value = c.cancelacionLimiteMinutos === null;
    if (c.cancelacionLimiteMinutos !== null) cancelacionLimiteMinutos.value = c.cancelacionLimiteMinutos;
  },
  { immediate: true },
);

const error = ref('');

async function guardar() {
  error.value = '';
  try {
    await actualizar.mutateAsync({
      tiempoEsperaChatHoras: tiempoEsperaChatHoras.value,
      tiempoAceptacionVideoMinutos: tiempoAceptacionVideoMinutos.value,
      tiempoExtraConexionMinutos: tiempoExtraConexionMinutos.value,
      vigenciaHorarioDias: vigenciaHorarioDias.value,
      cancelacionLimiteMinutos: cancelacionSinLimite.value ? null : cancelacionLimiteMinutos.value,
    });
    ui.toast('Configuración de SLA guardada');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar la configuración.';
  }
}
</script>

<template>
  <PageShell
    :icon="faClock"
    title="Configuración de SLA"
    description="Tiempos límite que rigen cuánto puede esperar una solicitud de asesoría antes de marcarse como vencida."
  >
    <div v-if="isLoading" class="text-sm text-muted">Cargando…</div>

    <div v-else class="max-w-xl space-y-8">
      <section class="space-y-4">
        <div>
          <h2 class="text-sm font-semibold text-heading">En uso</h2>
          <p class="text-xs text-muted mt-0.5">Estos dos valores alimentan directamente el cálculo de vencimiento de cada solicitud nueva.</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-heading mb-1.5">Tiempo de espera — Chat (horas)</label>
          <input
            v-model.number="tiempoEsperaChatHoras"
            type="number"
            min="1"
            class="w-40 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          <p class="text-xs text-muted mt-1">Una solicitud de chat sin aceptar se marca "Vencido" pasadas estas horas.</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-heading mb-1.5">Tiempo de aceptación — Videollamada (minutos)</label>
          <input
            v-model.number="tiempoAceptacionVideoMinutos"
            type="number"
            min="1"
            class="w-40 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          <p class="text-xs text-muted mt-1">Una solicitud de videollamada sin aceptar se marca "Vencido" pasados estos minutos.</p>
        </div>
      </section>

      <section class="space-y-4 pt-6 border-t border-gray-100">
        <div>
          <h2 class="text-sm font-semibold text-heading">Cancelación de solicitudes</h2>
          <p class="text-xs text-muted mt-0.5">Cuánto tiempo, desde que el alumno envía la solicitud, puede cancelarla él mismo.</p>
        </div>

        <label class="flex items-center gap-2.5 text-sm text-heading cursor-pointer w-fit">
          <input v-model="cancelacionSinLimite" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500/30" />
          Permitir cancelar en cualquier momento (sin límite de tiempo)
        </label>

        <div v-if="!cancelacionSinLimite">
          <label class="block text-sm font-medium text-heading mb-1.5">Límite para cancelar (minutos desde el envío)</label>
          <input
            v-model.number="cancelacionLimiteMinutos"
            type="number"
            min="1"
            class="w-40 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          <p class="text-xs text-muted mt-1">Pasado este tiempo, el botón de cancelar solicitud deja de funcionar para el alumno.</p>
        </div>
      </section>

      <section class="space-y-4 pt-6 border-t border-gray-100">
        <div>
          <h2 class="text-sm font-semibold text-heading">Reservado para uso futuro</h2>
          <p class="text-xs text-amber-700 mt-0.5 flex items-start gap-1.5">
            <FontAwesomeIcon :icon="faTriangleExclamation" class="w-3 h-3 shrink-0 mt-0.5" />
            <span>Estos dos campos se guardan, pero hoy ninguna lógica los lee — cambiarlos no tiene efecto todavía.</span>
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-heading mb-1.5">Tiempo extra de conexión (minutos)</label>
          <input
            v-model.number="tiempoExtraConexionMinutos"
            type="number"
            min="1"
            class="w-40 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-heading mb-1.5">Vigencia de horario (días)</label>
          <input
            v-model.number="vigenciaHorarioDias"
            type="number"
            min="1"
            class="w-40 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
      </section>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div class="pt-4 border-t border-gray-100 flex justify-end">
        <button
          @click="guardar"
          :disabled="actualizar.isPending.value"
          type="button"
          class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center gap-2"
        >
          <FontAwesomeIcon :icon="faCheck" class="w-3.5 h-3.5" />
          Guardar cambios
        </button>
      </div>
    </div>
  </PageShell>
</template>
