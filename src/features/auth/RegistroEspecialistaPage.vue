<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import logoIcono from '@/assets/logo-icono.png';

// Página de postulación de especialistas para ILPIIE Live — réplica fiel del mockup
// "registro-especialistas-ilpiie-live-v4.html" que compartió el cliente. Los temas de asesoría
// (paso 2) se traen del catálogo real (mismo endpoint público que usa RegistroPage.vue,
// /api/temas-especialidad/publico) en vez de una lista hardcodeada — así no puede desalinearse
// del catálogo real ni de los `candidato_temas_especialidad` que guarda el backend. El envío
// final (paso 6) postula de verdad contra POST /api/candidatos (multipart: CV + JSON), sin token
// — es un formulario público, igual que auth/registro.

interface OpcionTema {
  id: number;
  nombre: string;
  sub: string;
  icono: string;
}
interface OpcionActividad {
  valor: string;
  titulo: string;
  descripcion: string;
  icono: string;
}
interface GrupoProfesion {
  grupo: string;
  opciones: string[];
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const HORAS = Array.from({ length: 13 }, (_, i) => i + 8); // 8..20 (bloques de 1h, hasta 20-21h)

function formatoHora(hora: number): string {
  const hh = ((hora + 11) % 12) + 1;
  return `${hh}${hora < 12 ? ' a. m.' : ' p. m.'}`;
}

const GRUPOS_PROFESION: GrupoProfesion[] = [
  {
    grupo: 'Liquidación financiera y valorización de obras',
    opciones: ['Contador/a Público/a', 'Economista', 'Ingeniero/a Civil', 'Ingeniero/a de Costos y Presupuestos', 'Especialista en Liquidación de Obras'],
  },
  {
    grupo: 'Inversión pública e Invierte.pe',
    opciones: ['Gestor/a de Proyectos de Inversión', 'Especialista SNIP / Invierte.pe', 'Formulador/a de IOARR', 'Especialista en Programación Multianual'],
  },
  {
    grupo: 'Expedientes técnicos y TDRs',
    opciones: ['Arquitecto/a', 'Ingeniero/a Sanitario/a', 'Ingeniero/a Hidráulico/a', 'Ingeniero/a Mecánico-Eléctrico/a', 'Ingeniero/a Industrial', 'Ingeniero/a Agrícola', 'Ingeniero/a de Caminos y Transportes', 'Topógrafo/a'],
  },
  {
    grupo: 'Contrataciones y compras públicas',
    opciones: ['Abogado/a', 'Especialista en Contrataciones del Estado', 'Especialista en Compras Públicas', 'Administrador/a de Contrataciones'],
  },
  {
    grupo: 'OxI, APPs y peritaje',
    opciones: ['Especialista en Obras por Impuestos y APPs', 'Perito/a Economista', 'Perito/a Contador', 'Perito/a Ingeniero/a Civil'],
  },
  {
    grupo: 'Evaluación social y estudios',
    opciones: ['Sociólogo/a', 'Antropólogo/a', 'Estadístico/a', 'Ingeniero/a Económico-Estadístico/a', 'Especialista en Evaluación Social'],
  },
  {
    grupo: 'Salud',
    opciones: ['Médico/a', 'Obstetra', 'Enfermero/a', 'Especialista en Gestión de Servicios de Salud'],
  },
  {
    grupo: 'Educación y apoyo académico',
    opciones: ['Docente Universitario/a', 'Asesor/a de Tesis', 'Especialista en Educación Inicial / Primaria / Secundaria', 'Especialista en Gestión Educativa'],
  },
  {
    grupo: 'Otras',
    opciones: ['Otra ingeniería', 'Otra profesión'],
  },
];

const NIVELES_ACADEMICOS = ['Bachiller', 'Licenciado / Título profesional', 'Magister / Maestría', 'Doctorado / PhD'];
const EXPERIENCIAS = ['1 – 3 años', '3 – 5 años', '5 – 10 años', 'Más de 10 años'];

const NIVELES_ESPECIALIDAD = [
  {
    valor: 'Especialista',
    sub: 'Experiencia sólida en el tema (3 – 7 años)',
    icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M15.5 13.5L17 21l-5-3-5 3 1.5-7.5"/></svg>',
  },
  {
    valor: 'Senior',
    sub: 'Experiencia amplia y referenciada (7 – 15 años)',
    icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>',
  },
  {
    valor: 'Altamente especializado',
    sub: 'Referente nacional en el tema (más de 15 años)',
    icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8L7 11.5 12 5l5 6.5L21.5 8 20 19H4L2.5 8z"/><path d="M4 21.5h16"/></svg>',
  },
];

// Íconos dibujados a mano del mockup, mapeados por `codigo` del catálogo real
// (temas_especialidad.codigo) — el 10.º ítem del mockup ("Otros temas de especialidad") no tiene
// fila de catálogo; sigue existiendo como el campo de texto libre `otros_temas` de abajo.
const ICONOS_TEMA: Record<string, string> = {
  LFO: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/></svg>',
  IPD: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  ETO: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  TDR: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  CON: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 21h14"/><path d="M12 6l-5 2 5-2 5 2"/><path d="M7 8l-3 6a3.5 3.5 0 006 0L7 8z"/><path d="M17 8l-3 6a3.5 3.5 0 006 0l-3-6z"/></svg>',
  VLO: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  OIA: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>',
  PEC: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
  TES: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>',
};
const ICONO_TEMA_GENERICO = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';

interface TemaPublico {
  id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
}
const temas = ref<OpcionTema[]>([]);
onMounted(async () => {
  try {
    const res = await fetch('/api/temas-especialidad/publico');
    const data: TemaPublico[] = res.ok ? await res.json() : [];
    temas.value = data.map((t) => ({
      id: Number(t.id),
      nombre: t.nombre,
      sub: t.descripcion ?? '',
      icono: ICONOS_TEMA[t.codigo] ?? ICONO_TEMA_GENERICO,
    }));
  } catch {
    temas.value = [];
  }
});

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

const ICONO_SUBIR = '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
const ICONO_RELOJ = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:none;margin-top:1px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

const PASOS = [
  { n: 1, label: 'Perfil' },
  { n: 2, label: 'Especialidad' },
  { n: 3, label: 'Actividades' },
  { n: 4, label: 'Disponibilidad' },
  { n: 5, label: 'Documentos' },
  { n: 6, label: 'Confirmar' },
];

const MENSAJES_ERROR: Record<number, string> = {
  1: 'Completa todos los campos obligatorios. Verifica el correo, el DNI y que ambas contraseñas coincidan (mín. 8 caracteres).',
  2: 'Selecciona al menos un tema de especialización.',
  3: 'Selecciona al menos una actividad que realizarías.',
  4: 'Selecciona al menos un bloque horario en cualquier día.',
  5: 'Adjunta tu CV y acepta los términos para continuar.',
};

const paso = ref(1);
const enviado = ref(false);
const enviando = ref(false);
const errorEnvio = ref('');
const errorCorreo = ref('');
const mostrarError = ref(false);
const diaSeleccionado = ref(0);
const cvInputRef = ref<HTMLInputElement | null>(null);

const campos = reactive({
  nombre: '',
  dni: '',
  correo: '',
  telefono: '',
  password: '',
  password2: '',
  profesion: '',
  nivelAcademico: '',
  colegiatura: '',
  experiencia: '',
  otrosTemas: '',
  linkedin: '',
  otrasRedes: '',
  comentarios: '',
});
const nivelEspecialidad = ref('');
const temasSeleccionados = ref<number[]>([]);
const actividadesSeleccionadas = ref<string[]>([]);
const bloques = reactive<Record<string, boolean>>({});
const aceptaTerminos = ref(false);
const archivoCV = ref<File | null>(null);

function claveBloque(dia: number, hora: number) {
  return `${dia}-${hora}`;
}
function bloqueMarcado(dia: number, hora: number) {
  return !!bloques[claveBloque(dia, hora)];
}
function bloqueBloqueado(dia: number, hora: number) {
  return dia === 5 && hora >= 13;
}
function alternarBloque(hora: number) {
  if (bloqueBloqueado(diaSeleccionado.value, hora)) return;
  const clave = claveBloque(diaSeleccionado.value, hora);
  bloques[clave] = !bloques[clave];
}
function bloquesDelDia(dia: number) {
  return HORAS.filter((h) => bloqueMarcado(dia, h)).length;
}
const totalBloques = computed(() => DIAS.reduce((total, _dia, d) => total + bloquesDelDia(d), 0));
const resumenBloques = computed(() => {
  const chips: string[] = [];
  DIAS.forEach((nombreDia, d) => {
    HORAS.forEach((h) => {
      if (bloqueMarcado(d, h)) chips.push(`${nombreDia.slice(0, 3)} ${formatoHora(h)}`);
    });
  });
  return chips;
});
const listaDisponibilidad = computed(() => {
  const lineas: string[] = [];
  DIAS.forEach((nombreDia, d) => {
    const horas = HORAS.filter((h) => bloqueMarcado(d, h));
    if (horas.length) lineas.push(`${nombreDia}: ${horas.map(formatoHora).join(', ')}`);
  });
  return lineas.join(' · ');
});

function temaMarcado(id: number) {
  return temasSeleccionados.value.includes(id);
}
function alternarTema(id: number, marcado: boolean) {
  const i = temasSeleccionados.value.indexOf(id);
  if (marcado && i === -1) temasSeleccionados.value.push(id);
  else if (!marcado && i > -1) temasSeleccionados.value.splice(i, 1);
}
function actividadMarcada(valor: string) {
  return actividadesSeleccionadas.value.includes(valor);
}
function alternarActividad(valor: string) {
  const i = actividadesSeleccionadas.value.indexOf(valor);
  if (i > -1) actividadesSeleccionadas.value.splice(i, 1);
  else actividadesSeleccionadas.value.push(valor);
}

function abrirSelectorArchivo() {
  cvInputRef.value?.click();
}
function onArchivoCambiado(evento: Event) {
  const input = evento.target as HTMLInputElement;
  archivoCV.value = input.files?.[0] ?? null;
}

function pasoValido(): boolean {
  switch (paso.value) {
    case 1:
      return (
        campos.nombre.trim().length > 3 &&
        campos.correo.includes('@') &&
        campos.dni.trim().length >= 8 &&
        campos.password.length >= 8 &&
        campos.password === campos.password2 &&
        campos.telefono.trim().length >= 6 &&
        !!campos.profesion &&
        !!campos.nivelAcademico &&
        !!campos.experiencia &&
        !!nivelEspecialidad.value
      );
    case 2:
      return temasSeleccionados.value.length > 0;
    case 3:
      return actividadesSeleccionadas.value.length > 0;
    case 4:
      return totalBloques.value > 0;
    case 5:
      return !!archivoCV.value && aceptaTerminos.value;
    default:
      return true;
  }
}

async function enviarPostulacion() {
  if (!archivoCV.value || enviando.value) return;
  enviando.value = true;
  errorEnvio.value = '';
  try {
    const disponibilidad: { dia: number; hora: number }[] = [];
    DIAS.forEach((_, d) => {
      HORAS.forEach((h) => {
        // dia 1=lunes..6=sábado, mismo desfase que dia_semana en el backend (el estado local es
        // 0-indexado, la API espera 1-indexado).
        if (bloqueMarcado(d, h)) disponibilidad.push({ dia: d + 1, hora: h });
      });
    });

    const datos = {
      nombre: campos.nombre.trim(),
      dni: campos.dni.trim(),
      correo: campos.correo.trim(),
      telefono: campos.telefono.trim(),
      password: campos.password,
      profesion: campos.profesion,
      nivelAcademico: campos.nivelAcademico,
      colegiatura: campos.colegiatura.trim(),
      experiencia: campos.experiencia,
      nivelEspecialidad: nivelEspecialidad.value,
      otrosTemas: campos.otrosTemas.trim(),
      actividades: actividadesSeleccionadas.value,
      temaIds: temasSeleccionados.value,
      disponibilidad,
      linkedin: campos.linkedin.trim(),
      otrasRedes: campos.otrasRedes.trim(),
      comentarios: campos.comentarios.trim(),
    };

    const form = new FormData();
    form.append('archivo', archivoCV.value, archivoCV.value.name);
    form.append('datos', JSON.stringify(datos));

    const res = await fetch('/api/candidatos', { method: 'POST', body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const mensaje = body?.error ?? 'No se pudo enviar la postulación. Intenta de nuevo.';
      if (res.status === 409 && /correo ya registrado/i.test(mensaje)) {
        errorCorreo.value = 'Correo ya registrado';
        paso.value = 1;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      throw new Error(mensaje);
    }

    enviado.value = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    errorEnvio.value = e instanceof Error ? e.message : 'No se pudo enviar la postulación. Intenta de nuevo.';
  } finally {
    enviando.value = false;
  }
}

function siguiente() {
  if (paso.value === 6) {
    enviarPostulacion();
    return;
  }
  if (!pasoValido()) {
    mostrarError.value = true;
    return;
  }
  mostrarError.value = false;
  paso.value += 1;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function anterior() {
  if (paso.value <= 1) return;
  mostrarError.value = false;
  paso.value -= 1;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const filasResumen = computed(() => [
  ['Especialista', campos.nombre || '—'],
  ['DNI / CE', campos.dni || '—'],
  ['Correo', campos.correo || '—'],
  ['Teléfono', campos.telefono || '—'],
  ['Profesión', campos.profesion || '—'],
  ['Nivel académico / especialidad', `${campos.nivelAcademico || '—'} · ${nivelEspecialidad.value || '—'}`],
  ['Colegiatura / CIP', campos.colegiatura || '—'],
  ['Experiencia', campos.experiencia || '—'],
  ['Temas de asesoría', temas.value.filter((t) => temasSeleccionados.value.includes(t.id)).map((t) => t.nombre).join(', ') || '—'],
  ['Otros temas', campos.otrosTemas || '—'],
  ['Actividades', actividadesSeleccionadas.value.join(', ') || '—'],
  ['Disponibilidad', listaDisponibilidad.value || '—'],
  ['LinkedIn', campos.linkedin || '—'],
  ['CV', archivoCV.value?.name || '—'],
]);
</script>

<template>
  <div class="pagina-especialista">
    <header class="header">
      <div class="header-inner">
        <RouterLink :to="{ name: 'login' }" class="header-brand">
          <img :src="logoIcono" alt="" class="header-brand-logo" />
          <div class="header-text">
            <p class="brand-name">Proyecta<span>Fácil</span></p>
            <p class="brand-tag">Proyectos de Inversión y Asesorías -by ILPIIE</p>
          </div>
        </RouterLink>
        <nav class="header-nav">
          <a href="#" @click.prevent>Formatos</a>
          <a href="#" @click.prevent>Fichas técnicas</a>
          <a href="#" @click.prevent>IOARR</a>
          <a href="#" @click.prevent>Perfiles</a>
          <a class="header-live" href="#" @click.prevent><span class="live-dot" />ILPIIE Live</a>
        </nav>
      </div>
    </header>

    <main class="container">
      <div class="form-hero">
        <div class="label">Postulación abierta</div>
        <h1>Únete al equipo de especialistas <span class="live">ILPIIE&nbsp;Live</span></h1>
        <p>¿Eres experto en inversión pública, contrataciones, obras o peritaje? Completa tu registro para formar parte de la red de asesores técnicos y docentes de ILPIIE Live. Toma menos de 5 minutos.</p>
      </div>

      <div v-if="!enviado" class="steps">
        <div v-for="p in PASOS" :key="p.n" class="st" :class="{ on: paso === p.n, ok: paso > p.n }">
          <span class="n">{{ paso > p.n ? '✓' : p.n }}</span>
          <span>{{ p.label }}</span>
        </div>
      </div>

      <!-- PASO 1: PERFIL -->
      <div v-if="!enviado && paso === 1" class="sec">
        <div class="section-card">
          <div class="section-header">
            <div class="section-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div><div class="section-title">Datos personales y profesionales</div><div class="section-subtitle">Información básica de identificación</div></div>
          </div>
          <div class="form-grid">
            <div class="form-group"><label class="form-label">Nombres y apellidos <span class="required">*</span></label><input v-model="campos.nombre" type="text" placeholder="Ej. Juan Carlos Pérez López" /></div>
            <div class="form-group"><label class="form-label">DNI / CE <span class="required">*</span></label><input v-model="campos.dni" type="text" placeholder="Ej. 12345678" maxlength="12" /></div>
            <div class="form-group">
              <label class="form-label">Correo electrónico <span class="required">*</span></label>
              <input v-model="campos.correo" type="email" placeholder="ejemplo@correo.com" @input="errorCorreo = ''" />
              <div class="err" :class="{ on: !!errorCorreo }">{{ errorCorreo }}</div>
            </div>
            <div class="form-group"><label class="form-label">Teléfono / WhatsApp <span class="required">*</span></label><input v-model="campos.telefono" type="tel" placeholder="Ej. 999 888 777" /></div>
            <div class="form-group"><label class="form-label">Contraseña <span class="required">*</span></label><input v-model="campos.password" type="password" placeholder="Mínimo 8 caracteres" /></div>
            <div class="form-group"><label class="form-label">Confirmar contraseña <span class="required">*</span></label><input v-model="campos.password2" type="password" placeholder="Repite tu contraseña" /></div>
          </div>
          <div class="divider" />
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Profesión <span class="required">*</span></label>
              <select v-model="campos.profesion">
                <option value="">Selecciona tu profesión</option>
                <optgroup v-for="g in GRUPOS_PROFESION" :key="g.grupo" :label="g.grupo">
                  <option v-for="o in g.opciones" :key="o">{{ o }}</option>
                </optgroup>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Nivel académico <span class="required">*</span></label>
              <select v-model="campos.nivelAcademico">
                <option value="">Selecciona tu nivel</option>
                <option v-for="n in NIVELES_ACADEMICOS" :key="n">{{ n }}</option>
              </select>
            </div>
            <div class="form-group"><label class="form-label">N.° de colegiatura / CIP</label><input v-model="campos.colegiatura" type="text" placeholder="Ej. 123456" /></div>
            <div class="form-group">
              <label class="form-label">Años de experiencia <span class="required">*</span></label>
              <select v-model="campos.experiencia">
                <option value="">Selecciona…</option>
                <option v-for="e in EXPERIENCIAS" :key="e">{{ e }}</option>
              </select>
            </div>
            <div class="form-group full-width">
              <label class="form-label">Nivel de especialidad <span class="required">*</span></label>
              <div class="radio-group">
                <label v-for="n in NIVELES_ESPECIALIDAD" :key="n.valor" class="radio-item" :class="{ checked: nivelEspecialidad === n.valor }">
                  <input v-model="nivelEspecialidad" type="radio" name="niv_esp" :value="n.valor" />
                  <span class="lv-ic" v-html="n.icono" />
                  <span>{{ n.valor }} <span class="sub-label">{{ n.sub }}</span></span>
                </label>
              </div>
            </div>
          </div>
          <div class="err" :class="{ on: mostrarError }">{{ MENSAJES_ERROR[1] }}</div>
        </div>
      </div>

      <!-- PASO 2: ESPECIALIDAD -->
      <div v-if="!enviado && paso === 2" class="sec">
        <div class="section-card">
          <div class="section-header">
            <div class="section-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <div><div class="section-title">Áreas y temas de especialización</div><div class="section-subtitle">Selecciona los temas en los que puedes asesorar</div></div>
          </div>
          <div class="form-group full-width">
            <label class="form-label">Temas principales de asesoría <span class="required">*</span> <span class="form-hint">Puedes seleccionar más de uno</span></label>
            <div class="checkbox-group">
              <label v-for="o in temas" :key="o.id" class="checkbox-item" :class="{ checked: temaMarcado(o.id) }">
                <input type="checkbox" :checked="temaMarcado(o.id)" @change="alternarTema(o.id, ($event.target as HTMLInputElement).checked)" />
                <span class="tic" v-html="o.icono" />
                <span>{{ o.nombre }} <span v-if="o.sub" class="sub-label">{{ o.sub }}</span></span>
              </label>
            </div>
          </div>
          <div class="form-group full-width">
            <label class="form-label">Otros temas o subtemas de especialidad</label>
            <textarea v-model="campos.otrosTemas" placeholder="Si seleccionaste 'Otros temas de especialidad' o deseas ampliar tu postulación, descríbelos aquí. Ej: 'Auditoría forense en obras públicas', 'Lavado de activos en contrataciones', 'BIM en proyectos de inversión pública'..." />
          </div>
          <div class="err" :class="{ on: mostrarError }">{{ MENSAJES_ERROR[2] }}</div>
        </div>
      </div>

      <!-- PASO 3: ACTIVIDADES -->
      <div v-if="!enviado && paso === 3" class="sec">
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
          <div class="err" :class="{ on: mostrarError }">{{ MENSAJES_ERROR[3] }}</div>
        </div>
      </div>

      <!-- PASO 4: DISPONIBILIDAD -->
      <div v-if="!enviado && paso === 4" class="sec">
        <div class="section-card">
          <div class="section-header">
            <div class="section-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div><div class="section-title">Disponibilidad horaria</div><div class="section-subtitle">Calendario semanal de lunes a sábado · bloques de una hora</div></div>
          </div>
          <label class="form-label">Día de la semana</label>
          <div class="dias">
            <button v-for="(d, i) in DIAS" :key="d" type="button" class="dia" :class="{ on: diaSeleccionado === i }" @click="diaSeleccionado = i">
              <b>{{ d }}</b>
              <span class="cnt">{{ bloquesDelDia(i) }} bloque{{ bloquesDelDia(i) === 1 ? '' : 's' }}</span>
            </button>
          </div>
          <label class="form-label">Bloques horarios <span style="font-weight: 400; color: var(--texto-muted)">(8:00 a. m. – 10:00 p. m., de una en una hora)</span></label>
          <div class="slots">
            <button
              v-for="h in HORAS"
              :key="h"
              type="button"
              class="sl"
              :class="{ sel: bloqueMarcado(diaSeleccionado, h), off: bloqueBloqueado(diaSeleccionado, h) }"
              @click="alternarBloque(h)"
            >
              {{ formatoHora(h) }} – {{ formatoHora(h + 1) }}
            </button>
          </div>
          <div class="aviso">
            <span v-html="ICONO_RELOJ" />
            <span>Los sábados la atención es solo en la mañana: los bloques desde la 1:00 p. m. aparecen cerrados e inactivos.</span>
          </div>
          <div class="slotsum">
            <template v-if="resumenBloques.length">
              Has seleccionado <b style="color: #fff">{{ totalBloques }}</b> bloques:
              <span v-for="c in resumenBloques" :key="c" class="t">{{ c }}</span>
            </template>
            <template v-else>Selecciona los bloques en los que podrás atender. Puedes elegir varios días y varias horas.</template>
          </div>
          <div class="err" :class="{ on: mostrarError }">{{ MENSAJES_ERROR[4] }}</div>
        </div>
      </div>

      <!-- PASO 5: DOCUMENTOS -->
      <div v-if="!enviado && paso === 5" class="sec">
        <div class="section-card">
          <div class="section-header">
            <div class="section-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <div><div class="section-title">Documentos y presencia profesional</div><div class="section-subtitle">Antecedentes y redes de tu perfil público</div></div>
          </div>
          <div class="form-group full-width">
            <label class="form-label">Currículum Vitae <span class="required">*</span></label>
            <div class="file-upload" @click="abrirSelectorArchivo">
              <span v-html="ICONO_SUBIR" />
              <p>Arrastra tu CV aquí o haz clic para subir</p>
              <span>PDF, DOC o DOCX · Máximo 5 MB</span>
              <input ref="cvInputRef" type="file" accept=".pdf,.doc,.docx" @change="onArchivoCambiado" />
            </div>
            <p v-if="archivoCV" class="form-hint" style="color: var(--verde-claro)">✓ Archivo seleccionado: {{ archivoCV.name }}</p>
          </div>
          <div class="form-grid">
            <div class="form-group"><label class="form-label">LinkedIn</label><input v-model="campos.linkedin" type="url" placeholder="https://linkedin.com/in/tu-perfil" /></div>
            <div class="form-group"><label class="form-label">Otras redes o sitio web</label><input v-model="campos.otrasRedes" type="url" placeholder="Blog, portafolio, ResearchGate..." /></div>
          </div>
          <div class="divider" />
          <div class="form-group full-width">
            <label class="form-label">Comentarios y sugerencias</label>
            <textarea v-model="campos.comentarios" placeholder="Experiencia destacada, casos de éxito, certificaciones, publicaciones relevantes, o cualquier información valiosa para tu postulación..." />
          </div>
          <div class="form-group full-width">
            <label class="checkbox-item" :class="{ checked: aceptaTerminos }">
              <input v-model="aceptaTerminos" type="checkbox" />
              <span>Declaro que la información proporcionada es veraz y autorizo al ILPIIE a verificar mis antecedentes profesionales. Acepto las políticas de confidencialidad y el código de ética del Instituto. <span class="sub-label">Tu información está protegida y será usada exclusivamente para fines de selección de especialistas.</span></span>
            </label>
          </div>
          <div class="err" :class="{ on: mostrarError }">{{ MENSAJES_ERROR[5] }}</div>
        </div>
      </div>

      <!-- PASO 6: CONFIRMAR -->
      <div v-if="!enviado && paso === 6" class="sec">
        <div class="section-card">
          <div class="section-header">
            <div class="section-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div><div class="section-title">Resumen de tu postulación</div><div class="section-subtitle">Verifica la información antes de enviar</div></div>
          </div>
          <div class="rsm">
            <div v-for="fila in filasResumen" :key="fila[0]" class="it"><b>{{ fila[0] }}</b>{{ fila[1] }}</div>
          </div>
          <div class="err" :class="{ on: !!errorEnvio }">{{ errorEnvio }}</div>
        </div>
      </div>

      <!-- ÉXITO -->
      <div v-if="enviado" class="sec">
        <div class="section-card">
          <div class="okbox">
            <div class="ck" v-html="'<svg width=\'30\' height=\'30\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'20 6 9 17 4 12\'/></svg>'" />
            <h2>¡Postulación enviada exitosamente!</h2>
            <p>El equipo de ILPIIE revisará tu perfil y validará tu colegiatura. Te contactaremos en los próximos 5 días hábiles para activar tu cuenta de especialista en ILPIIE Live.</p>
          </div>
        </div>
      </div>

      <div v-if="!enviado" class="nav">
        <button class="btn btn-ghost" type="button" :style="{ visibility: paso === 1 ? 'hidden' : 'visible' }" :disabled="enviando" @click="anterior">← Anterior</button>
        <button class="btn btn-pri" type="button" :class="{ 'btn-red': paso === 6 }" :disabled="enviando" @click="siguiente">
          {{ paso === 6 ? (enviando ? 'Enviando…' : 'Enviar postulación ✓') : 'Siguiente →' }}
        </button>
      </div>

      <div class="form-footer">
        <div class="foot-logo"><img :src="logoIcono" alt="ILPIIE" /></div>
        <div class="logo-footer">Proyecta<span>Fácil</span> · <span class="live">ILPIIE Live</span></div>
        <p>Instituto Latinoamericano de Proyectos de Inversión, Ingeniería y Economía (ILPIIE)</p>
        <p style="margin-top: 2px">Presidente: Econ. José Herrera Jara · www.ilpiie.lat · www.growthcorporation.lat</p>
        <p style="margin-top: 6px; font-size: 11px">© 2026 ILPIIE. Todos los derechos reservados.</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.pagina-especialista {
  --verde: #22c55e;
  --verde-claro: #86efac;
  --verde-oscuro: #16a34a;
  --dorado: #fbbf24;
  --rojo: #ef4444;
  --azul-fondo: #0b1120;
  --azul-card: #0f172a;
  --azul-card-hover: #131c31;
  --azul-borde: #1e293b;
  --azul-input: #1a2332;
  --texto: #e2e8f0;
  --texto-muted: #94a3b8;
  --blanco: #f8fafc;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: var(--azul-fondo);
  color: var(--texto);
  line-height: 1.6;
  min-height: 100vh;
}

/* ===== HEADER ===== */
.header {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(251, 191, 36, 0.03));
  border-bottom: 1px solid var(--azul-borde);
  padding: 14px 0;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
}
.header-inner { max-width: 900px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; }
.header-brand { display: flex; align-items: center; gap: 12px; text-decoration: none; }
.header-brand-logo { width: 40px; height: 40px; object-fit: contain; flex-shrink: 0; }
.header-text .brand-name { font-size: 18px; font-weight: 800; color: var(--blanco); }
.header-text .brand-name span { color: var(--verde); }
.header-text .brand-tag { font-size: 11px; color: var(--texto-muted); }

.header-nav { display: flex; align-items: center; gap: 26px; }
.header-nav a { color: var(--texto); text-decoration: none; font-size: 14px; font-weight: 600; transition: color 0.2s; white-space: nowrap; }
.header-nav a:hover { color: var(--verde); }
.header-live { display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, #f87171, #ef4444); color: #fff; padding: 9px 22px; border-radius: 999px; font-size: 13px; font-weight: 800; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35); }
.header-live:hover { color: #fff; filter: brightness(1.1); }
@media (max-width: 860px) { .header-nav a:not(.header-live) { display: none; } }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: pulse 1.6s infinite; display: inline-block; }
@keyframes pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); } 50% { opacity: 0.6; box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); } }

.lv-ic { width: 38px; height: 38px; flex: none; border-radius: 10px; background: #132a4d; display: flex; align-items: center; justify-content: center; color: #7dd3fc; }
.lv-ic :deep(svg) { stroke: currentColor; }
.radio-item.checked .lv-ic { background: #14532d; color: var(--verde-claro); }
.tic { width: 30px; height: 30px; flex: none; border-radius: 8px; background: #132a4d; display: flex; align-items: center; justify-content: center; color: #7dd3fc; }
.tic :deep(svg) { stroke: currentColor; }
.checkbox-item.checked .tic { background: #14532d; color: var(--verde-claro); }
.foot-logo { display: flex; justify-content: center; margin-bottom: 10px; }
.foot-logo img { width: 44px; height: 44px; border-radius: 50%; object-fit: contain; background: var(--azul-input); }

/* ===== LAYOUT ===== */
.container { max-width: 820px; margin: 0 auto; padding: 36px 24px 60px; }
.form-hero { text-align: center; margin-bottom: 36px; background: radial-gradient(ellipse 70% 90% at 50% 0%, rgba(34, 197, 94, 0.09), transparent 70%); padding: 12px 0 22px; }
.form-hero .label { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; padding: 6px 16px; border-radius: 20px; background: rgba(239, 68, 68, 0.13); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.45); margin-bottom: 14px; }
.form-hero h1 { font-size: 30px; font-weight: 800; color: var(--blanco); line-height: 1.2; margin-bottom: 10px; }
.form-hero h1 .live { color: #f87171; }
.form-hero p { font-size: 15px; color: var(--texto-muted); max-width: 600px; margin: 0 auto; }

/* ===== STEPPER ===== */
.steps { display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 28px; flex-wrap: nowrap; }
@media (max-width: 480px) { .steps { justify-content: flex-start; overflow-x: auto; padding-bottom: 4px; } }
.st { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--texto-muted); }
.st .n { width: 30px; height: 30px; border-radius: 50%; background: var(--azul-borde); border: 2px solid var(--azul-borde); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; transition: all 0.3s; }
.st.on { color: var(--verde-claro); }
.st.on .n { background: linear-gradient(135deg, var(--verde), var(--verde-oscuro)); border-color: var(--verde); color: #052e12; }
.st.ok { color: var(--verde-claro); }
.st.ok .n { background: #14532d; border-color: var(--verde); color: var(--verde-claro); }
.st::after { content: ''; width: 24px; height: 2px; background: var(--azul-borde); margin: 0 6px; border-radius: 1px; }
.st.ok::after { background: var(--verde); }
.st:last-child::after { display: none; }

/* ===== CARDS ===== */
.section-card { background: var(--azul-card); border: 1px solid var(--azul-borde); border-radius: 16px; padding: 28px; margin-bottom: 20px; transition: border-color 0.3s; }
.section-card:focus-within { border-color: var(--verde); box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1); }
.section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px solid var(--azul-borde); }
.section-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(34, 197, 94, 0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.section-icon svg { stroke: var(--verde); }
.section-title { font-size: 16px; font-weight: 700; color: var(--blanco); }
.section-subtitle { font-size: 12px; color: var(--texto-muted); margin-top: 1px; }

/* ===== FORM ===== */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
.form-group { margin-bottom: 16px; }
.form-group.full-width { grid-column: 1 / -1; }
.form-label { display: block; font-size: 13px; font-weight: 600; color: var(--blanco); margin-bottom: 8px; }
.form-label .required { color: var(--verde); margin-left: 2px; }
.form-hint { font-size: 11px; color: var(--texto-muted); margin-top: 5px; }
.pagina-especialista :deep(input[type='text']),
.pagina-especialista :deep(input[type='email']),
.pagina-especialista :deep(input[type='tel']),
.pagina-especialista :deep(input[type='url']),
.pagina-especialista :deep(input[type='password']),
.pagina-especialista :deep(select),
.pagina-especialista :deep(textarea) {
  width: 100%;
  padding: 11px 14px;
  background: var(--azul-input);
  border: 1px solid var(--azul-borde);
  border-radius: 10px;
  color: var(--texto);
  font-size: 14px;
  font-family: inherit;
  transition: all 0.2s;
  outline: none;
}
.pagina-especialista :deep(input::placeholder),
.pagina-especialista :deep(textarea::placeholder) { color: #64748b; }
.pagina-especialista :deep(input:focus),
.pagina-especialista :deep(select:focus),
.pagina-especialista :deep(textarea:focus) { border-color: var(--verde); box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1); }
.pagina-especialista :deep(select) {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
}
.pagina-especialista :deep(select option) { background: var(--azul-card); color: var(--texto); }
.pagina-especialista :deep(textarea) { resize: vertical; min-height: 90px; }

/* ===== CHECKBOX / RADIO ===== */
.checkbox-group, .radio-group { display: flex; flex-direction: column; gap: 8px; }
.checkbox-item, .radio-item { display: flex; align-items: flex-start; gap: 10px; padding: 11px 14px; background: var(--azul-input); border: 1px solid var(--azul-borde); border-radius: 10px; cursor: pointer; transition: all 0.2s; }
.checkbox-item:hover, .radio-item:hover { border-color: rgba(34, 197, 94, 0.35); background: var(--azul-card-hover); }
.checkbox-item input, .radio-item input { width: 18px; height: 18px; accent-color: var(--verde); margin-top: 2px; flex-shrink: 0; cursor: pointer; }
.checkbox-item > span:last-child, .radio-item > span:last-child { font-size: 13px; color: var(--texto); cursor: pointer; line-height: 1.4; }
.sub-label { font-size: 11px; color: var(--texto-muted); display: block; margin-top: 2px; }
.checkbox-item.checked, .radio-item.checked { border-color: var(--verde); background: rgba(34, 197, 94, 0.07); }

/* ===== ACTIVIDADES ===== */
.acts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 600px) { .acts { grid-template-columns: 1fr; } }
.act { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border: 1px solid var(--azul-borde); border-radius: 10px; background: var(--azul-input); cursor: pointer; transition: all 0.2s; }
.act:hover { border-color: rgba(34, 197, 94, 0.35); }
.act.checked { border-color: var(--verde); background: rgba(34, 197, 94, 0.07); }
.act .ic { width: 34px; height: 34px; flex: none; border-radius: 8px; background: #132a4d; display: flex; align-items: center; justify-content: center; color: #7dd3fc; }
.act.checked .ic { background: #14532d; color: var(--verde-claro); }
.act b { font-size: 13px; display: block; color: var(--blanco); }
.act span { font-size: 11px; color: var(--texto-muted); }

/* ===== CALENDARIO ===== */
.dias { display: flex; gap: 8px; margin: 6px 0 14px; flex-wrap: wrap; }
.dia { flex: 1; min-width: 80px; padding: 9px 6px; border-radius: 10px; border: 1px solid var(--azul-borde); background: var(--azul-input); color: var(--texto); cursor: pointer; text-align: center; font-size: 12px; font-family: inherit; transition: all 0.2s; }
.dia b { display: block; font-size: 13px; }
.dia .cnt { display: block; color: var(--texto-muted); font-size: 11px; margin-top: 2px; }
.dia.on { border-color: var(--verde); background: rgba(34, 197, 94, 0.14); }
.dia.on .cnt { color: var(--verde-claro); }
.slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.sl { padding: 9px 4px; text-align: center; border-radius: 9px; border: 1px solid var(--azul-borde); background: var(--azul-input); color: var(--texto); cursor: pointer; font-size: 12px; font-variant-numeric: tabular-nums; font-family: inherit; transition: all 0.2s; }
.sl:hover { border-color: rgba(34, 197, 94, 0.45); }
.sl.sel { background: var(--verde-oscuro); border-color: var(--verde); color: #fff; font-weight: 600; }
.sl.off { opacity: 0.35; cursor: not-allowed; text-decoration: line-through; background: #0a1424; }
.sl.off:hover { border-color: var(--azul-borde); }
.aviso { display: flex; gap: 8px; align-items: flex-start; margin-top: 12px; padding: 10px 12px; border: 1px solid rgba(251, 191, 36, 0.35); background: rgba(251, 191, 36, 0.07); border-radius: 10px; color: #fcd34d; font-size: 12px; }
.slotsum { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12px; color: var(--texto-muted); }
.slotsum .t { background: #132a4d; border-radius: 6px; padding: 3px 8px; color: var(--texto); }

/* ===== UPLOAD ===== */
.file-upload { border: 2px dashed var(--azul-borde); border-radius: 12px; padding: 28px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--azul-input); }
.file-upload:hover { border-color: var(--verde); background: rgba(34, 197, 94, 0.04); }
.file-upload :deep(svg) { margin-bottom: 10px; stroke: var(--verde); }
.file-upload p { font-size: 14px; color: var(--blanco); font-weight: 600; }
.file-upload > span { font-size: 12px; color: var(--texto-muted); }
.file-upload input[type='file'] { display: none; }

/* ===== NAV ===== */
.err { color: #f87171; font-size: 12px; margin-top: 10px; display: none; }
.err.on { display: block; }
.nav { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; padding-top: 20px; border-top: 1px solid var(--azul-borde); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; transition: all 0.25s; cursor: pointer; border: none; font-family: inherit; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; }
.btn-pri { background: linear-gradient(135deg, var(--verde), var(--verde-oscuro)); color: #fff; box-shadow: 0 8px 24px rgba(34, 197, 94, 0.25); }
.btn-pri:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(34, 197, 94, 0.35); }
.btn-pri.btn-red { background: linear-gradient(135deg, #f87171, #ef4444); box-shadow: 0 8px 24px rgba(239, 68, 68, 0.3); }
.btn-pri.btn-red:hover { box-shadow: 0 12px 32px rgba(239, 68, 68, 0.4); }
.btn-ghost { background: transparent; color: var(--verde-claro); border: 2px solid var(--verde); }
.btn-ghost:hover { background: var(--verde); color: #052e12; }

/* ===== RESUMEN / OK ===== */
.rsm { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
@media (max-width: 600px) { .rsm { grid-template-columns: 1fr; } }
.rsm .it { background: var(--azul-input); border: 1px solid var(--azul-borde); border-radius: 10px; padding: 10px 12px; font-size: 13px; }
.rsm .it b { font-size: 10px; color: var(--texto-muted); text-transform: uppercase; letter-spacing: 0.06em; display: block; margin-bottom: 3px; }
.okbox { text-align: center; padding: 40px 16px; }
.okbox .ck { width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 50%; background: #450a0a; color: #f87171; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.12); }
.okbox h2 { font-size: 20px; font-weight: 800; color: var(--blanco); margin: 0 0 8px; }
.okbox p { color: var(--texto-muted); font-size: 14px; max-width: 440px; margin: 0 auto; }
.divider { height: 1px; background: var(--azul-borde); margin: 20px 0; }
.form-footer { text-align: center; padding: 24px 0 8px; border-top: 1px solid var(--azul-borde); margin-top: 36px; }
.form-footer .logo-footer { font-weight: 800; font-size: 16px; color: var(--blanco); margin-bottom: 4px; }
.form-footer .logo-footer span { color: var(--verde); }
.form-footer p { font-size: 12px; color: var(--texto-muted); }
@media (max-width: 600px) { .form-hero h1 { font-size: 24px; } .section-card { padding: 20px; } .st span:last-child { display: none; } }
</style>
