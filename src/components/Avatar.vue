<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    nombre: string;
    fotoUrl?: string | null;
    /** Tailwind size classes para el círculo, ej. 'w-8 h-8' */
    size?: string;
  }>(),
  { size: 'w-9 h-9' },
);

const errorAlCargar = ref(false);
watch(() => props.fotoUrl, () => { errorAlCargar.value = false; });

const iniciales = computed(() => {
  const partes = props.nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primera = partes[0][0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : '';
  return (primera + ultima).toUpperCase();
});

const colorFondo = computed(() => {
  const paleta = ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-amber-100 text-amber-700', 'bg-purple-100 text-purple-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700'];
  let hash = 0;
  for (let i = 0; i < props.nombre.length; i++) hash = props.nombre.charCodeAt(i) + ((hash << 5) - hash);
  return paleta[Math.abs(hash) % paleta.length];
});
</script>

<template>
  <img
    v-if="fotoUrl && !errorAlCargar"
    :src="fotoUrl"
    :alt="nombre"
    :class="[size, 'rounded-full object-cover shrink-0 bg-gray-100']"
    @error="errorAlCargar = true"
  />
  <div
    v-else
    :class="[size, colorFondo, 'rounded-full shrink-0 flex items-center justify-center font-semibold text-xs']"
    :title="nombre"
  >
    {{ iniciales }}
  </div>
</template>
