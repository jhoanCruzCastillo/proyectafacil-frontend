<script setup lang="ts">
import { ref, computed } from 'vue';
import PageShell from '@/components/PageShell.vue';
import MisFichasLista from './MisFichasLista.vue';
import CatalogoFichas from './CatalogoFichas.vue';
import { instrumentoIcons, instrumentoLabels, instrumentoLabelsPlural } from '@/lib/icons';
import type { TipoInstrumento } from '@/types';

// Página genérica por tipo de instrumento (Formatos/Fichas técnicas/IOARR/Perfiles) — pedido del
// cliente: partir las antiguas "Mis fichas"/"Fichas oficiales" (mezclaban los 4 tipos) en una
// página por tipo, cada una con el mismo patrón "lo mío" vs "catálogo para elegir más". Un solo
// componente parametrizado por `tipo` en vez de 4 páginas casi idénticas — ver router/index.ts.
const props = defineProps<{ tipo: TipoInstrumento }>();

const vista = ref<'mis' | 'mas'>('mis');

// Concordancia de género (ficha técnica es femenino, el resto masculino) — solo para la redacción
// de la descripción, no amerita meterlo en icons.ts junto a los labels.
const ARTICULO_PLURAL: Record<TipoInstrumento, string> = { formato: 'Los', ficha_tecnica: 'Las', ioarr: 'Los', perfil: 'Los' };
const ARTICULO_SINGULAR: Record<TipoInstrumento, string> = { formato: 'un', ficha_tecnica: 'una', ioarr: 'un', perfil: 'un' };

const tituloPlural = computed(() => instrumentoLabelsPlural[props.tipo]);
const tituloSingular = computed(() => instrumentoLabels[props.tipo]);
const descripcion = computed(() => (
  vista.value === 'mis'
    ? `${ARTICULO_PLURAL[props.tipo]} ${tituloPlural.value.toLowerCase()} que ya has trabajado`
    : `Elige ${ARTICULO_SINGULAR[props.tipo]} ${tituloSingular.value.toLowerCase()} oficial para crear tu propio caso`
));
</script>

<template>
  <PageShell :icon="instrumentoIcons[tipo]" :title="tituloPlural" :description="descripcion">
    <div class="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
      <button
        @click="vista = 'mis'"
        type="button"
        class="px-4 py-2 text-sm font-medium rounded-md transition-colors duration-75"
        :class="vista === 'mis' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
      >
        Mis {{ tituloPlural }}
      </button>
      <button
        @click="vista = 'mas'"
        type="button"
        class="px-4 py-2 text-sm font-medium rounded-md transition-colors duration-75"
        :class="vista === 'mas' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
      >
        Más {{ tituloPlural }}
      </button>
    </div>

    <MisFichasLista v-if="vista === 'mis'" :tipo="tipo" @ver-mas="vista = 'mas'" />
    <CatalogoFichas v-else :tipo="tipo" />
  </PageShell>
</template>
