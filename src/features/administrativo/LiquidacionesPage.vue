<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faMoneyBillTransfer, faChevronLeft, faChevronRight, faCheck } from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import Avatar from '@/components/Avatar.vue';
import { useLiquidacionesQuery, useAutorizarPago } from '@/composables/useLiquidaciones';
import { useUiStore } from '@/stores/ui';

// Honorario = $550 fijo × tickets completados en el periodo, autorización de pago en bloque por
// asesor (docs/proyectafacil-asesorias.md §4 Fase 5 punto 3-4).
const ui = useUiStore();
const mesOffset = ref(0);

const periodo = computed(() => {
  const d = new Date();
  d.setMonth(d.getMonth() + mesOffset.value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
});

const periodoLegible = computed(() => {
  const [anio, mes] = periodo.value.split('-').map(Number);
  return new Date(anio, mes - 1, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
});

const { data: liquidaciones, isLoading } = useLiquidacionesQuery(periodo);
const autorizarPago = useAutorizarPago();

const seleccionados = ref<Set<string>>(new Set());
watch(liquidaciones, () => { seleccionados.value = new Set(); });

const seleccionables = computed(() => (liquidaciones.value?.asesores ?? []).filter((a) => !a.todoPagado));
const todosSeleccionados = computed(() => seleccionables.value.length > 0 && seleccionables.value.every((a) => seleccionados.value.has(a.asesorId)));

function toggleTodos() {
  seleccionados.value = todosSeleccionados.value ? new Set() : new Set(seleccionables.value.map((a) => a.asesorId));
}

function toggle(asesorId: string) {
  const set = new Set(seleccionados.value);
  set.has(asesorId) ? set.delete(asesorId) : set.add(asesorId);
  seleccionados.value = set;
}

const totalAutorizar = computed(() =>
  (liquidaciones.value?.asesores ?? [])
    .filter((a) => seleccionados.value.has(a.asesorId))
    .reduce((sum, a) => sum + a.honorarioPendiente, 0),
);

async function confirmarAutorizar() {
  await autorizarPago.mutateAsync({ asesorIds: [...seleccionados.value], periodo: periodo.value });
  ui.toast(`Pago autorizado a ${seleccionados.value.size} asesor${seleccionados.value.size === 1 ? '' : 'es'}`);
  seleccionados.value = new Set();
}
</script>

<template>
  <PageShell :icon="faMoneyBillTransfer" title="Liquidaciones" description="Honorarios de asesores por periodo — $550 por consulta completada.">
    <div class="flex items-center justify-between gap-3 mb-5">
      <div class="flex items-center gap-2">
        <button @click="mesOffset -= 1" type="button" class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors duration-75">
          <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
        </button>
        <span class="text-sm font-semibold text-heading capitalize px-2 min-w-[10rem] text-center">{{ periodoLegible }}</span>
        <button @click="mesOffset += 1" :disabled="mesOffset >= 0" type="button" class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors duration-75">
          <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3" />
        </button>
      </div>

      <button
        v-if="seleccionados.size > 0"
        @click="confirmarAutorizar"
        :disabled="autorizarPago.isPending.value"
        type="button"
        class="px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors duration-75 flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faCheck" class="w-3.5 h-3.5" />
        Autorizar pago · ${{ totalAutorizar.toLocaleString('es-PE') }} ({{ seleccionados.size }})
      </button>
    </div>

    <p v-if="isLoading" class="text-sm text-muted">Cargando…</p>
    <p v-else-if="(liquidaciones?.asesores ?? []).length === 0" class="text-sm text-muted py-8 text-center">Sin consultas completadas en este periodo.</p>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-[11px] uppercase tracking-widest text-muted border-b border-gray-100">
            <th class="pb-2 pr-4 w-8">
              <input type="checkbox" :checked="todosSeleccionados" @change="toggleTodos" class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
            </th>
            <th class="pb-2 pr-4 font-semibold">Asesor</th>
            <th class="pb-2 pr-4 font-semibold">Consultas completadas</th>
            <th class="pb-2 pr-4 font-semibold">Honorario total</th>
            <th class="pb-2 pr-4 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in liquidaciones?.asesores" :key="a.asesorId" class="border-b border-gray-50">
            <td class="py-3 pr-4">
              <input
                type="checkbox"
                :checked="seleccionados.has(a.asesorId)"
                :disabled="a.todoPagado"
                @change="toggle(a.asesorId)"
                class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-30"
              />
            </td>
            <td class="py-3 pr-4 font-semibold text-heading">
              <div class="flex items-center gap-2.5">
                <Avatar :nombre="a.asesorNombre" :fotoUrl="a.asesorFotoUrl" size="w-7 h-7" />
                {{ a.asesorNombre }}
              </div>
            </td>
            <td class="py-3 pr-4 text-muted">{{ a.ticketsCompletados }}</td>
            <td class="py-3 pr-4 text-heading font-medium">${{ a.honorarioTotal.toLocaleString('es-PE') }}</td>
            <td class="py-3 pr-4">
              <span
                class="px-2.5 py-1 rounded-full text-[11px] font-medium"
                :class="a.todoPagado ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
              >
                {{ a.todoPagado ? 'Pagado' : `Pendiente · $${a.honorarioPendiente.toLocaleString('es-PE')}` }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </PageShell>
</template>
