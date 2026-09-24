<script setup lang="ts">
interface OpcionActividad {
  valor: string;
  titulo: string;
  descripcion: string;
  icono: string;
}

const OPCIONES_ACTIVIDAD: OpcionActividad[] = [
  {
    valor: 'Asesorías en vivo (chat y videollamada)',
    titulo: 'Asesorías en vivo',
    descripcion: 'Por chat y videollamada con clientes de ILPIIE Live',
    icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>',
  },
  {
    valor: 'Ponencias / Docencia',
    titulo: 'Ponencias / Docencia',
    descripcion: 'Webinars, talleres, cursos especializados y capacitaciones',
    icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h20M10 9l-6 8h12l-6-8zM12 17v4M8 21h8"/></svg>',
  },
  {
    valor: 'Investigaciones',
    titulo: 'Investigaciones',
    descripcion: 'Estudios, análisis normativos y diagnósticos sectoriales',
    icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
  },
  {
    valor: 'Publicaciones — Columnas',
    titulo: 'Publicaciones — Columnas',
    descripcion: 'Artículos de opinión y análisis para el blog del ILPIIE',
    icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  },
  {
    valor: 'Publicaciones — Artículos técnicos',
    titulo: 'Publicaciones — Artículos técnicos',
    descripcion: 'Papers, guías técnicas y documentos de profundidad',
    icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
  },
  {
    valor: 'Publicaciones de libros',
    titulo: 'Publicaciones de libros',
    descripcion: 'Coautoría o revisión técnica de publicaciones institucionales',
    icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M9 7h7"/></svg>',
  },
  {
    valor: 'Otras actividades',
    titulo: 'Otras actividades',
    descripcion: 'Descríbelas en el campo de comentarios del paso 5',
    icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  },
];

const MENSAJE_ERROR = 'Selecciona al menos una actividad que realizarías.';

defineProps<{ mostrarError: boolean }>();

const actividadesSeleccionadas = defineModel<string[]>('actividadesSeleccionadas', { required: true });

function actividadMarcada(valor: string): boolean {
  return actividadesSeleccionadas.value.includes(valor);
}
function alternarActividad(valor: string) {
  const i = actividadesSeleccionadas.value.indexOf(valor);
  if (i > -1) actividadesSeleccionadas.value.splice(i, 1);
  else actividadesSeleccionadas.value.push(valor);
}
</script>

<template>
  <div class="sec">
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <div><div class="section-title">Actividades que realizarías</div><div class="section-subtitle">Selecciona al menos una actividad</div></div>
      </div>
      <div class="acts">
        <div v-for="a in OPCIONES_ACTIVIDAD" :key="a.valor" class="act" :class="{ checked: actividadMarcada(a.valor) }" @click="alternarActividad(a.valor)">
          <div class="ic" v-html="a.icono" />
          <div><b>{{ a.titulo }}</b><span>{{ a.descripcion }}</span></div>
        </div>
      </div>
      <div class="err" :class="{ on: mostrarError }">{{ MENSAJE_ERROR }}</div>
    </div>
  </div>
</template>
