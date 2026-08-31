<script setup lang="ts">
// `axis="x"` (default): barra vertical, arrastre horizontal — separador de paneles lado a lado.
// `axis="y"`: barra horizontal, arrastre vertical — para redimensionar alto en vez de ancho.
// `subtle`: la barra queda invisible hasta hacer hover (pedido para la ventana de chat, que se ve
// mejor sin una línea gris permanente) — el resto de usos (paneles del editor) no la pasan y
// mantienen la línea siempre visible de toda la vida.
const props = withDefaults(defineProps<{ axis?: 'x' | 'y'; subtle?: boolean }>(), { axis: 'x', subtle: false });
const emit = defineEmits<{ resize: [delta: number] }>();

function handleMouseDown(e: MouseEvent) {
  e.preventDefault();
  const eje = props.axis === 'y' ? 'clientY' : 'clientX';
  let last = e[eje];
  document.body.style.cursor = props.axis === 'y' ? 'row-resize' : 'col-resize';
  document.body.style.userSelect = 'none';

  function handleMouseMove(ev: MouseEvent) {
    const delta = ev[eje] - last;
    last = ev[eje];
    emit('resize', delta);
  }

  function handleMouseUp() {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}
</script>

<template>
  <div
    @mousedown="handleMouseDown"
    class="shrink-0 hover:bg-brand-300 active:bg-brand-400 transition-colors duration-75 relative"
    :class="[axis === 'y' ? 'h-1 w-full cursor-row-resize' : 'w-1 cursor-col-resize', subtle ? 'bg-transparent' : 'bg-gray-200']"
  >
    <div class="absolute" :class="axis === 'y' ? 'inset-x-0 -top-1 -bottom-1' : 'inset-y-0 -left-1 -right-1'" />
  </div>
</template>
