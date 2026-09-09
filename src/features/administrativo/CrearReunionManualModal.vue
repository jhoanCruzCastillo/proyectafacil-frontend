<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faVideo, faTriangleExclamation } from '@/lib/icons';
import { useUsuariosQuery } from '@/composables/useUsuarios';
import { useDocentesAdminQuery } from '@/composables/useDocentesAdmin';
import { useCrearReunionManual } from '@/composables/useTicketsAsesoria';
import { useUiStore } from '@/stores/ui';

// Botón "Agendar reunión" de Tickets de asesoría (pedido explícito del usuario) — crea una
// videollamada directa entre un cliente y un asesor elegidos a mano, en el horario que el
// Administrativo defina, sin depender de que el asesor haya publicado ese horario como
// disponible (ver TicketsAsesoriaController::crearManual). No consume ninguna ficha del alumno:
// es una reunión que ofrece el Administrativo, no una que el alumno pidió con su saldo.
const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ close: [] }>();

const ui = useUiStore();
const { data: usuarios } = useUsuariosQuery();
const { data: docentesAdmin } = useDocentesAdminQuery();
const crearReunion = useCrearReunionManual();

const clientes = computed(() => (usuarios.value ?? []).filter((u) => u.rol === 'cliente').sort((a, b) => a.nombre.localeCompare(b.nombre)));
const asesores = computed(() => (docentesAdmin.value ?? []).filter((d) => d.estado === 'activo').sort((a, b) => a.nombre.localeCompare(b.nombre)));

const clienteId = ref('');
const asesorId = ref('');
const fecha = ref('');
const horaInicio = ref('');
const horaFin = ref('');
const error = ref<string | null>(null);

// Reset del formulario cada vez que se abre — sin esto, cerrar y reabrir dejaba los valores de la
// última reunión creada, fácil de confundir con "ya está listo para crear otra".
watch(() => props.isOpen, (abierto) => {
  if (!abierto) return;
  clienteId.value = '';
  asesorId.value = '';
  fecha.value = '';
  horaInicio.value = '';
  horaFin.value = '';
  error.value = null;
});

const hoyIso = computed(() => new Date().toISOString().slice(0, 10));

const formularioCompleto = computed(() => !!clienteId.value && !!asesorId.value && !!fecha.value && !!horaInicio.value && !!horaFin.value);

async function crear() {
  error.value = null;
  if (horaFin.value <= horaInicio.value) {
    error.value = 'La hora de fin debe ser posterior a la hora de inicio';
    return;
  }
  try {
    await crearReunion.mutateAsync({
      clienteId: clienteId.value,
      asesorId: asesorId.value,
      horarioFecha: fecha.value,
      horarioHoraInicio: horaInicio.value,
      horarioHoraFin: horaFin.value,
    });
    ui.toast('Reunión agendada — el link de Meet ya está listo');
    emit('close');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo agendar la reunión';
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-md" @click.stop>
          <div class="p-6 pb-4 flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faVideo" class="w-4 h-4" />
              </div>
              <div>
                <h2 class="text-lg font-bold text-heading">Agendar reunión</h2>
                <p class="text-xs text-muted mt-0.5">Videollamada directa, en el horario que elijas — no depende de la disponibilidad publicada del asesor.</p>
              </div>
            </div>
            <button @click="emit('close')" type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100 shrink-0">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <div class="px-6 pb-6 space-y-4">
            <div>
              <label class="block text-xs font-semibold text-heading mb-1.5">Cliente</label>
              <select v-model="clienteId" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500">
                <option value="" disabled>Elige un cliente…</option>
                <option v-for="c in clientes" :key="c.id" :value="c.id">{{ c.nombre }}{{ c.correo ? ` · ${c.correo}` : '' }}</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-heading mb-1.5">Asesor</label>
              <select v-model="asesorId" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500">
                <option value="" disabled>Elige un asesor…</option>
                <option v-for="a in asesores" :key="a.id" :value="a.id">{{ a.nombre }}{{ a.correo ? ` · ${a.correo}` : '' }}</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-heading mb-1.5">Fecha</label>
              <input v-model="fecha" type="date" :min="hoyIso" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-heading mb-1.5">Hora de inicio</label>
                <input v-model="horaInicio" type="time" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-heading mb-1.5">Hora de fin</label>
                <input v-model="horaFin" type="time" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
            </div>

            <div v-if="error" class="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700">
              <FontAwesomeIcon :icon="faTriangleExclamation" class="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {{ error }}
            </div>

            <button
              @click="crear"
              :disabled="!formularioCompleto || crearReunion.isPending.value"
              type="button"
              class="w-full px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center justify-center gap-2"
            >
              <FontAwesomeIcon :icon="faVideo" class="w-3.5 h-3.5" />
              {{ crearReunion.isPending.value ? 'Generando link de Meet…' : 'Agendar y generar link' }}
            </button>
          </div>
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
