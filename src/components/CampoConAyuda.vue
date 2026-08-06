<script setup lang="ts">
// Etiqueta de un campo del panel de propiedades con un "?" que despliega su explicación.
// El texto va DEBAJO del control para no descolocar las rejillas de 2 y 3 columnas del panel.
import { ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCircleQuestion } from '@/lib/icons';

defineProps<{ etiqueta: string; ayuda: string }>();

const abierto = ref(false);
</script>

<template>
  <div>
    <div class="flex items-center gap-1 mb-1">
      <label class="block text-xs font-medium text-heading">{{ etiqueta }}</label>
      <button
        @click.stop="abierto = !abierto"
        type="button"
        :title="abierto ? 'Ocultar explicación' : `Qué es «${etiqueta}»`"
        :aria-expanded="abierto"
        class="w-4 h-4 rounded-full flex items-center justify-center transition-colors shrink-0"
        :class="abierto ? 'text-brand-600' : 'text-gray-300 hover:text-brand-500'"
      >
        <FontAwesomeIcon :icon="faCircleQuestion" class="w-3 h-3" />
      </button>
    </div>
    <slot />
    <p v-if="abierto" class="mt-1.5 text-[11px] leading-snug text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5">
      {{ ayuda }}
    </p>
  </div>
</template>
