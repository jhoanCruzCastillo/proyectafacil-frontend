<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faInfoCircle, faCalendarDays, faGraduationCap, faGlobe, faClockRotateLeft } from '@/lib/icons';
import type { OrigenCliente } from '@/types';

const props = defineProps<{
  origen: OrigenCliente;
  vigenciaAlumnoHasta: string;
  /** Valor guardado al abrir el modal (para el badge de referencia) — si falta, no se muestra el badge. */
  origenGuardado?: OrigenCliente;
  cambiadoPorNombre?: string | null;
  cambiadoEn?: string | null;
}>();
defineEmits<{ 'update:origen': [OrigenCliente]; 'update:vigenciaAlumnoHasta': [string] }>();

const origenIcon = { alumno: faGraduationCap, externo: faGlobe } as const;
const origenLabel = { alumno: 'Alumno', externo: 'Externo' } as const;

const fechaCambio = computed(() => (props.cambiadoEn ? new Date(props.cambiadoEn).toLocaleDateString('es-PE') : ''));
</script>

<template>
  <div class="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-4 space-y-3">
    <div>
      <label class="block text-sm font-medium text-heading mb-1.5">Origen</label>
      <div class="flex items-center gap-2">
        <select
          :value="origen"
          @change="$emit('update:origen', ($event.target as HTMLSelectElement).value as OrigenCliente)"
          class="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        >
          <option value="alumno">Alumno</option>
          <option value="externo">Externo</option>
        </select>
        <span
          v-if="origenGuardado"
          title="Origen guardado actualmente"
          class="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-brand-50 text-brand-700 text-sm font-medium shrink-0"
        >
          <FontAwesomeIcon :icon="origenIcon[origenGuardado]" class="w-3.5 h-3.5" />
          {{ origenLabel[origenGuardado] }}
        </span>
        <FontAwesomeIcon v-if="cambiadoPorNombre" :icon="faClockRotateLeft" class="w-4 h-4 text-gray-400 shrink-0" title="Este origen fue cambiado manualmente" />
      </div>
    </div>

    <p v-if="cambiadoPorNombre" class="flex items-center gap-2 text-xs text-muted">
      <FontAwesomeIcon :icon="faClockRotateLeft" class="w-3 h-3 shrink-0" />
      Cambiado manualmente por {{ cambiadoPorNombre }} el {{ fechaCambio }}
    </p>

    <div v-if="origen === 'alumno'">
      <label class="block text-sm font-medium text-heading mb-1.5">Vigencia como alumno hasta</label>
      <div class="relative">
        <FontAwesomeIcon :icon="faCalendarDays" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          :value="vigenciaAlumnoHasta"
          @input="$emit('update:vigenciaAlumnoHasta', ($event.target as HTMLInputElement).value)"
          type="date"
          class="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
      </div>
      <p class="flex items-start gap-2 text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 mt-2">
        <FontAwesomeIcon :icon="faInfoCircle" class="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Fecha hasta la cual el usuario tendrá acceso con origen {{ origenLabel[origen] }}.
      </p>
    </div>
  </div>
</template>
