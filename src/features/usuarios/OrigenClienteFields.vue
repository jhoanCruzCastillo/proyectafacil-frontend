<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faInfoCircle, faCalendarDays, faGraduationCap, faGlobe, faClockRotateLeft } from '@/lib/icons';
import { useCursosQuery } from '@/composables/useCursos';
import type { OrigenCliente } from '@/types';

/** Duraciones fijas de "vigencia como alumno" — espejo de
 * UsuariosController::ETIQUETAS_VIGENCIA (backend). Ya no se elige una fecha de corte libre: la
 * vigencia se calcula sumando esta duración a la fecha de registro real del alumno, pedido
 * explícito del usuario (2026-09-29). */
const OPCIONES_VIGENCIA_MESES = [1, 3, 6, 12];
const ETIQUETA_MESES: Record<number, string> = { 1: '1 mes', 3: '3 meses', 6: '6 meses', 12: '1 año' };

const props = defineProps<{
  origen: OrigenCliente;
  /** number = duración en meses; null = sin vigencia (acceso indefinido); undefined = "no cambiar"
   * — solo tiene sentido editando un alumno que ya existe (ver esEdicion). */
  vigenciaMeses: number | null | undefined;
  cursoId: string | null;
  /** Valor guardado al abrir el modal (para el badge de referencia) — si falta, no se muestra el badge. */
  origenGuardado?: OrigenCliente;
  cambiadoPorNombre?: string | null;
  cambiadoEn?: string | null;
  /** true = se está editando un alumno que ya existe — habilita la opción "No cambiar" y muestra su
   * vigencia actual como referencia. */
  esEdicion?: boolean;
  /** Fecha ISO (YYYY-MM-DD) de la vigencia ya guardada, solo para mostrarla como referencia. */
  vigenciaActual?: string | null;
}>();
const emit = defineEmits<{
  'update:origen': [OrigenCliente];
  'update:vigenciaMeses': [number | null | undefined];
  'update:cursoId': [string | null];
}>();

const { data: cursosData } = useCursosQuery();
const cursos = computed(() => cursosData.value ?? []);

const origenIcon = { alumno: faGraduationCap, externo: faGlobe } as const;
const origenLabel = { alumno: 'Alumno', externo: 'Externo' } as const;

const fechaCambio = computed(() => (props.cambiadoEn ? new Date(props.cambiadoEn).toLocaleDateString('es-PE') : ''));

const SIN_CAMBIO = 'sin-cambio';
const SIN_VIGENCIA = 'sin-vigencia';
const valorSelect = computed(() => {
  if (props.vigenciaMeses === undefined) return SIN_CAMBIO;
  if (props.vigenciaMeses === null) return SIN_VIGENCIA;
  return String(props.vigenciaMeses);
});
function handleVigenciaChange(e: Event) {
  const valor = (e.target as HTMLSelectElement).value;
  if (valor === SIN_CAMBIO) emit('update:vigenciaMeses', undefined);
  else if (valor === SIN_VIGENCIA) emit('update:vigenciaMeses', null);
  else emit('update:vigenciaMeses', Number(valor));
}

const vigenciaActualTexto = computed(() => {
  if (!props.vigenciaActual) return 'sin vigencia (acceso indefinido)';
  return `vence el ${new Date(`${props.vigenciaActual}T00:00:00`).toLocaleDateString('es-PE')}`;
});
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
      <label class="block text-sm font-medium text-heading mb-1.5">Vigencia como alumno</label>
      <div class="relative">
        <FontAwesomeIcon :icon="faCalendarDays" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <select
          :value="valorSelect"
          @change="handleVigenciaChange"
          class="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        >
          <option v-if="esEdicion" :value="SIN_CAMBIO">No cambiar</option>
          <option :value="SIN_VIGENCIA">Sin vigencia (acceso indefinido)</option>
          <option v-for="meses in OPCIONES_VIGENCIA_MESES" :key="meses" :value="meses">{{ ETIQUETA_MESES[meses] }}</option>
        </select>
      </div>
      <p class="flex items-start gap-2 text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 mt-2">
        <FontAwesomeIcon :icon="faInfoCircle" class="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          <span v-if="esEdicion">Vigencia actual: {{ vigenciaActualTexto }}. </span>
          Se calcula sumando la duración elegida a la fecha de registro del alumno.
        </span>
      </p>

      <label class="block text-sm font-medium text-heading mb-1.5 mt-3">Curso</label>
      <select
        :value="cursoId"
        @change="$emit('update:cursoId', ($event.target as HTMLSelectElement).value || null)"
        class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
      >
        <option value="">Sin curso</option>
        <option v-for="c in cursos" :key="c.id" :value="c.id">{{ c.nombre }}</option>
      </select>
    </div>
  </div>
</template>
