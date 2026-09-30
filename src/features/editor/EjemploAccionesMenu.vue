<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faEllipsisVertical, faStar, faFileImport, faEye, faDownload, faSpinner,
  faBoxArchive, faCloudArrowUp, faPen, faTrash,
} from '@/lib/icons';
import type { Ejemplo } from '@/types';

// Antes cada ejemplo mostraba 5 botones de ícono en fila (publicar, referencia IA, volcar,
// previsualizar, descargar) + el de eliminar — ocupaban tanto que el nombre del ejemplo quedaba
// apretado en una lista angosta. Un solo botón "⋮" que abre estas mismas acciones en un menú, más
// "Editar datos de la ficha" (nueva). Pedido explícito del usuario (2026-09-30) — mismo espíritu
// del menú de referencia que trajo, pero solo con las acciones que esta pantalla ya tiene.
const props = defineProps<{ ejemplo: Ejemplo; descargando?: boolean }>();
const emit = defineEmits<{
  preview: [];
  download: [];
  delete: [];
  'toggle-estado': [];
  'volcar-excel': [];
  'toggle-referencia-ia': [];
  'editar-datos': [];
}>();

const abierto = ref(false);
const botonEl = ref<HTMLElement | null>(null);
const menuEl = ref<HTMLElement | null>(null);
const menuStyle = ref<Record<string, string>>({});

// Igual que UserMenu.vue: el menú vive dentro de un panel con scroll propio, así que se
// teletransporta a <body> y se posiciona a mano contra el botón que lo abre — si no, quedaría
// recortado por el `overflow-y-auto` de la lista de ejemplos en vez de flotar por encima.
function actualizarPosicion() {
  const el = botonEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  menuStyle.value = {
    left: `${rect.right - 220}px`,
    top: `${rect.bottom + 4}px`,
    width: '220px',
  };
}
function toggle() {
  if (!abierto.value) actualizarPosicion();
  abierto.value = !abierto.value;
}
function accion(fn: () => void) {
  fn();
  abierto.value = false;
}
function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  if (botonEl.value?.contains(target)) return;
  if (menuEl.value?.contains(target)) return;
  abierto.value = false;
}
function handleResize() {
  if (abierto.value) actualizarPosicion();
}
onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
  window.addEventListener('resize', handleResize);
  window.addEventListener('scroll', handleResize, true);
});
onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('scroll', handleResize, true);
});
</script>

<template>
  <button
    ref="botonEl"
    @click.stop="toggle"
    type="button"
    title="Acciones del ejemplo"
    class="flex w-7 h-7 rounded-md items-center justify-center shrink-0 transition-colors duration-75"
    :class="abierto ? 'bg-gray-100 text-gray-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'"
  >
    <FontAwesomeIcon :icon="faEllipsisVertical" class="w-3.5 h-3.5" />
  </button>

  <Teleport to="body">
    <Transition name="pop">
      <div
        v-if="abierto"
        ref="menuEl"
        :style="menuStyle"
        class="fixed bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-50 py-1"
        @click.stop
      >
        <button
          @click="accion(() => emit('toggle-estado'))"
          type="button"
          class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-75"
        >
          <FontAwesomeIcon :icon="ejemplo.estado === 'publicado' ? faBoxArchive : faCloudArrowUp" class="w-3.5 text-center text-gray-400" />
          {{ ejemplo.estado === 'publicado' ? 'Volver a borrador' : 'Publicar ejemplo' }}
        </button>
        <button
          @click="accion(() => emit('toggle-referencia-ia'))"
          type="button"
          class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-75"
        >
          <FontAwesomeIcon :icon="faStar" class="w-3.5 text-center" :class="ejemplo.esReferenciaIA ? 'text-amber-500' : 'text-gray-400'" />
          {{ ejemplo.esReferenciaIA ? 'Quitar como referencia IA' : 'Marcar como referencia IA' }}
        </button>
        <button
          @click="accion(() => emit('editar-datos'))"
          type="button"
          class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-75"
        >
          <FontAwesomeIcon :icon="faPen" class="w-3.5 text-center text-gray-400" />
          Editar datos de la ficha
        </button>
        <button
          @click="accion(() => emit('volcar-excel'))"
          type="button"
          class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-75"
        >
          <FontAwesomeIcon :icon="faFileImport" class="w-3.5 text-center text-gray-400" />
          Volcar datos desde Excel
        </button>
        <button
          @click="accion(() => emit('preview'))"
          type="button"
          class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-75"
        >
          <FontAwesomeIcon :icon="faEye" class="w-3.5 text-center text-gray-400" />
          Previsualizar
        </button>
        <button
          @click="!descargando && accion(() => emit('download'))"
          type="button"
          :disabled="descargando"
          class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-75 disabled:cursor-wait"
        >
          <FontAwesomeIcon :icon="descargando ? faSpinner : faDownload" class="w-3.5 text-center text-gray-400" :class="{ 'animate-spin': descargando }" />
          {{ descargando ? 'Descargando…' : 'Descargar Excel' }}
        </button>
        <div class="border-t border-gray-100 my-1" />
        <button
          @click="accion(() => emit('delete'))"
          type="button"
          class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-75"
        >
          <FontAwesomeIcon :icon="faTrash" class="w-3.5 text-center" />
          Eliminar
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pop-enter-active,
.pop-leave-active {
  transition: all 0.1s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
