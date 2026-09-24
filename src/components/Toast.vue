<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck, faXmark, faSpinner } from '@/lib/icons';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
</script>

<template>
  <div class="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
    <TransitionGroup name="toast">
      <div
        v-for="item in ui.toasts"
        :key="item.id"
        class="flex flex-col gap-1.5 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white min-w-[220px]"
        :class="item.type === 'success' ? 'bg-brand-600' : 'bg-red-600'"
      >
        <div class="flex items-center gap-2">
          <FontAwesomeIcon
            :icon="item.progreso === undefined ? (item.type === 'success' ? faCheck : faXmark) : faSpinner"
            class="w-3.5 h-3.5 shrink-0"
            :class="item.progreso !== undefined && 'animate-spin'"
          />
          <span class="flex-1">{{ item.message }}</span>
          <span v-if="item.progreso !== undefined" class="text-xs font-mono opacity-80 tabular-nums">{{ Math.round(item.progreso) }}%</span>
        </div>
        <div v-if="item.progreso !== undefined" class="h-1 rounded-full bg-white/25 overflow-hidden">
          <div class="h-full bg-white rounded-full transition-[width] duration-200 ease-out" :style="{ width: `${item.progreso}%` }" />
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.15s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
</style>
