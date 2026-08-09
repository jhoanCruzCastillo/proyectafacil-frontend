<script setup lang="ts">
import { inject } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faGear, fieldTypeIcons } from '@/lib/icons';
import CampoListaInput from '@/components/CampoListaInput.vue';
import { EXCEL_VIVO } from '@/composables/useListasExcel';
import { etiquetaDeValor } from '@/lib/conversionesExcel';
import { valorSubcolumna, type ValorCelda } from '@/lib/tableRowHelpers';
import type { ColumnaTabla, SubcolumnaTabla } from '@/types';

// Una columna partida (convención 4.8) dibujada como una celda por parte.
//
// Cada subcolumna declara SU PROPIA letra de Excel (en la columna "%" del formato 6A, la parte
// izquierda es J y la derecha K), así que cada parte es una celda del archivo como cualquier otra y
// recibe el mismo trato: si el Excel la calcula, se muestra el resultado en vivo; si tiene
// desplegable, se ofrecen sus opciones; si no, se escribe libre. Antes las partes se renderizaban
// siempre como texto libre, y por eso los porcentajes de la columna "%" salían en blanco aunque el
// motor ya sabía calcularlos.
const props = defineProps<{
  col: ColumnaTabla;
  /** Valor de la celda completa — objeto {subId: texto} cuando la fila está partida */
  valor: ValorCelda | undefined;
  /** Hoja de Excel de la sección */
  hoja?: string;
  /** Fila de Excel que ocupa esta fila de la tabla */
  filaExcel?: number;
}>();

const emit = defineEmits<{
  'subcelda-change': [subId: string, value: string];
  'toggle-partida': [];
}>();

const excel = inject(EXCEL_VIVO, undefined);

/** Celda de Excel de una parte, o null si no se puede ubicar */
function refDe(sub: SubcolumnaTabla): string | null {
  if (!excel?.value || !props.hoja || !props.filaExcel || !sub.columnaExcel) return null;
  return `${sub.columnaExcel}${props.filaExcel}`;
}

function calculo(sub: SubcolumnaTabla) {
  const ref = refDe(sub);
  return ref && props.hoja ? (excel?.value?.calculado(props.hoja, ref) ?? null) : null;
}

function opciones(sub: SubcolumnaTabla): string[] | null {
  const ref = refDe(sub);
  if (!ref || !props.hoja) return null;
  const ops = excel?.value?.opcionesDe(props.hoja, ref);
  return ops && ops.length > 0 ? ops : null;
}

function texto(sub: SubcolumnaTabla): string {
  return valorSubcolumna(props.valor, sub.id);
}

function mostrado(sub: SubcolumnaTabla, ops: string[] | null): string {
  return etiquetaDeValor(texto(sub), ops, props.col.etiquetasBooleano);
}
</script>

<template>
  <td
    v-for="(sub, si) in col.subcolumnas"
    :key="`${col.id}-${sub.id}`"
    class="px-1 py-0.5 align-top group/celda relative"
    :class="calculo(sub) ? 'bg-sky-50/50' : ''"
  >
    <div class="flex items-start gap-0.5">
      <!-- Parte que calcula el Excel -->
      <div v-if="calculo(sub)" class="flex items-start gap-1 px-1 py-1 flex-1 min-w-0">
        <FontAwesomeIcon
          :icon="fieldTypeIcons.calculado"
          class="w-2.5 h-2.5 text-sky-500 shrink-0 mt-0.5"
          title="Lo calcula el Excel"
        />
        <span v-if="!calculo(sub)!.soportado" class="text-[11px] text-sky-800/60 italic">Lo calcula el Excel</span>
        <span v-else-if="calculo(sub)!.error" class="text-[11px] text-amber-700 font-mono">{{ calculo(sub)!.error }}</span>
        <span v-else-if="calculo(sub)!.texto" class="text-xs text-heading break-words">{{ calculo(sub)!.texto }}</span>
        <span v-else class="text-[11px] text-muted">—</span>
      </div>
      <!-- Parte con desplegable declarado en el Excel -->
      <div v-else-if="opciones(sub)" class="flex-1 min-w-0">
        <CampoListaInput
          :value="mostrado(sub, opciones(sub))"
          :opciones="opciones(sub) ?? []"
          compacto
          @change="emit('subcelda-change', sub.id, $event)"
          @click.stop
        />
      </div>
      <textarea
        v-else
        :value="texto(sub)"
        @input="emit('subcelda-change', sub.id, ($event.target as HTMLTextAreaElement).value)"
        @click.stop
        rows="1"
        :placeholder="sub.nombre || '—'"
        :title="sub.nombre"
        class="block w-full px-1.5 py-1 rounded border border-transparent hover:border-gray-200 focus:border-brand-300 text-xs text-heading focus:outline-none focus:ring-1 focus:ring-brand-500/30 bg-transparent resize-none overflow-y-auto max-h-[15lh] [field-sizing:content]"
      />
      <!-- El engranaje vive en la primera parte y NO depende de cómo se dibuje la celda: es la única
           salida para volver a fusionar la fila, y sin él una fila partida cuya primera parte la
           calcula el Excel quedaría atrapada. -->
      <button
        v-if="si === 0"
        @click.stop="emit('toggle-partida')"
        type="button"
        title="Fusionar en una sola celda"
        class="w-5 h-5 rounded flex items-center justify-center text-gray-300 opacity-0 group-hover/celda:opacity-100 hover:text-brand-600 transition-opacity shrink-0 mt-0.5"
      >
        <FontAwesomeIcon :icon="faGear" class="w-2.5 h-2.5" />
      </button>
    </div>
  </td>
</template>
