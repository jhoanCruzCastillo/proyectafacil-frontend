<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faBriefcase, faClock, faStar, faListCheck, faCheck, faCircleInfo } from '@/lib/icons';
import type { CandidatoDetalle } from '@/types';

defineProps<{ detalle: CandidatoDetalle }>();

// Mismo catálogo fijo de 7 actividades del wizard público (OPCIONES_ACTIVIDAD en
// RegistroEspecialistaPage.vue) — acá se recorren todas, marcando cuáles sí eligió el postulante
// (detalle.actividades), en vez de mostrar solo las elegidas como chips sueltos.
const ACTIVIDADES_CATALOGO = [
  { valor: 'Asesorías en vivo (chat y videollamada)', titulo: 'Asesorías en vivo', descripcion: 'Por chat y videollamada con clientes de ILPIIE Live.' },
  { valor: 'Ponencias / Docencia', titulo: 'Ponencias / Docencia', descripcion: 'Webinars, talleres, cursos especializados y capacitaciones.' },
  { valor: 'Investigaciones', titulo: 'Investigaciones', descripcion: 'Estudios, análisis normativos y diagnósticos sectoriales.' },
  { valor: 'Publicaciones — Columnas', titulo: 'Publicaciones — Columnas', descripcion: 'Artículos de opinión y análisis para el blog del ILPIIE.' },
  { valor: 'Publicaciones — Artículos técnicos', titulo: 'Publicaciones — Artículos técnicos', descripcion: 'Papers, guías técnicas y documentos de profundidad.' },
  { valor: 'Publicaciones de libros', titulo: 'Publicaciones de libros', descripcion: 'Coautoría o revisión técnica de publicaciones institucionales.' },
  { valor: 'Otras actividades', titulo: 'Otras actividades', descripcion: 'Actividades no listadas arriba.' },
];
</script>

<template>
  <div class="p-6">
    <div class="flex items-center gap-3 mb-5">
      <div class="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
        <FontAwesomeIcon :icon="faBriefcase" class="w-4 h-4" />
      </div>
      <div>
        <h3 class="text-sm font-bold text-heading">Experiencia y actividades</h3>
        <p class="text-xs text-muted">Años de experiencia y actividades que el postulante puede realizar.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div class="rounded-xl border border-gray-200 p-4">
        <h4 class="text-sm font-bold text-heading mb-3 flex items-center gap-2"><FontAwesomeIcon :icon="faBriefcase" class="w-3.5 h-3.5 text-emerald-600" /> Experiencia profesional</h4>
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-lg bg-gray-50 p-3">
            <FontAwesomeIcon :icon="faClock" class="w-3.5 h-3.5 text-gray-400 mb-1.5" />
            <p class="text-sm font-bold text-heading">{{ detalle.aniosExperiencia }}</p>
            <p class="text-xs text-muted">de experiencia</p>
          </div>
          <div class="rounded-lg bg-gray-50 p-3">
            <FontAwesomeIcon :icon="faStar" class="w-3.5 h-3.5 text-gray-400 mb-1.5" />
            <p class="text-sm font-bold text-heading">{{ detalle.nivelEspecialidad }}</p>
            <p class="text-xs text-muted">nivel de especialidad</p>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 p-4">
        <h4 class="text-sm font-bold text-heading mb-1 flex items-center gap-2"><FontAwesomeIcon :icon="faListCheck" class="w-3.5 h-3.5 text-emerald-600" /> Actividades que realizará</h4>
        <p class="text-xs text-muted mb-3">El postulante seleccionó las siguientes actividades:</p>
        <div class="space-y-2">
          <div
            v-for="a in ACTIVIDADES_CATALOGO"
            :key="a.valor"
            class="flex items-start gap-2.5 p-2.5 rounded-lg"
            :class="detalle.actividades.includes(a.valor) ? 'bg-emerald-50' : 'opacity-50'"
          >
            <span
              class="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
              :class="detalle.actividades.includes(a.valor) ? 'bg-emerald-500 text-white' : 'border border-gray-300'"
            >
              <FontAwesomeIcon v-if="detalle.actividades.includes(a.valor)" :icon="faCheck" class="w-2.5 h-2.5" />
            </span>
            <div>
              <p class="text-sm font-medium text-heading">{{ a.titulo }}</p>
              <p class="text-xs text-muted">{{ a.descripcion }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 mt-5">
      <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
        <FontAwesomeIcon :icon="faCircleInfo" class="w-3 h-3" />
      </div>
      <div>
        <p class="text-sm font-bold text-heading mb-1">Nota</p>
        <p class="text-sm text-heading leading-relaxed">La información de experiencia y actividades fue declarada por el postulante y será validada durante el proceso de evaluación.</p>
      </div>
    </div>
  </div>
</template>
