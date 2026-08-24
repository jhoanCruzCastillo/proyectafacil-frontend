<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCartShopping, faCircleCheck, faStar } from '@/lib/icons';
import { useBeneficiosCatalogoQuery, useMisBeneficiosQuery } from '@/composables/useBeneficios';
import { useIniciarCheckout } from '@/composables/usePagos';
import { tieneBeneficio } from '@/lib/beneficios';

const props = defineProps<{ usuarioId: string }>();

const { data: catalogo } = useBeneficiosCatalogoQuery();
const { data: misBeneficios } = useMisBeneficiosQuery(() => props.usuarioId);
const checkout = useIniciarCheckout();

function comprar(beneficioId: string) {
  checkout.mutate({ usuarioId: props.usuarioId, beneficioId });
}
</script>

<template>
  <div v-if="catalogo && catalogo.length > 0">
    <h3 class="text-sm font-semibold text-heading mb-1">Beneficios</h3>
    <p class="text-xs text-muted mb-3">
      Desbloquea funciones adicionales de la plataforma comprando el beneficio correspondiente.
    </p>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div v-for="b in catalogo" :key="b.id" class="flex flex-col rounded-lg border border-gray-200 p-4">
        <div class="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
          <FontAwesomeIcon :icon="faStar" class="w-4 h-4" />
        </div>
        <p class="text-sm font-semibold text-heading">{{ b.nombre }}</p>
        <p class="text-xs text-muted mt-1 flex-1">{{ b.descripcion }}</p>
        <p class="text-lg font-bold text-heading mt-3">
          ${{ b.precio }} <span class="text-xs font-normal text-muted">{{ b.recurrente ? '/mes' : 'pago único' }}</span>
        </p>

        <div v-if="tieneBeneficio(misBeneficios, b.slug)" class="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-brand-600">
          <FontAwesomeIcon :icon="faCircleCheck" class="w-3.5 h-3.5" />
          Ya lo tienes
        </div>
        <button
          v-else-if="b.comprable"
          @click="comprar(b.id)"
          :disabled="checkout.isPending.value"
          type="button"
          class="mt-3 px-4 py-2 rounded-md bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors duration-75 flex items-center justify-center gap-1.5"
        >
          <FontAwesomeIcon :icon="faCartShopping" class="w-3 h-3" />
          {{ checkout.isPending.value ? 'Redirigiendo…' : 'Comprar' }}
        </button>
        <p v-else class="mt-3 text-[11px] text-center text-muted">Próximamente</p>
      </div>
    </div>
  </div>
</template>
