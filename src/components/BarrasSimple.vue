<script setup lang="ts">
import { computed, ref } from 'vue';

// Gráfico de barras de UNA sola serie, en SVG (el proyecto no tiene librería de charts y tampoco
// hace falta). Decisiones deliberadas: sin leyenda (el título de la tarjeta ya nombra la serie),
// sin número sobre cada barra (satura), grilla tenue que no compite con los datos, y las puntas
// redondeadas solo arriba — la base queda apoyada en el eje.
const props = withDefaults(
  defineProps<{
    puntos: { clave: string; etiqueta: string; valor: number }[];
    /** Barra destacada (el periodo seleccionado) — se pinta en un verde más oscuro. */
    claveActiva?: string;
    /** Cómo se muestra el valor en el tooltip y en el eje. */
    formato?: (v: number) => string;
    alto?: number;
    /**
     * Ancho del viewBox. El SVG escala por proporción (no lleva alto en píxeles), así que esto
     * define la relación de aspecto Y el tamaño relativo del texto: en una columna angosta hay que
     * bajarlo, o las etiquetas se renderizan diminutas.
     */
    ancho?: number;
  }>(),
  { alto: 220, ancho: 900, formato: (v: number) => String(v) },
);

const emit = defineEmits<{ seleccionar: [clave: string] }>();

const ANCHO = computed(() => props.ancho);
const PAD_IZQ = 48;
const PAD_ABAJO = 26;
const PAD_ARRIBA = 8;
const RADIO = 4;
const HUECO = 2; // separación mínima entre barras contiguas

const hover = ref<number | null>(null);

const maximo = computed(() => Math.max(...props.puntos.map((p) => p.valor), 1));

// Escala con paso "redondo" (1, 2, 5 × potencia de 10) para que las 4 divisiones del eje caigan
// siempre en números enteros legibles. Dividir el máximo entre 4 a secas producía etiquetas como
// "1.25" o "3.75" en gráficos de conteos, que no significan nada cuando cuentas consultas.
const paso = computed(() => {
  const magnitud = Math.pow(10, Math.floor(Math.log10(Math.max(maximo.value / 4, 1))));
  // Se elige el paso MÁS CHICO cuyo tope (paso × 4) alcance el máximo, para que la barra más alta
  // llegue cerca del techo del gráfico en vez de quedarse a media altura.
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (factor * magnitud * 4 >= maximo.value) return factor * magnitud;
  }
  return 10 * magnitud;
});

const tope = computed(() => paso.value * 4);

const lineas = computed(() => [0, 1, 2, 3, 4].map((i) => ({ f: i / 4, valor: paso.value * i })));

const anchoBanda = computed(() => (ANCHO.value - PAD_IZQ) / Math.max(props.puntos.length, 1));
const anchoBarra = computed(() => Math.max(anchoBanda.value * 0.55 - HUECO, 4));
const altoPlot = computed(() => props.alto - PAD_ABAJO - PAD_ARRIBA);

function x(i: number): number {
  return PAD_IZQ + i * anchoBanda.value + (anchoBanda.value - anchoBarra.value) / 2;
}

function altoDe(valor: number): number {
  return tope.value === 0 ? 0 : (valor / tope.value) * altoPlot.value;
}

function y(valor: number): number {
  return PAD_ARRIBA + altoPlot.value - altoDe(valor);
}

/** Rectángulo con las dos esquinas superiores redondeadas y la base recta. */
function barra(i: number, valor: number): string {
  const alto = altoDe(valor);
  const px = x(i);
  const py = y(valor);
  const w = anchoBarra.value;
  if (alto <= 0) return '';
  const r = Math.min(RADIO, alto, w / 2);
  return `M ${px} ${py + alto} L ${px} ${py + r} Q ${px} ${py} ${px + r} ${py} L ${px + w - r} ${py} Q ${px + w} ${py} ${px + w} ${py + r} L ${px + w} ${py + alto} Z`;
}
</script>

<template>
  <div class="relative">
    <svg :viewBox="`0 0 ${ANCHO} ${alto}`" class="w-full h-auto block" role="img">
      <!-- Grilla y eje: gris muy claro, deliberadamente por detrás de los datos -->
      <g>
        <line
          v-for="l in lineas"
          :key="l.f"
          :x1="PAD_IZQ"
          :x2="ANCHO"
          :y1="PAD_ARRIBA + altoPlot - altoPlot * l.f"
          :y2="PAD_ARRIBA + altoPlot - altoPlot * l.f"
          stroke="#e2e8f0"
          stroke-width="1"
          :stroke-dasharray="l.f === 0 ? '0' : '3 3'"
        />
        <text
          v-for="l in lineas"
          :key="`t-${l.f}`"
          :x="PAD_IZQ - 8"
          :y="PAD_ARRIBA + altoPlot - altoPlot * l.f + 4"
          text-anchor="end"
          class="fill-gray-400"
          style="font-size: 11px"
        >
          {{ formato(l.valor) }}
        </text>
      </g>

      <g v-for="(p, i) in puntos" :key="p.clave">
        <!-- Zona de hover más ancha que la barra, para que apuntar sea fácil -->
        <rect
          :x="PAD_IZQ + i * anchoBanda"
          :y="PAD_ARRIBA"
          :width="anchoBanda"
          :height="altoPlot"
          fill="transparent"
          class="cursor-pointer"
          @mouseenter="hover = i"
          @mouseleave="hover = null"
          @click="emit('seleccionar', p.clave)"
        />
        <path
          :d="barra(i, p.valor)"
          :class="p.clave === claveActiva ? 'fill-brand-700' : 'fill-brand-500'"
          :opacity="hover === null || hover === i ? 1 : 0.55"
          class="pointer-events-none transition-opacity duration-75"
        />
        <text
          :x="PAD_IZQ + i * anchoBanda + anchoBanda / 2"
          :y="alto - 8"
          text-anchor="middle"
          :class="p.clave === claveActiva ? 'fill-heading font-semibold' : 'fill-gray-400'"
          style="font-size: 11px"
          class="pointer-events-none"
        >
          {{ p.etiqueta }}
        </text>
      </g>
    </svg>

    <div
      v-if="hover !== null"
      class="absolute -translate-x-1/2 -translate-y-full pointer-events-none rounded-lg bg-heading text-white text-xs px-2.5 py-1.5 shadow-modal whitespace-nowrap"
      :style="{ left: `${((PAD_IZQ + hover * anchoBanda + anchoBanda / 2) / ANCHO) * 100}%`, top: `${(y(puntos[hover].valor) / alto) * 100}%` }"
    >
      <span class="font-semibold">{{ puntos[hover].etiqueta }}</span>
      · {{ formato(puntos[hover].valor) }}
    </div>
  </div>
</template>
