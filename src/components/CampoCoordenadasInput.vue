<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faLocationDot, faTriangleExclamation } from '@/lib/icons';
import { parseCoords, serializarCoords, coordsATexto } from '@/lib/coords';
import MapaModal from './MapaModal.vue';

const props = withDefaults(defineProps<{ value: string; editable?: boolean }>(), { editable: true });
const emit = defineEmits<{ change: [value: string] }>();

const open = ref(false);
const coords = ref(parseCoords(props.value));

// Texto del input. Se mantiene aparte del valor guardado porque mientras se escribe pasa por
// estados intermedios que todavía no son un par válido ("-13.5," ) y no deben borrar el mapa.
const texto = ref(coords.value ? coordsATexto(coords.value) : props.value);

watch(() => props.value, (v) => {
  coords.value = parseCoords(v);
  const nuevo = coords.value ? coordsATexto(coords.value) : v;
  // No se pisa lo que el usuario está tecleando si representa la misma coordenada
  if (parseCoords(texto.value)?.lat !== coords.value?.lat || parseCoords(texto.value)?.lng !== coords.value?.lng) {
    texto.value = nuevo;
  }
});

const invalido = computed(() => texto.value.trim() !== '' && parseCoords(texto.value) === null);

// Se emite la forma canónica {lat,lng}; si aún no es un par válido se emite el texto tal cual,
// para no perder lo escrito a medias.
function onTextoInput(v: string) {
  texto.value = v;
  const c = parseCoords(v);
  emit('change', c ? serializarCoords(c) : v);
}

const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;

const MINI_PIN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 30" width="20" height="30">
  <path d="M10 0C4.5 0 0 4.5 0 10c0 7.5 10 20 10 20S20 17.5 20 10C20 4.5 15.5 0 10 0z" fill="#16a34a" stroke="white" stroke-width="2"/>
  <circle cx="10" cy="10" r="4" fill="white"/>
</svg>`;

async function renderMiniMap() {
  map?.remove();
  map = null;
  if (!coords.value) return;
  // El contenedor vive dentro de un `v-if="coords"`, así que en el momento en que este watcher se
  // dispara todavía no existe en el DOM: hay que esperar al repintado ANTES de comprobarlo. Mirarlo
  // primero hacía que el mapa no llegara a montarse nunca al escribir una coordenada.
  await nextTick();
  if (!mapContainer.value) return;
  map = L.map(mapContainer.value, {
    center: [coords.value.lat, coords.value.lng],
    zoom: 13,
    zoomControl: false,
    dragging: false,
    touchZoom: false,
    doubleClickZoom: false,
    scrollWheelZoom: false,
    boxZoom: false,
    keyboard: false,
    attributionControl: false,
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  L.marker([coords.value.lat, coords.value.lng], {
    icon: L.divIcon({ className: '', html: MINI_PIN, iconSize: [20, 30], iconAnchor: [10, 30] }),
  }).addTo(map);
}

watch(coords, renderMiniMap, { immediate: true });

// Al confirmar desde el mapa se actualiza también el input: son dos vistas del mismo dato.
function handleConfirm(c: { lat: number; lng: number }) {
  texto.value = coordsATexto(c);
  emit('change', serializarCoords(c));
}
</script>

<template>
  <div @click.stop class="space-y-2">
    <!-- La coordenada, escribible a mano. Es el dato real del campo; el mapa solo la representa. -->
    <input
      :value="texto"
      @input="onTextoInput(($event.target as HTMLInputElement).value)"
      :readonly="!editable"
      type="text"
      placeholder="Latitud, Longitud — ej. -13.5407619, -71.923069"
      class="w-full px-2 py-1.5 rounded border bg-white text-sm font-mono text-heading focus:outline-none focus:ring-2"
      :class="invalido
        ? 'border-amber-400 focus:ring-amber-300/40 focus:border-amber-400'
        : 'border-brand-200 focus:ring-brand-500/30 focus:border-brand-500'"
    />
    <p v-if="invalido" class="text-[11px] text-amber-700 flex items-center gap-1">
      <FontAwesomeIcon :icon="faTriangleExclamation" class="w-2.5 h-2.5 shrink-0" />
      Formato no reconocido. Se espera latitud y longitud, separadas por coma.
    </p>

    <!-- Mapa: clic para abrirlo ampliado y ajustar el punto -->
    <div
      v-if="coords"
      class="rounded-lg overflow-hidden border border-gray-200 transition-colors"
      :class="editable ? 'cursor-pointer hover:border-brand-400' : ''"
      @click="editable && (open = true)"
      :title="editable ? 'Clic para ampliar el mapa' : undefined"
    >
      <div style="height: 200px; position: relative">
        <div ref="mapContainer" class="w-full h-full" style="pointer-events: none" />
      </div>
      <div class="flex items-center justify-between px-2.5 py-1.5 bg-white border-t border-gray-100">
        <span class="text-[11px] font-mono text-gray-500">{{ coords.lat.toFixed(6) }}, {{ coords.lng.toFixed(6) }}</span>
        <span v-if="editable" class="text-[11px] text-brand-600 font-medium">Ampliar mapa ›</span>
      </div>
    </div>
    <button
      v-else
      @click="editable && (open = true)"
      :disabled="!editable"
      type="button"
      class="w-full flex items-center justify-center gap-2 py-4 rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-50 disabled:cursor-default"
    >
      <FontAwesomeIcon :icon="faLocationDot" class="w-4 h-4" />
      <span class="text-xs font-medium">Seleccionar en el mapa</span>
    </button>

    <MapaModal :is-open="open" :initial-coords="coords" @close="open = false" @confirm="handleConfirm" />
  </div>
</template>
