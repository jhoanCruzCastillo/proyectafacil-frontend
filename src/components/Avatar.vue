<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    nombre: string;
    fotoUrl?: string | null;
    /** Tailwind size classes para el círculo, ej. 'w-8 h-8' */
    size?: string;
    /** true = nunca completar con el placeholder de Pravatar (foto de una persona cualquiera)
     * cuando no hay fotoUrl real — va directo a iniciales. Para casos donde una "foto" sería
     * engañosa (parece la foto real de alguien cuando no lo es) — ej. un participante de Meet no
     * registrado en la plataforma, del que ni siquiera sabemos si es alumno o docente. */
    sinFotoIlustrada?: boolean;
  }>(),
  { size: 'w-9 h-9' },
);

const errorAlCargar = ref(false);
watch(() => props.fotoUrl, () => { errorAlCargar.value = false; });

// Decisión de frontend, sin tocar la BD: los `foto_url` sembrados (AsesoriasDemoSeeder) son
// avatares ilustrados de DiceBear — para que la demo se vea más profesional se muestran fotos de
// personas en su lugar (Pravatar, gratis, sin API key). Estable por nombre vía el parámetro `u`
// (mismo nombre → misma foto siempre). Si algún día hay una foto real subida por el usuario (no
// DiceBear), esa se respeta tal cual.
const esAvatarIlustrado = computed(() => !props.fotoUrl || props.fotoUrl.includes('dicebear.com'));

// Sin fotoUrl real y con sinFotoIlustrada, ni siquiera se intenta cargar el placeholder — directo a
// iniciales (ver template). Con fotoUrl real (o sin el flag), sigue el comportamiento de siempre.
const mostrarImagen = computed(() => !errorAlCargar.value && (!!props.fotoUrl || !props.sinFotoIlustrada));

const fotoMostrada = computed(() => (
  esAvatarIlustrado.value
    ? `https://i.pravatar.cc/300?u=${encodeURIComponent(props.nombre)}`
    : props.fotoUrl!
));

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
    v-if="mostrarImagen"
    :src="fotoMostrada"
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
