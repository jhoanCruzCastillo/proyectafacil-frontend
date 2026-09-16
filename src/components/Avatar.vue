<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const AVATAR_DEFAULT = '/user_none.jpg';

const props = withDefaults(
  defineProps<{
    nombre: string;
    fotoUrl?: string | null;
    /** Tailwind size classes para el círculo, ej. 'w-8 h-8' */
    size?: string;
    /** Conservado por compatibilidad: ya no cambia el fallback (antes evitaba Pravatar). */
    sinFotoIlustrada?: boolean;
  }>(),
  { size: 'w-9 h-9' },
);

const errorAlCargar = ref(false);
watch(() => props.fotoUrl, () => { errorAlCargar.value = false; });

const tieneFotoReal = computed(() => {
  const url = props.fotoUrl?.trim();
  if (!url) return false;
  return !url.includes('dicebear.com') && !url.includes('pravatar.cc');
});

const fotoMostrada = computed(() => (
  tieneFotoReal.value && !errorAlCargar.value ? props.fotoUrl! : AVATAR_DEFAULT
));

function onError() {
  if (fotoMostrada.value === AVATAR_DEFAULT) return;
  errorAlCargar.value = true;
}
</script>

<template>
  <img
    :src="fotoMostrada"
    :alt="nombre"
    :title="nombre"
    :class="[
      size,
      'rounded-full shrink-0 bg-white',
      tieneFotoReal && !errorAlCargar ? 'object-cover' : 'object-contain p-0.5',
    ]"
    @error="onError"
  />
</template>
