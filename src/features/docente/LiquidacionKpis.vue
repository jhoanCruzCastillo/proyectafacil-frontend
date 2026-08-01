<script setup lang="ts">
// Fila de indicadores de la cabecera oscura. Cada pestaña de "Mi Liquidación" pasa los suyos;
// como máximo uno lleva tono de color — el que resume el dinero de esa pestaña.
defineProps<{
  items: { label: string; valor: string | number; tono?: 'neutro' | 'verde' | 'ambar' }[];
}>();

const CAJA = {
  neutro: 'bg-white/[0.06] border-white/10',
  verde: 'bg-brand-500/10 border-brand-500/30',
  ambar: 'bg-amber-400/10 border-amber-400/30',
} as const;

const ETIQUETA = {
  neutro: 'text-white/50',
  verde: 'text-brand-300/80',
  ambar: 'text-amber-200/80',
} as const;

const VALOR = {
  neutro: 'text-white',
  verde: 'text-brand-400',
  ambar: 'text-amber-400',
} as const;
</script>

<template>
  <div
    v-for="item in items"
    :key="item.label"
    class="rounded-xl border p-4 text-center"
    :class="CAJA[item.tono ?? 'neutro']"
  >
    <p class="text-xs" :class="ETIQUETA[item.tono ?? 'neutro']">{{ item.label }}</p>
    <p class="text-2xl font-bold mt-1" :class="VALOR[item.tono ?? 'neutro']">{{ item.valor }}</p>
  </div>
</template>
