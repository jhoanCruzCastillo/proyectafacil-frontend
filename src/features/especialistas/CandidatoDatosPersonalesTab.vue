<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faIdCard, faPen, faUser, faEnvelope, faPhone, faGraduationCap, faClock, faLink, faCircleInfo, faBriefcase } from '@/lib/icons';
import { useUiStore } from '@/stores/ui';
import type { CandidatoDetalle } from '@/types';

defineProps<{ detalle: CandidatoDetalle }>();

const ui = useUiStore();
function accionProximamente() {
  ui.toast('Esta función estará disponible próximamente');
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-start justify-between mb-5">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <FontAwesomeIcon :icon="faUser" class="w-4 h-4" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-heading">Datos personales</h3>
          <p class="text-xs text-muted">Información básica de identificación del postulante.</p>
        </div>
      </div>
      <button @click="accionProximamente" type="button" class="px-3.5 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75 flex items-center gap-1.5 shrink-0">
        <FontAwesomeIcon :icon="faPen" class="w-3 h-3" />
        Editar datos
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div class="rounded-xl border border-gray-200 p-4">
        <h4 class="text-sm font-bold text-heading mb-3 flex items-center gap-2"><FontAwesomeIcon :icon="faIdCard" class="w-3.5 h-3.5 text-emerald-600" /> Información de identidad y contacto</h4>
        <dl class="text-sm divide-y divide-gray-100">
          <div class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faUser" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">Nombres y apellidos</dt><dd class="text-heading font-medium">{{ detalle.nombre }}</dd></div>
          <div class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faIdCard" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">DNI / CE</dt><dd class="text-heading font-medium">{{ detalle.dni }}</dd></div>
          <div class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faEnvelope" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">Correo electrónico</dt><dd class="text-heading font-medium">{{ detalle.correo }}</dd></div>
          <div class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faPhone" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">Teléfono / WhatsApp</dt><dd class="text-heading font-medium">{{ detalle.telefono }}</dd></div>
        </dl>
      </div>

      <div class="rounded-xl border border-gray-200 p-4">
        <h4 class="text-sm font-bold text-heading mb-3 flex items-center gap-2"><FontAwesomeIcon :icon="faGraduationCap" class="w-3.5 h-3.5 text-emerald-600" /> Formación profesional</h4>
        <dl class="text-sm divide-y divide-gray-100">
          <div class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faBriefcase" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">Profesión</dt><dd class="text-heading font-medium">{{ detalle.profesion }}</dd></div>
          <div v-if="detalle.colegiatura" class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faIdCard" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">Colegiatura / CIP</dt><dd class="text-heading font-medium">{{ detalle.colegiatura }}</dd></div>
          <div class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faGraduationCap" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">Nivel académico</dt><dd class="text-heading font-medium">{{ detalle.nivelAcademico }}</dd></div>
          <div class="flex items-center gap-2.5 py-2"><FontAwesomeIcon :icon="faClock" class="w-3 h-3 text-gray-400 shrink-0" /><dt class="text-muted flex-1">Años de experiencia</dt><dd class="text-heading font-medium">{{ detalle.aniosExperiencia }}</dd></div>
        </dl>
      </div>
    </div>

    <div v-if="detalle.linkedin || detalle.otrasRedes" class="rounded-xl border border-gray-200 p-4 mt-5">
      <h4 class="text-sm font-bold text-heading mb-3 flex items-center gap-2"><FontAwesomeIcon :icon="faLink" class="w-3.5 h-3.5 text-emerald-600" /> Enlaces</h4>
      <dl class="text-sm space-y-2">
        <div v-if="detalle.linkedin" class="flex items-center gap-2.5"><dt class="text-muted shrink-0 w-20">LinkedIn</dt><dd class="truncate"><a :href="detalle.linkedin" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:underline inline-flex items-center gap-1.5">{{ detalle.linkedin }}</a></dd></div>
        <div v-if="detalle.otrasRedes" class="flex items-center gap-2.5"><dt class="text-muted shrink-0 w-20">Otras redes</dt><dd class="truncate"><a :href="detalle.otrasRedes" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:underline inline-flex items-center gap-1.5">{{ detalle.otrasRedes }}</a></dd></div>
      </dl>
    </div>

    <div v-if="detalle.comentarios" class="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 mt-5">
      <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
        <FontAwesomeIcon :icon="faCircleInfo" class="w-3 h-3" />
      </div>
      <div>
        <p class="text-sm font-bold text-heading mb-1">Sobre el postulante</p>
        <p class="text-sm text-heading leading-relaxed">{{ detalle.comentarios }}</p>
      </div>
    </div>
  </div>
</template>
