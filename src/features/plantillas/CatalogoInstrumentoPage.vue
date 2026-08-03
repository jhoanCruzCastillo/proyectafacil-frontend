<script setup lang="ts">
import { computed } from 'vue';
import PageShell from '@/components/PageShell.vue';
import PlantillasAgrupadas from './PlantillasAgrupadas.vue';
import { instrumentoIcons, instrumentoLabelsPlural } from '@/lib/icons';
import { usePlantillasQuery } from '@/composables/usePlantillas';
import { useSectoresQuery } from '@/composables/useSectores';
import type { TipoInstrumento } from '@/types';

// Catálogo transversal de un instrumento: TODAS sus plantillas, de todos los sectores, agrupadas
// por sector. Complementa a /sectores/:id, que muestra un solo sector a la vez — acá el eje es el
// instrumento, no el sector.
const props = defineProps<{ instrumento: TipoInstrumento }>();

const { data: plantillas, isLoading: cargandoPlantillas } = usePlantillasQuery();
const { data: sectores, isLoading: cargandoSectores } = useSectoresQuery();

const cargando = computed(() => cargandoPlantillas.value || cargandoSectores.value);
const titulo = computed(() => instrumentoLabelsPlural[props.instrumento]);
const cantidad = computed(() => (plantillas.value ?? []).filter((p) => p.instrumento === props.instrumento).length);

const DESCRIPCION: Record<TipoInstrumento, string> = {
  formato: 'Todos los formatos del sistema, agrupados por sector.',
  ioarr: 'Todas las plantillas IOARR del sistema, agrupadas por sector.',
  ficha_tecnica: 'Todas las fichas técnicas del sistema, agrupadas por sector.',
  perfil: 'Todos los perfiles del sistema, agrupados por sector.',
};
</script>

<template>
  <PageShell
    :icon="instrumentoIcons[instrumento]"
    :title="titulo"
    :description="DESCRIPCION[instrumento]"
    content-class=""
    compact
  >
    <template #actions>
      <span class="px-4 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm font-medium text-white/80">
        {{ cantidad }} en total
      </span>
    </template>

    <p v-if="cargando" class="text-sm text-muted p-8 text-center">Cargando…</p>
    <!-- `key` por instrumento: las 4 rutas comparten este componente, así que sin esto Vue reusa
         la instancia y el buscador/filtro de la sección anterior se arrastran a la siguiente —
         se llega a "Formatos" con un texto tecleado en "Fichas técnicas" y parece que está vacío. -->
    <PlantillasAgrupadas
      v-else
      :key="instrumento"
      :plantillas="plantillas ?? []"
      :sectores="sectores ?? []"
      :instrumento="instrumento"
    />
  </PageShell>
</template>
