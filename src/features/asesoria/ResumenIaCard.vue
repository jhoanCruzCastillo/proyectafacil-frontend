<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faWandMagicSparkles } from '@/lib/icons';

// Igual que VideoSesionCard.vue: extraído de TicketDetalleCompletadoModal.vue para que el cliente
// vea el mismo resumen de IA de su propia videollamada, sin duplicar el maquetado.
const props = defineProps<{ resumenIaTexto?: string | null }>();

interface BloqueResumen {
  titulo: string | null;
  cuerpo: string;
}

const SALTO_LINEA = String.fromCharCode(10);

// Gemini entrega el resumen como una lista "etiqueta del sub-tema + explicacion" (ver
// GoogleMeetService::textoDeParrafo en el backend) - cada bloque separado por linea en blanco, y
// dentro del bloque la etiqueta va en su propia linea. Antes esto se mostraba como un solo parrafo
// plano; aca lo partimos para mostrar la etiqueta como sub-titulo y el resto como cuerpo, que es el
// formato que la IA ya trae. Tambien se normalizan, caracter por codigo (para no depender de
// escapes de regex que se corrompen fácil al editar este archivo), los saltos de linea manuales
// que Google Docs incrusta como caracteres de control (vertical tab, form feed, line/paragraph
// separator) - en registros sincronizados antes de este fix quedaron guardados tal cual y el
// navegador los pintaba como cuadrados ("tofu").
function normalizarControles(texto: string): string {
  let resultado = '';
  for (const caracter of texto) {
    const codigo = caracter.codePointAt(0) ?? 0;
    if (codigo === 11 || codigo === 12 || codigo === 8232 || codigo === 8233) {
      resultado += SALTO_LINEA;
    } else if (codigo < 32 && codigo !== 10 && codigo !== 9) {
      continue;
    } else if (codigo === 127) {
      continue;
    } else {
      resultado += caracter;
    }
  }
  return resultado;
}

const bloques = computed<BloqueResumen[]>(() => {
  const texto = props.resumenIaTexto;
  if (!texto) return [];

  const normalizado = normalizarControles(texto);
  const dobleSalto = SALTO_LINEA + SALTO_LINEA;

  return normalizado
    .split(dobleSalto)
    .map((bloque) => bloque.trim())
    .filter((bloque) => bloque !== '')
    .map((bloque) => {
      const lineas = bloque.split(SALTO_LINEA).map((l) => l.trim()).filter((l) => l !== '');
      if (lineas.length > 1) {
        return { titulo: lineas[0], cuerpo: lineas.slice(1).join(' ') };
      }
      return { titulo: null, cuerpo: lineas[0] ?? '' };
    });
});
</script>

<template>
  <div class="flex flex-col p-4 rounded-xl bg-purple-50 border border-purple-200">
    <div class="flex items-center gap-2 mb-2">
      <div class="w-6 h-6 rounded-md bg-purple-100 text-purple-500 flex items-center justify-center shrink-0">
        <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3 h-3" />
      </div>
      <p class="text-xs font-semibold text-purple-700">Resumen generado por IA</p>
    </div>
    <div v-if="bloques.length > 0" class="space-y-3">
      <div v-for="(bloque, i) in bloques" :key="i">
        <p v-if="bloque.titulo" class="text-xs font-bold text-purple-800 mb-0.5">{{ bloque.titulo }}</p>
        <p class="text-sm text-heading leading-relaxed">{{ bloque.cuerpo }}</p>
      </div>
    </div>
    <p v-else class="text-sm text-muted italic my-auto text-center">El resumen todavía no está disponible — se genera automáticamente poco después de terminar la llamada.</p>
  </div>
</template>
