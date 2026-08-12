<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faWandMagicSparkles, faBook, faFileLines, faCode } from '@/lib/icons';

export type PilarContextosIA = 'prompt' | 'contexto' | 'guias' | 'json';

defineProps<{ activo: PilarContextosIA }>();
const emit = defineEmits<{ select: [PilarContextosIA] }>();

const pilares = [
  {
    id: 'prompt' as const,
    n: 1,
    titulo: 'Prompt del sistema',
    desc: 'Instrucciones maestras que definen el comportamiento de la IA.',
    icon: faWandMagicSparkles,
  },
  {
    id: 'contexto' as const,
    n: 2,
    titulo: 'Contexto general',
    desc: 'Información global del formato, conceptos, alcance y metodología.',
    icon: faBook,
  },
  {
    id: 'guias' as const,
    n: 3,
    titulo: 'Guías por sección',
    desc: 'Guías de llenado campo a campo para cada sección.',
    icon: faFileLines,
  },
  {
    id: 'json' as const,
    n: 4,
    titulo: 'Estructura JSON',
    desc: 'Esquema oficial de la ficha (estructura y campos).',
    icon: faCode,
  },
];
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
    <button
      v-for="p in pilares"
      :key="p.id"
      type="button"
      class="text-left rounded-xl border px-4 py-3 transition-colors"
      :class="activo === p.id
        ? 'border-violet-500 bg-violet-50 shadow-[0_0_0_1px_rgba(139,92,246,0.25)]'
        : 'border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/40'"
      @click="emit('select', p.id)"
    >
      <div class="flex items-start gap-3">
        <span
          class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          :class="activo === p.id ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-700'"
        >
          <FontAwesomeIcon :icon="p.icon" class="w-4 h-4" />
        </span>
        <div class="min-w-0">
          <div class="text-sm font-bold text-heading">{{ p.n }}. {{ p.titulo }}</div>
          <p class="text-[11px] text-muted mt-0.5 leading-snug line-clamp-2">{{ p.desc }}</p>
        </div>
      </div>
    </button>
  </div>
</template>
