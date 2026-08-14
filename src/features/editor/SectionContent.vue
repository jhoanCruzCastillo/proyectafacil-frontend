<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCircleQuestion, faTrash, faPlus, faNoteSticky } from '@/lib/icons';
import FieldCard from './FieldCard.vue';
import AyudaSubseccionModal from './AyudaSubseccionModal.vue';
import type { ModoEdicionEditor } from '@/composables/usePlantillaEditor';
import type { Campo, ConfigTabla, EstadoCampoIA, Seccion } from '@/types';

// Edición de nombre de sección/subsección, hoja de Excel, agregar/eliminar subsecciones y campos,
// y edición del valor por defecto y del valor de ejemplo (tab Ejemplos).
const props = defineProps<{
  seccion: Seccion;
  showExampleValues?: boolean;
  exampleValores?: Record<string, string>;
  /** true = modo edición (tab Estructura del editor de admin) */
  editable?: boolean;
  selectedCampoId?: string | null;
  highlightMissingCaptura?: boolean;
  /** true = el valor de ejemplo/cliente es editable aunque `editable` (modo estructura) sea falso — usado en la ficha del cliente */
  valuesEditable?: boolean;
  /** Mensajes de validación por identificador de campo (solo modo cliente) */
  erroresValidacion?: Record<string, string>;
  /** Valores de un ejemplo de referencia autorado por el admin, por identificador de campo (solo modo cliente) */
  referenciaValores?: Record<string, string>;
  /** true = el plan del cliente incluye la ayuda de IA para mejorar títulos/textos (Nivel 1+) */
  permiteMejoraIA?: boolean;
  /** Estados del llenado IA por identificador (solo cliente, tras un llenado) */
  estadosIA?: Record<string, EstadoCampoIA>;
  /** Admin: live | confirmar — el cliente no lo pasa (queda live) */
  modoEdicion?: ModoEdicionEditor;
  /** Admin: borradores pendientes por campo.id en modo confirmar */
  borradoresPorCampo?: Record<string, string>;
}>();

const emit = defineEmits<{
  'select-campo': [campo: Campo];
  /** `despuesDeCampoId` inserta el campo justo detrás de ese; sin él, al final de la subsección */
  'add-campo': [subseccionId: string, subseccionCodigo: string, despuesDeCampoId?: string];
  /** Igual que `add-campo`, pero para una nota (4.11) — no lleva código de subsección: nunca numera. */
  'add-nota': [subseccionId: string, despuesDeCampoId?: string];
  'delete-campo': [campoId: string, subseccionId: string];
  /** Copia el campo justo debajo, con el siguiente identificador libre de su subsección */
  'duplicate-campo': [campoId: string, subseccionId: string];
  'section-name-change': [seccionId: string, nombre: string];
  'section-hoja-change': [seccionId: string, hoja: string];
  'subsection-name-change': [subseccionId: string, nombre: string];
  'subseccion-ayuda-change': [subseccionId: string, ayuda: string];
  'add-subsection': [seccionId: string];
  'delete-subsection': [subseccionId: string, seccionId: string];
  'update-default-value': [campoId: string, value: string];
  /** campoId + identificador: el id sirve para borradores en modo confirmar */
  'update-example-value': [campoId: string, identificador: string, value: string];
  'update-config-tabla': [campoId: string, config: ConfigTabla];
  'confirmar-ia': [identificador: string];
  'confirmar-borrador': [campoId: string, identificador: string];
}>();

const ayudaAbiertaId = ref<string | null>(null);
const subseccionAyuda = computed(() => props.seccion.subsecciones.find((s) => s.id === ayudaAbiertaId.value));
</script>

<template>
  <div :data-section-id="seccion.id" class="mb-10">
    <div class="flex items-center justify-between mb-1">
      <p class="text-sm font-semibold text-brand-600">Sección {{ seccion.numero }}</p>
      <span class="text-xs text-muted">{{ seccion.cantidadCampos }} campos</span>
    </div>
    <input
      v-if="editable"
      :value="seccion.nombre"
      @input="emit('section-name-change', seccion.id, ($event.target as HTMLInputElement).value)"
      type="text"
      placeholder="Nombre de la sección..."
      class="text-xl font-bold text-heading w-full bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-brand-500 focus:outline-none px-1 py-0.5 -ml-1 rounded"
    />
    <h2 v-else class="text-xl font-bold text-heading mb-6">{{ seccion.nombre }}</h2>

    <div v-if="editable" class="flex items-center gap-1.5 mb-6 mt-1 -ml-1">
      <span class="text-[10px] font-semibold uppercase tracking-widest text-muted">Hoja de Excel</span>
      <input
        :value="seccion.hoja || ''"
        @input="emit('section-hoja-change', seccion.id, ($event.target as HTMLInputElement).value)"
        type="text"
        placeholder="Ej. DATOS GENERALES"
        class="text-xs font-mono text-heading bg-transparent border-b border-transparent hover:border-gray-200 focus:border-brand-500 focus:outline-none px-1 py-0.5 rounded"
      />
    </div>

    <div v-for="sub in seccion.subsecciones" :key="sub.id" class="mb-8">
      <div class="flex items-center gap-3 mb-4 border-b border-gray-100 pb-2 group">
        <span class="text-[9px] font-bold text-gray-400 opacity-90">{{ sub.codigo }}</span>
        <input
          v-if="editable"
          :value="sub.nombre"
          @input="emit('subsection-name-change', sub.id, ($event.target as HTMLInputElement).value)"
          type="text"
          placeholder="Nombre de la subsección..."
          class="text-sm font-semibold uppercase tracking-wide text-heading bg-transparent border-b border-transparent hover:border-gray-200 focus:border-brand-500 focus:outline-none px-1 py-0.5 flex-1"
        />
        <span v-else class="text-sm font-semibold uppercase tracking-wide text-heading flex-1">{{ sub.nombre }}</span>
        <button
          @click="ayudaAbiertaId = sub.id"
          type="button"
          :title="editable ? 'Editar ayuda para llenar esta subsección' : 'Ver ayuda para llenar esta subsección'"
          class="w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0"
          :class="sub.ayuda?.trim() ? 'text-brand-500 hover:text-brand-700 hover:bg-brand-50' : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-brand-500 hover:bg-brand-50'"
        >
          <FontAwesomeIcon :icon="faCircleQuestion" class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="editable && seccion.subsecciones.length > 1"
          @click="emit('delete-subsection', sub.id, seccion.id)"
          type="button"
          class="w-6 h-6 rounded flex items-center justify-center text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
          title="Eliminar subsección"
        >
          <FontAwesomeIcon :icon="faTrash" class="w-3 h-3" />
        </button>
      </div>
      <div class="space-y-3">
        <template v-for="campo in sub.campos" :key="campo.id">
        <FieldCard
          :campo="campo"
          :hoja="seccion.hoja"
          :show-example-value="showExampleValues"
          :example-value="exampleValores?.[campo.identificador]"
          :is-selected="selectedCampoId === campo.id"
          :clickable="editable"
          :deletable="editable"
          :editable-default="editable && !showExampleValues"
          :editable-example="showExampleValues && (editable || valuesEditable)"
          :duplicable="editable && !showExampleValues"
          :highlight-warning="highlightMissingCaptura"
          :error="erroresValidacion?.[campo.identificador]"
          :referencia-valor="referenciaValores?.[campo.identificador]"
          :permite-mejora-i-a="permiteMejoraIA"
          :estado-i-a="estadosIA?.[campo.identificador] ?? null"
          :modo-edicion="modoEdicion"
          :valor-borrador="borradoresPorCampo?.[campo.id]"
          @click="emit('select-campo', campo)"
          @delete="emit('delete-campo', campo.id, sub.id)"
          @duplicate="emit('duplicate-campo', campo.id, sub.id)"
          @update-default-value="emit('update-default-value', campo.id, $event)"
          @update-example-value="emit('update-example-value', campo.id, campo.identificador, $event)"
          @update-config-tabla="emit('update-config-tabla', campo.id, $event)"
          @confirmar-ia="emit('confirmar-ia', campo.identificador)"
          @confirmar-borrador="emit('confirmar-borrador', campo.id, campo.identificador)"
        />
        <!-- Mismos botones que los del final de la subsección, pero pegados al campo seleccionado:
             lo nuevo entra justo detrás de él, no al final. -->
        <div v-if="editable && selectedCampoId === campo.id" class="flex gap-2">
          <button
            @click="emit('add-campo', sub.id, sub.codigo, campo.id)"
            type="button"
            class="flex-1 py-2.5 rounded-lg border-2 border-dashed border-brand-200 text-sm font-medium text-brand-600 hover:border-brand-400 hover:bg-brand-50/50 transition-colors flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon :icon="faPlus" class="w-3 h-3" />
            Agregar campo aquí
          </button>
          <button
            @click="emit('add-nota', sub.id, campo.id)"
            type="button"
            title="Agregar nota aquí"
            class="px-4 py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-amber-300 hover:text-amber-600 transition-colors flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon :icon="faNoteSticky" class="w-3 h-3" />
            Nota
          </button>
        </div>
        </template>
        <div class="flex gap-2">
          <button
            v-if="editable && !showExampleValues"
            @click="emit('add-campo', sub.id, sub.codigo)"
            type="button"
            class="flex-1 py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-brand-300 hover:text-brand-600 transition-colors flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon :icon="faPlus" class="w-3 h-3" />
            Agregar campo
          </button>
          <button
            v-if="editable && !showExampleValues"
            @click="emit('add-nota', sub.id)"
            type="button"
            title="Agregar nota"
            class="px-4 py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-amber-300 hover:text-amber-600 transition-colors flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon :icon="faNoteSticky" class="w-3 h-3" />
            Nota
          </button>
        </div>
      </div>
    </div>
    <button
      v-if="editable && !showExampleValues"
      @click="emit('add-subsection', seccion.id)"
      type="button"
      class="w-full py-2 rounded-lg border border-dashed border-gray-200 text-xs font-medium text-gray-400 hover:border-brand-300 hover:text-brand-600 transition-colors flex items-center justify-center gap-1.5"
    >
      <FontAwesomeIcon :icon="faPlus" class="w-2.5 h-2.5" />
      Agregar subsección
    </button>

    <AyudaSubseccionModal
      v-if="subseccionAyuda"
      :is-open="true"
      :subseccion="subseccionAyuda"
      :editable="editable"
      @close="ayudaAbiertaId = null"
      @save="emit('subseccion-ayuda-change', subseccionAyuda.id, $event)"
    />
  </div>
</template>
