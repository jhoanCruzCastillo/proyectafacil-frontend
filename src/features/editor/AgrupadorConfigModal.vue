<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faGear } from '@/lib/icons';

const props = defineProps<{
  isOpen: boolean;
  /** Valor guardado: columnas REALES de Excel que fusiona el título (no cabeceras) */
  abarcaColumnas: number;
  /** Cabeceras disponibles desde donde arranca el título, con su ancho en columnas de Excel */
  cabeceras: { nombre: string; ancho: number; columna?: string }[];
  /** Solo jerárquicas: nombre de la columna donde arranca el título (la del agrupador). En tablas
   * planas el título siempre arranca en la primera, así que no hace falta nombrarla. */
  desdeColumna?: string;
}>();

const emit = defineEmits<{ close: []; change: [value: number] }>();

// Se ELIGE por cabecera, porque es como se piensa la tabla, pero se GUARDA en columnas de Excel,
// que es lo que la convención declara. Este acumulado es la traducción entre ambas.
const acumulado = computed(() => {
  const out: number[] = [];
  let suma = 0;
  for (const c of props.cabeceras) { suma += Math.max(c.ancho, 1); out.push(suma); }
  return out;
});
const totalCabeceras = computed(() => props.cabeceras.length);
/** Cabeceras que cubre el valor guardado, o null si el corte cae dentro de una */
const cabecerasElegidas = computed(() => {
  const i = acumulado.value.indexOf(props.abarcaColumnas);
  return i >= 0 ? i + 1 : null;
});

function sumarColumnas(letra: string, delta: number): string {
  let n = 0;
  for (const ch of letra.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  n += delta;
  let out = '';
  while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); }
  return out || letra;
}

/** "B:E" — el rango real que fusionará el título, para que el número no sea abstracto */
const rango = computed(() => {
  const inicio = props.cabeceras[0]?.columna;
  if (!inicio || props.abarcaColumnas < 1) return null;
  return props.abarcaColumnas === 1 ? inicio : `${inicio}:${sumarColumnas(inicio, props.abarcaColumnas - 1)}`;
});

/** Lo que sobra de la cabecera partida, si el corte no cae en una frontera */
const resto = computed(() => {
  if (cabecerasElegidas.value !== null) return 0;
  const siguiente = acumulado.value.find((a) => a > props.abarcaColumnas);
  return siguiente ? siguiente - props.abarcaColumnas : 0;
});

/** Ancho físico total de la tabla desde donde arranca el título — tope del campo de columnas */
const totalColumnasExcel = computed(() => acumulado.value[acumulado.value.length - 1] ?? 1);

// Elegir por cabecera calcula y asigna las columnas reales…
function handleCabeceras(e: Event) {
  const n = Math.min(Math.max(1, Number((e.target as HTMLInputElement).value) || 1), totalCabeceras.value);
  emit('change', acumulado.value[n - 1] ?? 1);
}

// …y las columnas reales siguen siendo editables a mano, para los casos que no caen en una frontera
// de cabecera (ver el aviso del sobrante).
function handleColumnas(e: Event) {
  const n = Number((e.target as HTMLInputElement).value) || 1;
  emit('change', Math.min(Math.max(1, n), totalColumnasExcel.value));
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-xs" @click.stop>
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <FontAwesomeIcon :icon="faGear" class="w-3.5 h-3.5 text-brand-600" />
              <h2 class="text-sm font-bold text-heading">Fila de título de grupo</h2>
            </div>
            <button @click="emit('close')" class="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100">
              <FontAwesomeIcon :icon="faXmark" class="w-3.5 h-3.5" />
            </button>
          </div>
          <div class="p-5 space-y-3">
            <p class="text-xs text-muted">
              Cuántas <strong>cabeceras</strong> fusiona el título de cada grupo, contando desde
              <template v-if="desdeColumna">la columna <strong class="text-heading">«{{ desdeColumna }}»</strong>, donde vive el agrupador</template>
              <template v-else>la primera cabecera de la tabla</template>.
              Se elige por cabecera, pero lo que se guarda son <strong>columnas reales de Excel</strong>.
            </p>
            <!-- Dos campos: elegir por cabecera calcula el de abajo, pero las columnas reales
                 siguen siendo editables a mano para los cortes que no caen en una frontera. -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-medium text-muted mb-1">Abarca cabeceras</label>
                <input
                  :value="cabecerasElegidas ?? ''"
                  @input="handleCabeceras"
                  type="number"
                  min="1"
                  :max="totalCabeceras"
                  placeholder="—"
                  class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
                <p class="text-[10px] text-muted mt-1">De {{ totalCabeceras }}</p>
              </div>
              <div>
                <label class="block text-[10px] font-medium text-muted mb-1">Columnas reales de Excel</label>
                <input
                  :value="abarcaColumnas"
                  @input="handleColumnas"
                  type="number"
                  min="1"
                  :max="totalColumnasExcel"
                  class="w-full px-3 py-2 rounded-lg border border-brand-200 bg-brand-50/40 text-sm font-semibold text-heading focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
                <p class="text-[10px] text-muted mt-1">De {{ totalColumnasExcel }}</p>
              </div>
            </div>
            <div class="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
              <p class="text-[11px] text-heading">
                Fusiona <strong>{{ abarcaColumnas }}</strong> columna{{ abarcaColumnas === 1 ? '' : 's' }}<template v-if="rango"> — <strong>{{ rango }}</strong></template>
              </p>
              <p v-if="resto > 0" class="text-[10px] text-amber-700 mt-1">
                El corte parte una cabecera: las {{ resto }} columna{{ resto === 1 ? '' : 's' }} que sobran se fusionan aparte, en su propia celda.
              </p>
              <p v-else class="text-[10px] text-muted mt-1">
                Las cabeceras restantes aportan una celda completa cada una en esa fila.
              </p>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.pop-enter-active,
.pop-leave-active {
  transition: all 0.12s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.97) translateY(10px);
}
</style>
