<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faWandMagicSparkles, faBook, faFileLines, faCode, faEye, faListCheck } from '@/lib/icons';

export type PilarContextosIA = 'prompt' | 'contexto' | 'guias' | 'globales' | 'json' | 'preview';

// `soloIds`: qué tarjetas mostrar — el panel padre ahora agrupa los pilares por a qué prompt
// alimentan (ver ContextosIAPanel.vue: grupo "sistema" = prompt/contexto/guias/globales, grupo
// "usuario" = json), así que este nav ya no muestra los 6 siempre juntos.
const props = defineProps<{ activo: PilarContextosIA; soloIds: PilarContextosIA[] }>();
const emit = defineEmits<{ select: [PilarContextosIA] }>();

// Chip de alcance: a qué llega el contenido de este pilar si lo editas. Cuatro niveles reales, de
// más angosto a más ancho — cada uno con su propio color para que no se confundan entre sí (el "1.
// Prompt del sistema" y el "4. Reglas globales" se ven parecidos en rojo por su impacto, pero su
// ALCANCE real es distinto: uno es "igual en toda ficha nueva", el otro literalmente se comparte
// entre fichas de sectores distintos ahora mismo).
const ALCANCE = {
  universal: { texto: 'Universal', clase: 'bg-indigo-100 text-indigo-700' },
  ficha: { texto: 'Esta ficha', clase: 'bg-slate-100 text-slate-600' },
  seccion: { texto: 'Esta sección', clase: 'bg-teal-100 text-teal-700' },
  global: { texto: 'Global', clase: 'bg-amber-100 text-amber-800' },
} as const;

// Orden REAL en que construirSistema()/construirSistemaTabla() pegan cada pieza (verificado en
// vivo, 2026-08-30 — antes "Prompt del sistema" ni siquiera tenía paso propio, quedaba mezclado
// dentro de "Contexto general de esta ficha" en el orden que le tocara por BD). El número de la
// tarjeta (1-4) es solo un índice de navegación — el "Paso" de abajo es la posición real dentro del
// texto final que recibe la IA.
const PASO = {
  rol: 'Paso 1',
  prompt: 'Paso 2',
  contrato: 'Paso 3 (fijo en código, sin tarjeta)',
  reglas: 'Paso 4',
  contexto: 'Paso 5',
  fuente: 'Paso 6 (no es Contextos IA)',
  guia: 'Paso 7 (bloque variable)',
  globalAsociado: 'Paso 8 (bloque variable, si está asociada a la sección)',
} as const;

const pilares = [
  {
    id: 'prompt' as const,
    n: 1,
    titulo: 'Prompt del sistema',
    desc: `${PASO.prompt} — justo después del rol: define CÓMO debe comportarse la IA en general, para cualquier ficha.`,
    icon: faWandMagicSparkles,
    // Impacto amplio: afecta CUALQUIER sección/tabla de esta ficha en cada llenado — se resalta en
    // rojo para que el admin note que un cambio acá no es local a una sola sección.
    critico: true,
    // Se guarda por ficha (cada una tiene su propia fila), pero por diseño debe quedar igual en
    // cualquier ficha de cualquier sector — ver el chip "Universal" en vez de "Esta ficha".
    alcance: ALCANCE.universal,
  },
  {
    id: 'contexto' as const,
    n: 2,
    titulo: 'Contexto general',
    desc: `${PASO.contexto} — después del rol, el prompt del sistema y las reglas: le da a la IA el contexto conceptual de ESTA ficha (de qué trata, terminología, alcance).`,
    icon: faBook,
    critico: true,
    alcance: ALCANCE.ficha,
  },
  {
    id: 'guias' as const,
    n: 3,
    titulo: 'Guías por sección',
    desc: `${PASO.guia} — instrucciones puntuales SOLO para la sección que se está llenando en este momento.`,
    icon: faFileLines,
    // Confirmado con una corrida real: contextoDeSeccion() la incluye en el prompt de sistema
    // (bloque variable) de CADA llamada a la IA para esa sección — no es solo documentación.
    critico: true,
    alcance: ALCANCE.seccion,
  },
  {
    id: 'globales' as const,
    n: 4,
    titulo: 'Reglas globales',
    desc: `Pasos 1, 4 y 8 — el rol (1) y las reglas de llenado (4) van siempre. El resto de reglas globales cuenta como paso 8, solo si el admin las asoció a la sección que se está llenando.`,
    icon: faListCheck,
    // Este además puede afectar OTRAS fichas de OTROS sectores, no solo esta.
    critico: true,
    alcance: ALCANCE.global,
  },
  {
    id: 'json' as const,
    n: 5,
    titulo: 'Estructura JSON',
    desc: 'No alimenta el prompt de sistema — genera cada línea de "Campos disponibles" del prompt de usuario.',
    icon: faCode,
    critico: false,
    alcance: ALCANCE.ficha,
  },
  {
    id: 'preview' as const,
    n: 6,
    titulo: 'Vista previa del prompt',
    desc: 'El prompt exacto que se le manda a la IA, ya armado — solo lectura, sin costo.',
    icon: faEye,
    critico: false,
    alcance: null,
  },
];

const pilaresFiltrados = computed(() => pilares.filter((p) => props.soloIds.includes(p.id)));
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
    <button
      v-for="p in pilaresFiltrados"
      :key="p.id"
      type="button"
      class="relative text-left rounded-xl border px-4 py-3 transition-colors"
      :class="[
        activo === p.id
          ? (p.critico ? 'border-red-500 bg-red-50 shadow-[0_0_0_1px_rgba(239,68,68,0.25)]' : 'border-violet-500 bg-violet-50 shadow-[0_0_0_1px_rgba(139,92,246,0.25)]')
          : (p.critico ? 'border-red-200 bg-red-50/50 hover:border-red-400 hover:bg-red-50' : 'border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/40'),
      ]"
      @click="emit('select', p.id)"
    >
      <span
        v-if="p.alcance"
        class="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
        :class="p.alcance.clase"
      >
        {{ p.alcance.texto }}
      </span>
      <div class="flex items-start gap-3 pr-2">
        <span
          class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          :class="activo === p.id
            ? (p.critico ? 'bg-red-600 text-white' : 'bg-violet-600 text-white')
            : (p.critico ? 'bg-red-100 text-red-700' : 'bg-violet-100 text-violet-700')"
        >
          <FontAwesomeIcon :icon="p.icon" class="w-4 h-4" />
        </span>
        <div class="min-w-0">
          <div class="text-sm font-bold text-heading pr-12">{{ p.n }}. {{ p.titulo }}</div>
          <p class="text-[11px] text-muted mt-0.5 leading-snug line-clamp-2">{{ p.desc }}</p>
        </div>
      </div>
    </button>
  </div>
</template>
