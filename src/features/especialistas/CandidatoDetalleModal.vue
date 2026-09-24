<script setup lang="ts">
import { ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faIdCard, faTags, faStar, faUser } from '@/lib/icons';
import Avatar from '@/components/Avatar.vue';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import { useCandidatoDetalleQuery } from '@/composables/useCandidatos';
import { ESTADO_CANDIDATO_LABEL, ESTADO_CANDIDATO_CLASE } from '@/lib/estadoCandidato';
import { formatoFechaHora } from '@/lib/fechas';
import CandidatoResumenTab from './CandidatoResumenTab.vue';
import CandidatoDatosPersonalesTab from './CandidatoDatosPersonalesTab.vue';
import CandidatoEspecialidadesTab from './CandidatoEspecialidadesTab.vue';
import CandidatoExperienciaTab from './CandidatoExperienciaTab.vue';

const props = defineProps<{ isOpen: boolean; candidatoId: string | null }>();
const emit = defineEmits<{ close: [] }>();

const { data: detalle, isLoading } = useCandidatoDetalleQuery(() => (props.isOpen ? props.candidatoId : null));

type Tab = 'resumen' | 'datos-personales' | 'especialidades' | 'experiencia';
const TABS: { value: Tab; label: string; icon: typeof faUser }[] = [
  { value: 'resumen', label: 'Resumen', icon: faUser },
  { value: 'datos-personales', label: 'Datos personales', icon: faIdCard },
  { value: 'especialidades', label: 'Especialidades', icon: faTags },
  { value: 'experiencia', label: 'Experiencia y actividades', icon: faStar },
];
const activeTab = ref<Tab>('resumen');
watch(() => props.candidatoId, () => { activeTab.value = 'resumen'; });
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-4xl max-h-[90vh] overflow-y-auto" @click.stop>
          <LoadingSpinner v-if="isLoading" wrapper-class="px-6 pb-14 pt-8" />
          <template v-else-if="detalle">
            <div class="p-6 pb-4 flex items-start justify-between border-b border-gray-100">
              <div class="flex items-center gap-4">
                <Avatar :nombre="detalle.nombre" size="w-16 h-16" />
                <div>
                  <h2 class="text-xl font-bold text-heading">{{ detalle.nombre }}</h2>
                  <p class="text-sm text-muted">{{ detalle.correo }} · {{ detalle.telefono }}</p>
                  <p class="text-sm text-muted">{{ detalle.profesion }}</p>
                  <div class="flex flex-wrap gap-2 mt-2">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">{{ detalle.aniosExperiencia }} de experiencia</span>
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">{{ detalle.nivelAcademico }}</span>
                    <span v-if="detalle.colegiatura" class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">Colegiatura N.° {{ detalle.colegiatura }}</span>
                  </div>
                </div>
              </div>
              <div class="flex flex-col items-end gap-2 shrink-0">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" :class="ESTADO_CANDIDATO_CLASE[detalle.estado]">
                    <span class="w-1.5 h-1.5 rounded-full bg-current" />
                    {{ ESTADO_CANDIDATO_LABEL[detalle.estado] }}
                  </span>
                  <button @click="emit('close')" type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100">
                    <FontAwesomeIcon :icon="faXmark" />
                  </button>
                </div>
                <p class="text-xs text-muted">Postulación recibida el {{ formatoFechaHora(detalle.fechaRegistro) }}</p>
              </div>
            </div>

            <div class="px-6 border-b border-gray-100 flex gap-5 overflow-x-auto">
              <button
                v-for="tab in TABS"
                :key="tab.value"
                @click="activeTab = tab.value"
                type="button"
                class="flex items-center gap-2 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors duration-75"
                :class="activeTab === tab.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'"
              >
                <FontAwesomeIcon :icon="tab.icon" class="w-3.5 h-3.5" />
                {{ tab.label }}
              </button>
            </div>

            <CandidatoResumenTab v-if="activeTab === 'resumen'" :detalle="detalle" />
            <CandidatoDatosPersonalesTab v-else-if="activeTab === 'datos-personales'" :detalle="detalle" />
            <CandidatoEspecialidadesTab v-else-if="activeTab === 'especialidades'" :detalle="detalle" />
            <CandidatoExperienciaTab v-else-if="activeTab === 'experiencia'" :detalle="detalle" />
          </template>
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
