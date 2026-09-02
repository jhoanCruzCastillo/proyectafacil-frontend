<script setup lang="ts">
import { ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faVideo, faCheck, faGlobe, faUserCheck } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import { useConfiguracionVideoconferenciaQuery, useActualizarConfiguracionVideoconferencia } from '@/composables/useConfiguracionVideoconferencia';
import { usePushActividad } from '@/composables/useActividad';
import { useUiStore } from '@/stores/ui';
import type { ConfiguracionVideoconferencia } from '@/types';

const ui = useUiStore();
const { data: config, isLoading } = useConfiguracionVideoconferenciaQuery();
const actualizar = useActualizarConfiguracionVideoconferencia();
const pushActividad = usePushActividad();

const OPCIONES: { valor: ConfiguracionVideoconferencia['tipoAcceso']; icono: typeof faGlobe; titulo: string; texto: string }[] = [
  { valor: 'abierta', icono: faGlobe, titulo: 'Abierta', texto: 'Cualquiera con el link entra directo a la videollamada, sin tocar la puerta ni necesitar estar logueado con el correo exacto que se invitó.' },
  { valor: 'invitados', icono: faUserCheck, titulo: 'Solo invitados', texto: 'Solo el cliente y el asesor invitados entran directo. Cualquier otra persona con el link queda en la sala de espera hasta que el asesor la admita.' },
];

// Pedido explícito del usuario, replica el "Tipo de acceso a la reunión" del propio Google Meet.
// 'abierta' por defecto — mismo valor con el que ya se crean los links hoy (ver GoogleMeetService).
const tipoAcceso = ref<ConfiguracionVideoconferencia['tipoAcceso']>('abierta');

watch(config, (c) => {
  if (!c) return;
  tipoAcceso.value = c.tipoAcceso;
}, { immediate: true });

const error = ref('');

async function guardar() {
  error.value = '';
  try {
    await actualizar.mutateAsync({ tipoAcceso: tipoAcceso.value });
    await pushActividad.mutateAsync({ mensaje: 'Actualizó configuración de videollamadas', color: 'orange', categoria: 'Configuración' });
    ui.toast('Configuración de videollamadas guardada');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar la configuración.';
  }
}
</script>

<template>
  <PageShell
    :icon="faVideo"
    title="Configuración de videollamadas"
    description="Define cómo se puede entrar a las videollamadas de asesoría que se agenden de acá en adelante."
  >
    <div v-if="isLoading" class="text-sm text-muted">Cargando…</div>

    <div v-else class="max-w-xl space-y-8">
      <section class="space-y-4">
        <div>
          <h2 class="text-sm font-semibold text-heading">Tipo de acceso a la reunión</h2>
          <p class="text-xs text-muted mt-0.5">Solo afecta a las asesorías que se agenden después de guardar — las que ya tienen link generado no cambian.</p>
        </div>

        <label
          v-for="o in OPCIONES"
          :key="o.valor"
          class="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors duration-75"
          :class="tipoAcceso === o.valor ? 'border-brand-400 bg-brand-50/60' : 'border-gray-200 hover:bg-gray-50'"
        >
          <input v-model="tipoAcceso" :value="o.valor" type="radio" name="tipo-acceso" class="mt-1 w-4 h-4 text-brand-600 focus:ring-brand-500/30" />
          <div class="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center justify-center shrink-0">
            <FontAwesomeIcon :icon="o.icono" class="w-3.5 h-3.5" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-heading">{{ o.titulo }}</p>
            <p class="text-xs text-muted mt-0.5 leading-snug">{{ o.texto }}</p>
          </div>
        </label>
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
