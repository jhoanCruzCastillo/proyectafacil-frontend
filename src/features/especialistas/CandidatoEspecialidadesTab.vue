<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faBook, faPen, faCheck, faTags, faCircleInfo } from '@/lib/icons';
import { useUiStore } from '@/stores/ui';
import type { CandidatoDetalle } from '@/types';

defineProps<{ detalle: CandidatoDetalle }>();

const ui = useUiStore();
function accionProximamente() {
  ui.toast('Esta función estará disponible próximamente');
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-start justify-between mb-5">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <FontAwesomeIcon :icon="faBook" class="w-4 h-4" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-heading">Especialidades de asesoría</h3>
          <p class="text-xs text-muted">Temas en los que el postulante puede brindar asesorías.</p>
        </div>
      </div>
      <button @click="accionProximamente" type="button" class="px-3.5 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-1.5 shrink-0">
        <FontAwesomeIcon :icon="faPen" class="w-3 h-3" />
        Editar especialidades
      </button>
    </div>

    <div class="rounded-xl border border-gray-200 overflow-hidden">
      <div class="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <p class="text-xs font-semibold text-muted">Tema de asesoría</p>
      </div>
      <div v-if="detalle.temas.length === 0" class="p-4 text-sm text-muted">Sin temas seleccionados.</div>
      <div v-else class="divide-y divide-gray-100">
        <div v-for="t in detalle.temas" :key="t.id" class="flex items-center gap-3 px-4 py-3">
          <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <FontAwesomeIcon :icon="faCheck" class="w-2.5 h-2.5" />
          </span>
          <span class="text-sm text-heading">{{ t.nombre }}</span>
        </div>
      </div>
    </div>

    <div v-if="detalle.otrosTemas" class="rounded-xl border border-gray-200 p-4 mt-5">
      <h4 class="text-sm font-bold text-heading mb-1.5 flex items-center gap-2"><FontAwesomeIcon :icon="faTags" class="w-3.5 h-3.5 text-emerald-600" /> Otros temas mencionados</h4>
      <p class="text-sm text-heading leading-relaxed">{{ detalle.otrosTemas }}</p>
    </div>

    <div class="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 mt-5">
      <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
        <FontAwesomeIcon :icon="faCircleInfo" class="w-3 h-3" />
      </div>
      <div>
        <p class="text-sm font-bold text-heading mb-1">Información</p>
        <p class="text-sm text-heading leading-relaxed">Estos son los temas que el postulante seleccionó al llenar el formulario de registro. Se validarán durante el proceso de evaluación.</p>
      </div>
    </div>
  </div>
</template>
