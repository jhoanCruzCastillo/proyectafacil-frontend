<script setup lang="ts">
/**
 * Booleano en UI:
 * - `si_no`: par Sí/No (pregunta con dos opciones), como el plan operativo.
 * - `casilla`: un solo círculo (OptionButton/checkbox del Excel), p. ej. Rutinario/Periódico/Correctivo.
 *
 * Con etiquetas, el valor guardado es el texto del Excel ("Sí"/"No"). Sin etiquetas en casilla,
 * marcado = "Sí", vacío = "".
 */
import { computed } from 'vue';
import { textoABooleano, type EtiquetasBooleano } from '@/lib/conversionesExcel';

const props = withDefaults(
  defineProps<{
    value: string;
    etiquetas?: EtiquetasBooleano | null;
    /** si_no = dos botones; casilla = un círculo. Por defecto: si hay etiquetas → si_no, si no → casilla. */
    variante?: 'si_no' | 'casilla' | null;
    editable?: boolean;
    compacto?: boolean;
  }>(),
  {
    etiquetas: null,
    variante: null,
    editable: true,
    compacto: false,
  },
);

const emit = defineEmits<{ change: [value: string] }>();

const modo = computed<'si_no' | 'casilla'>(() => {
  if (props.variante === 'si_no' || props.variante === 'casilla') return props.variante;
  return props.etiquetas?.true && props.etiquetas?.false ? 'si_no' : 'casilla';
});

const labels = computed(() => ({
  true: props.etiquetas?.true?.trim() || 'Sí',
  false: props.etiquetas?.false?.trim() || 'No',
}));

const seleccionado = computed(() => textoABooleano(props.value || '', labels.value));
const marcado = computed(() => seleccionado.value === 'true');

function elegirSiNo(esTrue: boolean) {
  if (!props.editable) return;
  const etiqueta = esTrue ? labels.value.true : labels.value.false;
  if (props.value === etiqueta) return;
  emit('change', etiqueta);
}

function toggleCasilla() {
  if (!props.editable) return;
  if (marcado.value) {
    emit('change', '');
    return;
  }
  emit('change', labels.value.true);
}
</script>

<template>
  <!-- Par Sí / No -->
  <div
    v-if="modo === 'si_no'"
    class="inline-flex items-stretch rounded-lg border overflow-hidden"
    :class="[
      compacto ? 'text-xs' : 'text-sm',
      editable ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-80',
    ]"
    role="radiogroup"
  >
    <button
      type="button"
      role="radio"
      :aria-checked="seleccionado === 'true'"
      :disabled="!editable"
      @click.stop="elegirSiNo(true)"
      class="flex items-center gap-1.5 font-medium transition-colors disabled:cursor-not-allowed"
      :class="[
        compacto ? 'px-2 py-1' : 'px-3 py-1.5',
        seleccionado === 'true'
          ? 'bg-brand-50 text-brand-700'
          : 'text-gray-500 hover:bg-gray-50 hover:text-heading',
      ]"
    >
      <span
        class="rounded-full border flex items-center justify-center shrink-0"
        :class="[
          compacto ? 'w-3 h-3' : 'w-3.5 h-3.5',
          seleccionado === 'true' ? 'border-brand-600' : 'border-gray-300',
        ]"
      >
        <span
          v-if="seleccionado === 'true'"
          class="rounded-full bg-brand-600"
          :class="compacto ? 'w-1.5 h-1.5' : 'w-2 h-2'"
        />
      </span>
      {{ labels.true }}
    </button>
    <button
      type="button"
      role="radio"
      :aria-checked="seleccionado === 'false'"
      :disabled="!editable"
      @click.stop="elegirSiNo(false)"
      class="flex items-center gap-1.5 font-medium border-l border-gray-200 transition-colors disabled:cursor-not-allowed"
      :class="[
        compacto ? 'px-2 py-1' : 'px-3 py-1.5',
        seleccionado === 'false'
          ? 'bg-brand-50 text-brand-700'
          : 'text-gray-500 hover:bg-gray-50 hover:text-heading',
      ]"
    >
      <span
        class="rounded-full border flex items-center justify-center shrink-0"
        :class="[
          compacto ? 'w-3 h-3' : 'w-3.5 h-3.5',
          seleccionado === 'false' ? 'border-brand-600' : 'border-gray-300',
        ]"
      >
        <span
          v-if="seleccionado === 'false'"
          class="rounded-full bg-brand-600"
          :class="compacto ? 'w-1.5 h-1.5' : 'w-2 h-2'"
        />
      </span>
      {{ labels.false }}
    </button>
  </div>

  <!-- Un solo círculo (marcar / OptionButton de grupo) -->
  <button
    v-else
    type="button"
    role="radio"
    :aria-checked="marcado"
    :disabled="!editable"
    title="Marcar"
    @click.stop="toggleCasilla"
    class="inline-flex items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed"
    :class="[
      compacto ? 'w-4 h-4' : 'w-5 h-5',
      marcado ? 'border-brand-600 bg-white' : 'border-gray-300 bg-white hover:border-brand-400',
      !editable ? 'opacity-70' : '',
    ]"
  >
    <span
      v-if="marcado"
      class="rounded-full bg-brand-600"
      :class="compacto ? 'w-2 h-2' : 'w-2.5 h-2.5'"
    />
  </button>
</template>
