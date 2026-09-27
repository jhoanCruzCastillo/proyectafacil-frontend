<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCoins, faCircleInfo } from '@/lib/icons';
import type { UsoTurno } from '@/api/contracts/pruebaIA';

const props = defineProps<{ usos: UsoTurno[] }>();

// output_tokens ya INCLUYE reasoning_tokens (es un desglose, no un cargo aparte) — se muestra el
// desglose solo como dato informativo, nunca se suma dos veces al total.
const totalEntrada = computed(() => props.usos.reduce((acc, u) => acc + (u.usage.input_tokens ?? 0), 0));
const totalSalida = computed(() => props.usos.reduce((acc, u) => acc + (u.usage.output_tokens ?? 0), 0));
const totalCosto = computed(() => props.usos.reduce((acc, u) => acc + u.costoUsd, 0));

function formatoUsd(n: number): string {
  return n < 0.01 && n > 0 ? `$${n.toFixed(5)}` : `$${n.toFixed(4)}`;
}
</script>

<template>
  <div v-if="usos.length > 0" class="border border-gray-100 rounded-xl overflow-hidden">
    <div class="flex flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3 bg-gray-50/80 border-b border-gray-100">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
          <FontAwesomeIcon :icon="faCoins" class="w-3.5 h-3.5" />
        </div>
        <div>
          <p class="text-[11px] uppercase tracking-wide text-muted font-medium">Costo de tokens (conversación)</p>
          <p class="text-lg font-bold text-heading tabular-nums leading-tight">{{ formatoUsd(totalCosto) }}</p>
        </div>
      </div>
      <div>
        <p class="text-[11px] uppercase tracking-wide text-muted font-medium">Tokens de entrada</p>
        <p class="text-sm font-semibold text-heading tabular-nums">{{ totalEntrada.toLocaleString('es-PE') }}</p>
      </div>
      <div>
        <p class="text-[11px] uppercase tracking-wide text-muted font-medium">Tokens de salida</p>
        <p class="text-sm font-semibold text-heading tabular-nums">{{ totalSalida.toLocaleString('es-PE') }}</p>
      </div>
      <div>
        <p class="text-[11px] uppercase tracking-wide text-muted font-medium">Turnos</p>
        <p class="text-sm font-semibold text-heading tabular-nums">{{ usos.length }}</p>
      </div>
    </div>

    <div class="max-h-40 overflow-y-auto">
      <table class="w-full text-xs">
        <thead class="sticky top-0 bg-white">
          <tr class="text-left text-muted border-b border-gray-100">
            <th class="px-4 py-1.5 font-medium">#</th>
            <th class="px-2 py-1.5 font-medium">Modelo</th>
            <th class="px-2 py-1.5 font-medium text-right">Entrada</th>
            <th class="px-2 py-1.5 font-medium text-right">Salida</th>
            <th class="px-4 py-1.5 font-medium text-right">Costo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(u, i) in usos" :key="i" class="border-b border-gray-50 last:border-0">
            <td class="px-4 py-1.5 text-muted tabular-nums">{{ i + 1 }}</td>
            <td class="px-2 py-1.5 font-mono text-heading">{{ u.modelo }}</td>
            <td class="px-2 py-1.5 text-right tabular-nums text-heading">
              {{ (u.usage.input_tokens ?? 0).toLocaleString('es-PE') }}
              <span v-if="(u.usage.input_tokens_details?.cached_tokens ?? 0) > 0" class="text-muted">
                ({{ u.usage.input_tokens_details!.cached_tokens!.toLocaleString('es-PE') }} caché)
              </span>
            </td>
            <td class="px-2 py-1.5 text-right tabular-nums text-heading">
              {{ (u.usage.output_tokens ?? 0).toLocaleString('es-PE') }}
              <span v-if="(u.usage.output_tokens_details?.reasoning_tokens ?? 0) > 0" class="text-muted">
                ({{ u.usage.output_tokens_details!.reasoning_tokens!.toLocaleString('es-PE') }} razon.)
              </span>
            </td>
            <td class="px-4 py-1.5 text-right tabular-nums font-medium text-heading">{{ formatoUsd(u.costoUsd) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="flex items-start gap-1.5 px-4 py-2 text-[11px] text-muted bg-gray-50/50 border-t border-gray-100">
      <FontAwesomeIcon :icon="faCircleInfo" class="w-3 h-3 shrink-0 mt-0.5" />
      Solo tokens de conversación. El tiempo del contenedor de Code Interpreter (cuando genera un archivo) OpenAI lo cobra aparte y no viene incluido en este cálculo.
    </p>
  </div>
</template>
