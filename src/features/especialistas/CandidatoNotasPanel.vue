<script setup lang="ts">
import { ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faComments, faPlus } from '@/lib/icons';
import { useNotasCandidatoQuery, useAgregarNotaCandidato } from '@/composables/useCandidatos';
import { formatoFechaHora } from '@/lib/fechas';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ candidatoId: string }>();

const ui = useUiStore();
const { data: notas } = useNotasCandidatoQuery(() => props.candidatoId);
const agregarNota = useAgregarNotaCandidato();

const mostrarFormNota = ref(false);
const textoNota = ref('');
async function guardarNota() {
  const texto = textoNota.value.trim();
  if (!texto) return;
  try {
    await agregarNota.mutateAsync({ id: props.candidatoId, texto });
    textoNota.value = '';
    mostrarFormNota.value = false;
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo agregar la nota', 'error');
  }
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-bold text-heading flex items-center gap-2"><FontAwesomeIcon :icon="faComments" class="w-3.5 h-3.5 text-muted" /> Notas internas</h3>
      <button @click="mostrarFormNota = !mostrarFormNota" type="button" class="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1">
        <FontAwesomeIcon :icon="faPlus" class="w-3 h-3" />
        Agregar nota
      </button>
    </div>

    <div v-if="mostrarFormNota" class="mb-3 space-y-2">
      <textarea
        v-model="textoNota"
        rows="3"
        placeholder="Escribe una nota sobre esta postulación…"
        class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
      />
      <div class="flex justify-end gap-2">
        <button @click="mostrarFormNota = false; textoNota = ''" type="button" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors duration-75">Cancelar</button>
        <button
          @click="guardarNota"
          :disabled="!textoNota.trim() || agregarNota.isPending.value"
          type="button"
          class="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors duration-75"
        >
          {{ agregarNota.isPending.value ? 'Guardando…' : 'Guardar nota' }}
        </button>
      </div>
    </div>

    <div v-if="!notas || notas.length === 0" class="text-center py-6 px-3 rounded-lg bg-gray-50">
      <FontAwesomeIcon :icon="faComments" class="w-5 h-5 text-gray-300 mb-1.5" />
      <p class="text-sm text-muted">No hay notas aún.</p>
      <p class="text-xs text-gray-400 mt-0.5">Agrega comentarios sobre la evaluación, la entrevista u otra información relevante.</p>
    </div>
    <div v-else class="space-y-3 max-h-64 overflow-y-auto">
      <div v-for="n in notas" :key="n.id" class="p-3 rounded-lg bg-gray-50">
        <p class="text-sm text-heading whitespace-pre-line">{{ n.texto }}</p>
        <p class="text-[11px] text-muted mt-1.5">{{ n.autorNombre }} · {{ formatoFechaHora(n.creadoEn) }}</p>
      </div>
    </div>
  </div>
</template>
