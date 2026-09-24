<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import logoIcono from '@/assets/logo-icono.png';
import { DIAS, HORAS, bloqueMarcado, totalBloques as calcularTotalBloques, listaDisponibilidad as calcularListaDisponibilidad } from './especialistaDisponibilidad';
import { leerSesionPostulacion, guardarSesionPostulacion, borrarSesionPostulacion } from '@/lib/postulacionEspecialistaSesion';
import PasoPerfil from './PasoPerfil.vue';
import PasoEspecialidad from './PasoEspecialidad.vue';
import PasoActividades from './PasoActividades.vue';
import PasoDisponibilidad from './PasoDisponibilidad.vue';
import PasoDocumentos from './PasoDocumentos.vue';
import PasoConfirmar from './PasoConfirmar.vue';
import PostulacionExitosa from './PostulacionExitosa.vue';

// Página de postulación de especialistas para ILPIIE Live — réplica fiel del mockup
// "registro-especialistas-ilpiie-live-v4.html" que compartió el cliente. Los temas de asesoría
// (paso 2) se traen del catálogo real (mismo endpoint público que usa RegistroPage.vue,
// /api/temas-especialidad/publico) en vez de una lista hardcodeada — así no puede desalinearse
// del catálogo real ni de los `candidato_temas_especialidad` que guarda el backend. El envío
// final (paso 6) postula de verdad contra POST /api/candidatos (multipart: CV + JSON), sin token
// — es un formulario público, igual que auth/registro.
//
// Un componente por paso del wizard (PasoPerfil, PasoEspecialidad, ...): este archivo solo
// mantiene el estado compartido entre pasos y la orquestación (navegación, fetch de temas, envío
// final) — ver memoria "Componentes frontend modulados".

interface OpcionTema {
  id: number;
  nombre: string;
  sub: string;
  icono: string;
}

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

const PASOS = [
  { n: 1, label: 'Perfil' },
  { n: 2, label: 'Especialidad' },
  { n: 3, label: 'Actividades' },
  { n: 4, label: 'Disponibilidad' },
  { n: 5, label: 'Documentos' },
  { n: 6, label: 'Confirmar' },
];

const paso = ref(1);
const enviado = ref(false);
const enviando = ref(false);
const errorEnvio = ref('');
const errorCorreo = ref('');
const mostrarError = ref(false);
const diaSeleccionado = ref(0);

const campos = reactive({
  nombre: '',
  dni: '',
  correo: '',
  telefono: '',
  password: '',
  password2: '',
  profesion: '',
  profesionOtra: '',
  nivelAcademico: '',
  experiencia: '',
  otrosTemas: '',
  linkedin: '',
  otrasRedes: '',
  comentarios: '',
});
// "Otras" en el select revela un campo libre (ver PasoPerfil.vue) — el valor final que se guarda
// y se muestra es ese texto, nunca el literal "Otras".
const profesionTexto = computed(() => (campos.profesion === 'Otras' ? campos.profesionOtra.trim() : campos.profesion));
const nivelEspecialidad = ref('');
const temasSeleccionados = ref<number[]>([]);
// No es un id del catálogo (no viaja en temaIds) — solo revela el textarea de "otros temas" en
// PasoEspecialidad.vue, igual que el checkbox homónimo del mockup del cliente.
const otrosTemasSeleccionado = ref(false);
const actividadesSeleccionadas = ref<string[]>([]);
const bloques = reactive<Record<string, boolean>>({});
const aceptaTerminos = ref(false);
const archivoCV = ref<File | null>(null);

const totalBloques = computed(() => calcularTotalBloques(bloques));
const listaDisponibilidad = computed(() => calcularListaDisponibilidad(bloques));

// Restaura el progreso guardado (si hay) — nunca incluye password/password2 ni el CV (ver
// lib/postulacionEspecialistaSesion.ts). Si el CV falta y el progreso guardado llegaba hasta
// "Confirmar", se retrocede a "Documentos" para que vuelva a adjuntarlo antes de enviar.
const sesionGuardada = leerSesionPostulacion();
if (sesionGuardada) {
  Object.assign(campos, sesionGuardada.campos);
  nivelEspecialidad.value = sesionGuardada.nivelEspecialidad;
  temasSeleccionados.value = sesionGuardada.temasSeleccionados;
  otrosTemasSeleccionado.value = sesionGuardada.otrosTemasSeleccionado;
  actividadesSeleccionadas.value = sesionGuardada.actividadesSeleccionadas;
  Object.assign(bloques, sesionGuardada.bloques);
  aceptaTerminos.value = sesionGuardada.aceptaTerminos;
  paso.value = sesionGuardada.paso === 6 ? 5 : sesionGuardada.paso;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  [campos, nivelEspecialidad, temasSeleccionados, otrosTemasSeleccionado, actividadesSeleccionadas, bloques, aceptaTerminos, paso],
  () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const { password: _password, password2: _password2, ...camposPersistibles } = campos;
      guardarSesionPostulacion({
        paso: paso.value,
        campos: camposPersistibles,
        nivelEspecialidad: nivelEspecialidad.value,
        temasSeleccionados: temasSeleccionados.value,
        otrosTemasSeleccionado: otrosTemasSeleccionado.value,
        actividadesSeleccionadas: actividadesSeleccionadas.value,
        bloques: { ...bloques },
        aceptaTerminos: aceptaTerminos.value,
      });
    }, 300);
  },
  { deep: true },
);

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
        (campos.profesion !== 'Otras' || campos.profesionOtra.trim().length > 2) &&
        !!campos.nivelAcademico &&
        !!campos.experiencia &&
        !!nivelEspecialidad.value
      );
    case 2: {
      const algunTemaOOtros = temasSeleccionados.value.length > 0 || otrosTemasSeleccionado.value;
      const otrosOk = !otrosTemasSeleccionado.value || campos.otrosTemas.trim().length > 3;
      return algunTemaOOtros && otrosOk;
    }
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
        if (bloqueMarcado(bloques, d, h)) disponibilidad.push({ dia: d + 1, hora: h });
      });
    });

    const datos = {
      nombre: campos.nombre.trim(),
      dni: campos.dni.trim(),
      correo: campos.correo.trim(),
      telefono: campos.telefono.trim(),
      password: campos.password,
      profesion: profesionTexto.value,
      nivelAcademico: campos.nivelAcademico,
      colegiatura: '', // ya no se recolecta en el formulario (mockup v4 del cliente la quitó)
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
    borrarSesionPostulacion();
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

const filasResumen = computed<[string, string][]>(() => [
  ['Especialista', campos.nombre || '—'],
  ['DNI / CE', campos.dni || '—'],
  ['Correo', campos.correo || '—'],
  ['Teléfono', campos.telefono || '—'],
  ['Profesión', profesionTexto.value || '—'],
  ['Nivel académico / especialidad', `${campos.nivelAcademico || '—'} · ${nivelEspecialidad.value || '—'}`],
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
        <div class="label"><span class="live-dot" />Postulación abierta</div>
        <h1>Únete al equipo de especialistas <span class="live">ILPIIE&nbsp;Live</span></h1>
        <p>¿Eres experto en inversión pública, contrataciones, obras o peritaje? Completa tu registro para formar parte de la red de asesores técnicos y docentes de ILPIIE Live. Toma menos de 5 minutos.</p>
      </div>

      <div v-if="!enviado" class="steps">
        <div v-for="p in PASOS" :key="p.n" class="st" :class="{ on: paso === p.n, ok: paso > p.n }">
          <span class="n">{{ paso > p.n ? '✓' : p.n }}</span>
          <span>{{ p.label }}</span>
        </div>
      </div>

      <PasoPerfil
        v-if="!enviado && paso === 1"
        :campos="campos"
        :mostrar-error="mostrarError"
        v-model:nivel-especialidad="nivelEspecialidad"
        v-model:error-correo="errorCorreo"
      />
      <PasoEspecialidad
        v-else-if="!enviado && paso === 2"
        :temas="temas"
        :campos="campos"
        :mostrar-error="mostrarError"
        v-model:temas-seleccionados="temasSeleccionados"
        v-model:otros-seleccionado="otrosTemasSeleccionado"
      />
      <PasoActividades
        v-else-if="!enviado && paso === 3"
        :mostrar-error="mostrarError"
        v-model:actividades-seleccionadas="actividadesSeleccionadas"
      />
      <PasoDisponibilidad
        v-else-if="!enviado && paso === 4"
        :bloques="bloques"
        :mostrar-error="mostrarError"
        v-model:dia-seleccionado="diaSeleccionado"
      />
      <PasoDocumentos
        v-else-if="!enviado && paso === 5"
        :campos="campos"
        :mostrar-error="mostrarError"
        v-model:archivo-cv="archivoCV"
        v-model:acepta-terminos="aceptaTerminos"
      />
      <PasoConfirmar v-else-if="!enviado && paso === 6" :filas="filasResumen" :error-envio="errorEnvio" />

      <PostulacionExitosa v-if="enviado" />

      <div v-if="!enviado" class="nav">
        <button class="btn btn-ghost" type="button" :style="{ visibility: paso === 1 ? 'hidden' : 'visible' }" :disabled="enviando" @click="anterior">← Anterior</button>
        <button class="btn btn-pri" type="button" :class="{ 'btn-red': paso === 6 }" :disabled="enviando" @click="siguiente">
          <svg v-if="enviando" class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 3a9 9 0 100 18 9 9 0 000-18" stroke-opacity=".25"/><path d="M12 3a9 9 0 019 9"/></svg>
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

<style>
/* Sin `scoped`: las clases de este bloque se comparten entre esta página y sus subcomponentes de
   paso (PasoPerfil, PasoEspecialidad, ...) — con `scoped` no llegarían a los elementos internos
   de esos componentes hijos. Los nombres de clase son específicos de esta página pública y no
   colisionan con el resto de la app. */
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
.pagina-especialista .header {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(251, 191, 36, 0.03));
  border-bottom: 1px solid var(--azul-borde);
  padding: 14px 0;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
}
.pagina-especialista .header-inner { max-width: 900px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; }
.pagina-especialista .header-brand { display: flex; align-items: center; gap: 12px; text-decoration: none; }
.pagina-especialista .header-brand-logo { width: 80px; height: 80px; object-fit: contain; flex-shrink: 0; }
.pagina-especialista .header-text .brand-name { font-size: 27px; font-weight: 800; color: var(--blanco); line-height: 1.15; }
.pagina-especialista .header-text .brand-name span { color: var(--verde); }
.pagina-especialista .header-text .brand-tag { font-size: 9px; color: var(--texto-muted); line-height: 1.15; }

.pagina-especialista .header-nav { display: flex; align-items: center; gap: 26px; }
.pagina-especialista .header-nav a { color: var(--texto); text-decoration: none; font-size: 14px; font-weight: 600; transition: color 0.2s; white-space: nowrap; }
.pagina-especialista .header-nav a:hover { color: var(--verde); }
.pagina-especialista .header-live { display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, #f87171, #ef4444); color: #fff; padding: 9px 22px; border-radius: 999px; font-size: 13px; font-weight: 800; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35); }
.pagina-especialista .header-live:hover { color: #fff; filter: brightness(1.1); }
@media (max-width: 860px) { .pagina-especialista .header-nav a:not(.header-live) { display: none; } }
.pagina-especialista .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: pulse 1.6s infinite; display: inline-block; }
@keyframes pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); } 50% { opacity: 0.6; box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); } }

.pagina-especialista .lv-ic { width: 38px; height: 38px; flex: none; border-radius: 10px; background: #132a4d; display: flex; align-items: center; justify-content: center; color: #7dd3fc; }
.pagina-especialista .lv-ic svg { stroke: currentColor; }
.pagina-especialista .radio-item.checked .lv-ic { background: #14532d; color: var(--verde-claro); }
.pagina-especialista .tic { width: 30px; height: 30px; flex: none; border-radius: 8px; background: #132a4d; display: flex; align-items: center; justify-content: center; color: #7dd3fc; }
.pagina-especialista .tic svg { stroke: currentColor; }
.pagina-especialista .checkbox-item.checked .tic { background: #14532d; color: var(--verde-claro); }
.pagina-especialista .foot-logo { display: flex; justify-content: center; margin-bottom: 10px; }
.pagina-especialista .foot-logo img { width: 44px; height: 44px; border-radius: 50%; object-fit: contain; background: var(--azul-input); }

/* ===== LAYOUT ===== */
.pagina-especialista .container { max-width: 820px; margin: 0 auto; padding: 36px 24px 60px; }
.pagina-especialista .form-hero { text-align: center; margin-bottom: 36px; background: radial-gradient(ellipse 70% 90% at 50% 0%, rgba(34, 197, 94, 0.09), transparent 70%); padding: 12px 0 22px; }
.pagina-especialista .form-hero .label { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; padding: 6px 16px; border-radius: 20px; background: rgba(34, 197, 94, 0.13); color: var(--verde-claro); border: 1px solid rgba(34, 197, 94, 0.45); margin-bottom: 14px; }
.pagina-especialista .form-hero .label .live-dot { background: #22c55e; animation: pulseG 1.6s infinite; }
@keyframes pulseG { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); } 50% { opacity: 0.6; box-shadow: 0 0 0 5px rgba(34, 197, 94, 0); } }
.pagina-especialista .spin { animation: girar 0.7s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }
.pagina-especialista .form-hero h1 { font-size: 30px; font-weight: 800; color: var(--blanco); line-height: 1.2; margin-bottom: 10px; }
.pagina-especialista .form-hero h1 .live { color: #f87171; }
.pagina-especialista .form-hero p { font-size: 15px; color: var(--texto-muted); max-width: 600px; margin: 0 auto; }

/* ===== STEPPER ===== */
.pagina-especialista .steps { display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 28px; flex-wrap: nowrap; }
@media (max-width: 480px) { .pagina-especialista .steps { justify-content: flex-start; overflow-x: auto; padding-bottom: 4px; } }
.pagina-especialista .st { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--texto-muted); }
.pagina-especialista .st .n { width: 30px; height: 30px; border-radius: 50%; background: var(--azul-borde); border: 2px solid var(--azul-borde); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; transition: all 0.3s; }
.pagina-especialista .st.on { color: var(--verde-claro); }
.pagina-especialista .st.on .n { background: linear-gradient(135deg, var(--verde), var(--verde-oscuro)); border-color: var(--verde); color: #052e12; }
.pagina-especialista .st.ok { color: var(--verde-claro); }
.pagina-especialista .st.ok .n { background: #14532d; border-color: var(--verde); color: var(--verde-claro); }
.pagina-especialista .st::after { content: ''; width: 24px; height: 2px; background: var(--azul-borde); margin: 0 6px; border-radius: 1px; }
.pagina-especialista .st.ok::after { background: var(--verde); }
.pagina-especialista .st:last-child::after { display: none; }

/* ===== CARDS ===== */
.pagina-especialista .section-card { background: var(--azul-card); border: 1px solid var(--azul-borde); border-radius: 16px; padding: 28px; margin-bottom: 20px; transition: border-color 0.3s; }
.pagina-especialista .section-card:focus-within { border-color: var(--verde); box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1); }
.pagina-especialista .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; padding: 13px 16px; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.28); border-radius: 12px; }
.pagina-especialista .section-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(34, 197, 94, 0.16); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pagina-especialista .section-icon svg { stroke: var(--verde); }
.pagina-especialista .section-title { font-size: 13.5px; font-weight: 800; color: var(--blanco); text-transform: uppercase; letter-spacing: 0.6px; }
.pagina-especialista .section-subtitle { font-size: 11.5px; color: var(--verde-claro); margin-top: 2px; }

/* ===== FORM ===== */
.pagina-especialista .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 600px) { .pagina-especialista .form-grid { grid-template-columns: 1fr; } }
.pagina-especialista .form-group { margin-bottom: 16px; }
.pagina-especialista .form-group.full-width { grid-column: 1 / -1; }
.pagina-especialista .form-label { display: block; font-size: 13px; font-weight: 600; color: var(--blanco); margin-bottom: 8px; }
.pagina-especialista .form-label .required { color: var(--verde); margin-left: 2px; }
.pagina-especialista .form-hint { font-size: 11px; color: var(--texto-muted); margin-top: 5px; }
.pagina-especialista input[type='text'],
.pagina-especialista input[type='email'],
.pagina-especialista input[type='tel'],
.pagina-especialista input[type='url'],
.pagina-especialista input[type='password'],
.pagina-especialista select,
.pagina-especialista textarea {
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
.pagina-especialista input::placeholder,
.pagina-especialista textarea::placeholder { color: #64748b; }
.pagina-especialista input:focus,
.pagina-especialista select:focus,
.pagina-especialista textarea:focus { border-color: var(--verde); box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1); }
.pagina-especialista select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
}
.pagina-especialista select option { background: var(--azul-card); color: var(--texto); }
.pagina-especialista textarea { resize: vertical; min-height: 90px; }

/* ===== CHECKBOX / RADIO ===== */
.pagina-especialista .checkbox-group, .pagina-especialista .radio-group { display: flex; flex-direction: column; gap: 8px; }
.pagina-especialista .checkbox-item, .pagina-especialista .radio-item { display: flex; align-items: flex-start; gap: 10px; padding: 11px 14px; background: var(--azul-input); border: 1px solid var(--azul-borde); border-radius: 10px; cursor: pointer; transition: all 0.2s; }
.pagina-especialista .checkbox-item:hover, .pagina-especialista .radio-item:hover { border-color: rgba(34, 197, 94, 0.35); background: var(--azul-card-hover); }
.pagina-especialista .checkbox-item input, .pagina-especialista .radio-item input { width: 18px; height: 18px; accent-color: var(--verde); margin-top: 2px; flex-shrink: 0; cursor: pointer; }
.pagina-especialista .checkbox-item > span:last-child, .pagina-especialista .radio-item > span:last-child { font-size: 13px; color: var(--texto); cursor: pointer; line-height: 1.4; }
.pagina-especialista .sub-label { font-size: 11px; color: var(--texto-muted); display: block; margin-top: 2px; }
.pagina-especialista .checkbox-item.checked, .pagina-especialista .radio-item.checked { border-color: var(--verde); background: rgba(34, 197, 94, 0.07); }

/* ===== ACTIVIDADES ===== */
.pagina-especialista .acts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 600px) { .pagina-especialista .acts { grid-template-columns: 1fr; } }
.pagina-especialista .act { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border: 1px solid var(--azul-borde); border-radius: 10px; background: var(--azul-input); cursor: pointer; transition: all 0.2s; }
.pagina-especialista .act:hover { border-color: rgba(34, 197, 94, 0.35); }
.pagina-especialista .act.checked { border-color: var(--verde); background: rgba(34, 197, 94, 0.07); }
.pagina-especialista .act .ic { width: 34px; height: 34px; flex: none; border-radius: 8px; background: #132a4d; display: flex; align-items: center; justify-content: center; color: #7dd3fc; }
.pagina-especialista .act.checked .ic { background: #14532d; color: var(--verde-claro); }
.pagina-especialista .act b { font-size: 13px; display: block; color: var(--blanco); }
.pagina-especialista .act span { font-size: 11px; color: var(--texto-muted); }

/* ===== CALENDARIO ===== */
.pagina-especialista .dias { display: flex; gap: 8px; margin: 6px 0 14px; flex-wrap: wrap; }
.pagina-especialista .dia { flex: 1; min-width: 80px; padding: 9px 6px; border-radius: 10px; border: 1px solid var(--azul-borde); background: var(--azul-input); color: var(--texto); cursor: pointer; text-align: center; font-size: 12px; font-family: inherit; transition: all 0.2s; }
.pagina-especialista .dia b { display: block; font-size: 13px; }
.pagina-especialista .dia .cnt { display: block; color: var(--texto-muted); font-size: 11px; margin-top: 2px; }
.pagina-especialista .dia.on { border-color: var(--verde); background: rgba(34, 197, 94, 0.14); }
.pagina-especialista .dia.on .cnt { color: var(--verde-claro); }
.pagina-especialista .slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.pagina-especialista .sl { padding: 9px 4px; text-align: center; border-radius: 9px; border: 1px solid var(--azul-borde); background: var(--azul-input); color: var(--texto); cursor: pointer; font-size: 12px; font-variant-numeric: tabular-nums; font-family: inherit; transition: all 0.2s; }
.pagina-especialista .sl:hover { border-color: rgba(34, 197, 94, 0.45); }
.pagina-especialista .sl.sel { background: var(--verde-oscuro); border-color: var(--verde); color: #fff; font-weight: 600; }
.pagina-especialista .sl.off { opacity: 0.35; cursor: not-allowed; text-decoration: line-through; background: #0a1424; }
.pagina-especialista .sl.off:hover { border-color: var(--azul-borde); }
.pagina-especialista .aviso { display: flex; gap: 8px; align-items: flex-start; margin-top: 12px; padding: 10px 12px; border: 1px solid rgba(251, 191, 36, 0.35); background: rgba(251, 191, 36, 0.07); border-radius: 10px; color: #fcd34d; font-size: 12px; }
.pagina-especialista .slotsum { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12px; color: var(--texto-muted); }
.pagina-especialista .slotsum .t { background: #132a4d; border-radius: 6px; padding: 3px 8px; color: var(--texto); }

/* ===== UPLOAD ===== */
.pagina-especialista .file-upload { border: 2px dashed var(--azul-borde); border-radius: 12px; padding: 28px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--azul-input); }
.pagina-especialista .file-upload:hover { border-color: var(--verde); background: rgba(34, 197, 94, 0.04); }
.pagina-especialista .file-upload.dragover { border-color: var(--verde); background: rgba(34, 197, 94, 0.1); border-style: solid; }
/* display: inline-block (no solo margin) — Tailwind pone `svg{display:block}` en su preflight, y un
   <svg> block dentro del <span> que envuelve el ícono (v-html) fuerza a ese span a layout de bloque,
   rompiendo el text-align:center del contenedor. inline-block deja que el centrado funcione. */
.pagina-especialista .file-upload svg { display: inline-block; margin-bottom: 10px; stroke: var(--verde); }
.pagina-especialista .file-upload p { font-size: 14px; color: var(--blanco); font-weight: 600; }
.pagina-especialista .file-upload > span { font-size: 12px; color: var(--texto-muted); }
.pagina-especialista .file-upload input[type='file'] { display: none; }

/* ===== NAV ===== */
.pagina-especialista .err { color: #f87171; font-size: 12px; margin-top: 10px; display: none; }
.pagina-especialista .err.on { display: block; }
.pagina-especialista .nav { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; padding-top: 20px; border-top: 1px solid var(--azul-borde); }
.pagina-especialista .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; transition: all 0.25s; cursor: pointer; border: none; font-family: inherit; }
.pagina-especialista .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; }
.pagina-especialista .btn-pri { background: linear-gradient(135deg, var(--verde), var(--verde-oscuro)); color: #fff; box-shadow: 0 8px 24px rgba(34, 197, 94, 0.25); }
.pagina-especialista .btn-pri:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(34, 197, 94, 0.35); }
.pagina-especialista .btn-pri.btn-red { background: linear-gradient(135deg, #f87171, #ef4444); box-shadow: 0 8px 24px rgba(239, 68, 68, 0.3); }
.pagina-especialista .btn-pri.btn-red:hover { box-shadow: 0 12px 32px rgba(239, 68, 68, 0.4); }
.pagina-especialista .btn-ghost { background: transparent; color: var(--verde-claro); border: 2px solid var(--verde); }
.pagina-especialista .btn-ghost:hover { background: var(--verde); color: #052e12; }

/* ===== RESUMEN / OK ===== */
.pagina-especialista .rsm { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
@media (max-width: 600px) { .pagina-especialista .rsm { grid-template-columns: 1fr; } }
.pagina-especialista .rsm .it { background: var(--azul-input); border: 1px solid var(--azul-borde); border-radius: 10px; padding: 10px 12px; font-size: 13px; }
.pagina-especialista .rsm .it b { font-size: 10px; color: var(--texto-muted); text-transform: uppercase; letter-spacing: 0.06em; display: block; margin-bottom: 3px; }
.pagina-especialista .okbox { text-align: center; padding: 40px 16px; }
.pagina-especialista .okbox .ck { width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 50%; background: #14532d; color: #4ade80; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.15); }
.pagina-especialista .okbox h2 { font-size: 20px; font-weight: 800; color: var(--blanco); margin: 0 0 8px; }
.pagina-especialista .okbox p { color: var(--texto-muted); font-size: 14px; max-width: 440px; margin: 0 auto; }
.pagina-especialista .divider { height: 1px; background: var(--azul-borde); margin: 20px 0; }
.pagina-especialista .form-footer { text-align: center; padding: 24px 0 8px; border-top: 1px solid var(--azul-borde); margin-top: 36px; }
.pagina-especialista .form-footer .logo-footer { font-weight: 800; font-size: 16px; color: var(--blanco); margin-bottom: 4px; }
.pagina-especialista .form-footer .logo-footer span { color: var(--verde); }
.pagina-especialista .form-footer p { font-size: 12px; color: var(--texto-muted); }
@media (max-width: 600px) { .pagina-especialista .form-hero h1 { font-size: 24px; } .pagina-especialista .section-card { padding: 20px; } .pagina-especialista .st span:last-child { display: none; } }
</style>
