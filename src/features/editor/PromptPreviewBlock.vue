<script setup lang="ts">
import { ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCopy, faCheck } from '@/lib/icons';

const props = defineProps<{ titulo: string; nota?: string; texto: string }>();
const copiado = ref(false);

async function copiar() {
  await navigator.clipboard.writeText(props.texto);
  copiado.value = true;
  setTimeout(() => { copiado.value = false; }, 1500);
}
</script>

<template>
  <div>
    <div class="flex items-start justify-between gap-3 mb-1.5">
      <div class="min-w-0">
        <h4 class="text-xs font-bold text-heading">{{ titulo }}</h4>
        <p v-if="nota" class="text-[11px] text-muted mt-0.5 leading-snug">{{ nota }}</p>
      </div>
      <button
        type="button"
        class="shrink-0 px-2.5 py-1 rounded-md border border-gray-200 text-[11px] font-medium text-muted hover:bg-gray-50 hover:text-heading transition-colors flex items-center gap-1.5"
        @click="copiar"
      >
        <FontAwesomeIcon :icon="copiado ? faCheck : faCopy" class="w-3 h-3" />
        {{ copiado ? 'Copiado' : 'Copiar' }}
      </button>
    </div>
    <pre class="rounded-lg bg-slate-950 text-emerald-100/90 text-[11px] leading-relaxed font-mono whitespace-pre-wrap p-3 max-h-72 overflow-y-auto">{{ texto || '(vacío)' }}</pre>
  </div>
</template>
