<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faChevronDown, faCheck, rolUsuarioLabels, rolUsuarioIcons } from '@/lib/icons';
import type { RolUsuario } from '@/types';

const props = defineProps<{ modelValue: RolUsuario; opciones: RolUsuario[] }>();
const emit = defineEmits<{ 'update:modelValue': [RolUsuario] }>();

const isOpen = ref(false);
const rootRef = shallowRef<HTMLElement | null>(null);

function handleOutsideClick(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) isOpen.value = false;
}
onMounted(() => document.addEventListener('mousedown', handleOutsideClick));
onUnmounted(() => document.removeEventListener('mousedown', handleOutsideClick));

function seleccionar(r: RolUsuario) {
  emit('update:modelValue', r);
  isOpen.value = false;
}
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      @click="isOpen = !isOpen"
      type="button"
      class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm bg-white transition-colors"
      :class="isOpen ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-gray-200 hover:border-gray-300'"
    >
      <FontAwesomeIcon :icon="rolUsuarioIcons[modelValue]" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <span class="flex-1 text-left text-heading font-medium">{{ rolUsuarioLabels[modelValue] }}</span>
      <FontAwesomeIcon :icon="faChevronDown" class="w-3 h-3 text-gray-400 shrink-0 transition-transform duration-150" :class="isOpen ? 'rotate-180' : ''" />
    </button>

    <Transition name="drop">
      <div v-if="isOpen" class="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden py-1">
        <button
          v-for="r in opciones"
          :key="r"
          @click="seleccionar(r)"
          type="button"
          class="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors"
          :class="modelValue === r ? 'bg-brand-50/60' : ''"
        >
          <FontAwesomeIcon :icon="rolUsuarioIcons[r]" class="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span class="flex-1 text-heading">{{ rolUsuarioLabels[r] }}</span>
          <FontAwesomeIcon v-if="modelValue === r" :icon="faCheck" class="w-3.5 h-3.5 text-brand-600" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.drop-enter-active,
.drop-leave-active {
  transition: all 0.1s ease;
}
.drop-enter-from,
.drop-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
