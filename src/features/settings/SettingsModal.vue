<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faUser, faCircleUser, faCreditCard } from '@/lib/icons';
import Avatar from '@/components/Avatar.vue';
import { useSessionStore } from '@/stores/session';
import { useUsuariosQuery } from '@/composables/useUsuarios';
import GeneralTab from './GeneralTab.vue';
import CuentaTab from './CuentaTab.vue';
import FacturacionTab from './FacturacionTab.vue';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';

defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ close: [] }>();

const session = useSessionStore();
const { data: usuariosData } = useUsuariosQuery();
const usuario = computed(() => usuariosData.value?.find((u) => u.id === session.sesion?.usuarioId) ?? null);

type Tab = 'general' | 'cuenta' | 'facturacion';

// Un cliente sin plan todavía (recién registrado, ver ElegirPlanPage.vue) no tiene nada que
// gestionar en Facturación — esa pestaña asume una suscripción existente (cancelar, add-ons,
// colaboradores) y consultarla auto-asignaría un plan de muestra
// (FacturacionController::crearDefault()). Se oculta hasta que elija un plan de verdad.
const mostrarFacturacion = computed(() => session.sesion?.tienePlan !== false);

const tabs = computed<{ id: Tab; label: string; icon: IconDefinition }[]>(() => [
  { id: 'general', label: 'General', icon: faUser },
  { id: 'cuenta', label: 'Cuenta', icon: faCircleUser },
  ...(mostrarFacturacion.value ? [{ id: 'facturacion' as const, label: 'Facturación', icon: faCreditCard }] : []),
]);

const tab = ref<Tab>('general');
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="relative bg-white rounded-2xl shadow-modal w-full max-w-3xl h-[600px] max-h-[85vh] flex overflow-hidden" @click.stop>
          <button
            @click="emit('close')"
            type="button"
            class="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100 z-10"
          >
            <FontAwesomeIcon :icon="faXmark" />
          </button>

          <div class="w-56 shrink-0 bg-gray-50 border-r border-gray-100 p-4 flex flex-col">
            <h2 class="text-xs font-semibold uppercase tracking-widest text-muted px-2 mb-3">Ajustes</h2>

            <div v-if="usuario" class="flex items-center gap-3 px-2 pb-4 mb-3 border-b border-gray-200">
              <Avatar :nombre="usuario.nombre" :foto-url="usuario.fotoUrl" size="w-10 h-10" />
              <div class="min-w-0">
                <p class="text-sm font-semibold text-heading truncate">{{ usuario.nombre }}</p>
                <p class="text-xs text-muted truncate">{{ usuario.correo || 'Sin correo' }}</p>
              </div>
            </div>

            <nav class="space-y-1">
              <button
                v-for="t in tabs"
                :key="t.id"
                @click="tab = t.id"
                type="button"
                class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors duration-75"
                :class="tab === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'"
              >
                <span
                  class="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors duration-75"
                  :class="tab === t.id ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400'"
                >
                  <FontAwesomeIcon :icon="t.icon" class="w-3.5 h-3.5" />
                </span>
                {{ t.label }}
              </button>
            </nav>
          </div>

          <div class="flex-1 overflow-y-auto p-6">
            <GeneralTab v-if="tab === 'general'" />
            <CuentaTab v-else-if="tab === 'cuenta'" @close="emit('close')" />
            <FacturacionTab v-else-if="tab === 'facturacion'" />
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
