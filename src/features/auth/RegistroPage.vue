<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faUser, faLock, faEye, faEyeSlash, faCircleExclamation, faCheck, faXmark,
  faChevronLeft, faChevronRight, faChevronDown, faChevronUp, faShieldHalved,
  faEnvelope, faUserPlus, faGraduationCap, faBriefcase, faBook, faGlobe,
  faBullseye, faLightbulb,
} from '@/lib/icons';
import { authApi } from '@/api/auth';
import AuthBrandPanel from './AuthBrandPanel.vue';
import logoClaro from '@/assets/logo-horizontal-claro.png';

interface SubtemaPublico {
  id: string;
  nombre: string;
}

interface TemaPublico {
  id: string;
  nombre: string;
  codigo: string;
  icono: string;
  colorAccent: string;
  descripcion?: string | null;
  subtemas: SubtemaPublico[];
}

// Mismas 4 categorías que usó el cliente para explicar quién es "Completa" y quién es "Parcial" —
// acá es solo una preferencia informativa (preferencia_registro), sin ningún efecto en permisos:
// origen siempre queda en 'externo' para el registro público (ver AuthController::register()).
// "Alumno" real solo lo asigna un admin, porque son alumnos verificados del cliente.
const PREFERENCIAS = [
  'Alumno de un curso de proyectos',
  'Funcionario o consultor de proyectos',
  'Alumno de otro curso',
  'Público en general',
];
const PREFERENCIA_HINTS = [
  'Acceso incluido con tu matrícula ILPIIE',
  'Membresía mensual o anual',
  'Acceso limitado a formatos',
  'Plan gratuito de exploración',
];
// Manual de diseño v1.0, Figura 6: "tarjetas-radio con icono ilustrado (birrete, maletín, libro,
// globo)" — un ícono por cada una de las 4 preferencias reales de arriba, en el mismo orden.
const PREFERENCIA_ICONOS = [faGraduationCap, faBriefcase, faBook, faGlobe];

const paso = ref<1 | 2 | 3>(1);
const nombre = ref('');
const correo = ref('');
const password = ref('');
const confirmarPassword = ref('');
const mostrarPassword = ref(false);
const mostrarConfirmar = ref(false);
const preferencia = ref(PREFERENCIAS[0]);
const subtemaIdsSeleccionados = ref<Set<string>>(new Set());
const temasExpandidos = ref<Set<string>>(new Set());
const aceptaTerminos = ref(false);
const error = ref('');
const enviando = ref(false);
const registrado = ref(false);

const temas = ref<TemaPublico[]>([]);
onMounted(async () => {
  try {
    const res = await fetch('/api/temas-especialidad/publico');
    temas.value = res.ok ? await res.json() : [];
    // Abre el primer tema para que el acordeón no arranque todo colapsado (como el mock).
    const primero = temas.value.find((t) => t.subtemas.length > 0);
    if (primero) temasExpandidos.value = new Set([primero.id]);
  } catch {
    temas.value = [];
  }
});

// Manual de diseño v1.0, Figura 6: validación en línea por campo (borde + check/X + mensaje) en
// vez de un único banner de error arriba. `*Tocado` evita marcar en rojo un campo vacío que el
// usuario todavía no llegó a escribir.
const nombreTocado = ref(false);
const correoTocado = ref(false);
const passwordTocado = ref(false);
const confirmarTocado = ref(false);

const nombreValido = computed(() => nombre.value.trim().length > 0);
const correoValido = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.value.trim()));
const passwordValida = computed(() => password.value.length >= 8);
const confirmarValida = computed(() => confirmarPassword.value.length > 0 && confirmarPassword.value === password.value);

// Fortaleza real de la contraseña — 4 criterios concretos (no una estimación inventada): cada
// segmento del indicador corresponde a uno que sí se cumple o no.
const criteriosPassword = computed(() => [
  password.value.length >= 8,
  /[A-Z]/.test(password.value),
  /[0-9]/.test(password.value),
  /[^A-Za-z0-9]/.test(password.value),
]);
const fortalezaNivel = computed(() => criteriosPassword.value.filter(Boolean).length);
const FORTALEZA_LABEL = ['Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte'];
const fortalezaTexto = computed(() => FORTALEZA_LABEL[fortalezaNivel.value]);

const subtemaPorId = computed(() => {
  const map = new Map<string, { nombre: string; temaId: string; temaNombre: string }>();
  for (const tema of temas.value) {
    for (const s of tema.subtemas) {
      map.set(s.id, { nombre: s.nombre, temaId: tema.id, temaNombre: tema.nombre });
    }
  }
  return map;
});

const cantidadSeleccionados = computed(() => subtemaIdsSeleccionados.value.size);

const subtemasElegidos = computed(() =>
  Array.from(subtemaIdsSeleccionados.value)
    .map((id) => {
      const meta = subtemaPorId.value.get(id);
      return meta ? { id, ...meta } : null;
    })
    .filter((x): x is { id: string; nombre: string; temaId: string; temaNombre: string } => x !== null),
);

function toggleTemaExpandido(temaId: string) {
  const next = new Set(temasExpandidos.value);
  if (next.has(temaId)) next.delete(temaId);
  else next.add(temaId);
  temasExpandidos.value = next;
}

function toggleSubtema(id: string) {
  const next = new Set(subtemaIdsSeleccionados.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  subtemaIdsSeleccionados.value = next;
}

function seleccionadosEnTema(tema: TemaPublico): number {
  return tema.subtemas.filter((s) => subtemaIdsSeleccionados.value.has(s.id)).length;
}

function temaMarcado(tema: TemaPublico): boolean {
  return seleccionadosEnTema(tema) > 0;
}

// Checkbox del tema: marca/desmarca todos sus subtemas (y abre el acordeón al marcar).
function toggleTemaCompleto(tema: TemaPublico, event: Event) {
  event.stopPropagation();
  const next = new Set(subtemaIdsSeleccionados.value);
  const ids = tema.subtemas.map((s) => s.id);
  if (temaMarcado(tema)) {
    for (const id of ids) next.delete(id);
  } else {
    for (const id of ids) next.add(id);
    const exp = new Set(temasExpandidos.value);
    exp.add(tema.id);
    temasExpandidos.value = exp;
  }
  subtemaIdsSeleccionados.value = next;
}

function badgeTema(tema: TemaPublico): string {
  const n = seleccionadosEnTema(tema);
  const total = tema.subtemas.length;
  if (n > 0) return `${n} subtema${n === 1 ? '' : 's'} seleccionado${n === 1 ? '' : 's'}`;
  return `${total} subtema${total === 1 ? '' : 's'}`;
}

function validarPaso1(): string {
  if (!nombre.value.trim()) return 'Escribe tu nombre completo.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.value.trim())) return 'Escribe un correo válido.';
  if (password.value.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (password.value !== confirmarPassword.value) return 'Las contraseñas no coinciden.';
  return '';
}

function irAPaso2() {
  nombreTocado.value = true;
  correoTocado.value = true;
  passwordTocado.value = true;
  confirmarTocado.value = true;
  const msg = validarPaso1();
  if (msg) {
    error.value = msg;
    return;
  }
  error.value = '';
  paso.value = 2;
}

function irAPaso3() {
  error.value = '';
  paso.value = 3;
}

function volver() {
  error.value = '';
  if (paso.value === 3) paso.value = 2;
  else if (paso.value === 2) paso.value = 1;
}

async function crearCuenta() {
  if (!aceptaTerminos.value) {
    error.value = 'Acepta los Términos de uso y la Política de privacidad para continuar.';
    return;
  }
  error.value = '';
  enviando.value = true;
  try {
    await authApi.registro({
      nombre: nombre.value.trim(),
      correo: correo.value.trim(),
      password: password.value,
      preferencia: preferencia.value,
      subtemaIds: Array.from(subtemaIdsSeleccionados.value),
    });
    registrado.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo crear la cuenta. Intenta de nuevo.';
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex bg-white">
    <AuthBrandPanel />

    <div class="flex-1 flex items-center justify-center p-6 sm:p-10 overflow-y-auto">
      <div v-if="registrado" class="w-full max-w-sm text-center">
        <img :src="logoClaro" alt="ProyectaFácil" class="lg:hidden h-10 w-auto object-contain mx-auto mb-8" />
        <div class="w-12 h-12 mx-auto rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mb-4">
          <FontAwesomeIcon :icon="faEnvelope" class="w-5 h-5" />
        </div>
        <h2 class="text-lg font-bold text-heading mb-2">Revisa tu correo</h2>
        <p class="text-sm text-muted mb-6">
          Te mandamos un enlace de confirmación a <strong>{{ correo }}</strong>. Ábrelo para
          activar tu cuenta y poder iniciar sesión.
        </p>
        <RouterLink :to="{ name: 'login' }" class="text-sm font-medium text-brand-600 hover:text-brand-700">
          Volver a inicio de sesión
        </RouterLink>
      </div>

      <div v-else class="w-full" :class="paso === 2 ? 'max-w-xl' : 'max-w-lg'">
        <img :src="logoClaro" alt="ProyectaFácil" class="lg:hidden h-10 w-auto object-contain object-left mb-8" />
        <!-- Indicador de pasos -->
        <div class="flex items-center gap-2 mb-8">
          <template v-for="(etiqueta, i) in ['Crear cuenta', 'Temas de interés', 'Confirmar']" :key="etiqueta">
            <div class="flex items-center gap-2 min-w-0" :class="i === 0 ? '' : 'flex-1'">
              <div v-if="i > 0" class="flex-1 h-px min-w-4" :class="paso > i ? 'bg-brand-500' : 'bg-gray-200'" />
              <div class="flex items-center gap-2 shrink-0">
                <div
                  class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                  :class="paso > i + 1 ? 'bg-brand-600 text-white' : paso === i + 1 ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'"
                >
                  <FontAwesomeIcon v-if="paso > i + 1" :icon="faCheck" class="w-2.5 h-2.5" />
                  <template v-else>{{ i + 1 }}</template>
                </div>
                <span class="text-xs font-medium hidden sm:inline" :class="paso === i + 1 ? 'text-heading' : 'text-muted'">{{ etiqueta }}</span>
              </div>
            </div>
          </template>
        </div>

        <div>
          <p v-if="error" class="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            <FontAwesomeIcon :icon="faCircleExclamation" class="w-3.5 h-3.5 shrink-0" />
            {{ error }}
          </p>

          <!-- Paso 1: crear cuenta -->
          <form v-if="paso === 1" @submit.prevent="irAPaso2">
            <h2 class="text-xl font-bold text-heading mb-1">Crea tu cuenta</h2>
            <p class="text-sm text-muted mb-6">Completa la información para comenzar — toma menos de 2 minutos.</p>

            <label class="block text-sm font-medium text-heading mb-1.5">Nombre completo</label>
            <div class="relative mb-1">
              <FontAwesomeIcon :icon="faUser" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                v-model="nombre" type="text" placeholder="Ej. Juan Carlos Pérez López" autofocus
                @blur="nombreTocado = true"
                class="w-full pl-10 pr-9 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                :class="nombreTocado ? (nombreValido ? 'border-brand-600' : 'border-red-500') : 'border-gray-200 focus:border-brand-500'"
              />
              <FontAwesomeIcon v-if="nombreTocado" :icon="nombreValido ? faCheck : faXmark" class="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" :class="nombreValido ? 'text-brand-600' : 'text-red-500'" />
            </div>
            <p v-if="nombreTocado && !nombreValido" class="text-sm text-red-600 mb-3">Escribe tu nombre completo.</p>
            <div v-else class="mb-3" />

            <label class="block text-sm font-medium text-heading mb-1.5">Correo electrónico</label>
            <div class="relative mb-1">
              <FontAwesomeIcon :icon="faEnvelope" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                v-model="correo" type="email" placeholder="ejemplo@correo.com"
                @blur="correoTocado = true"
                class="w-full pl-10 pr-9 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                :class="correoTocado ? (correoValido ? 'border-brand-600' : 'border-red-500') : 'border-gray-200 focus:border-brand-500'"
              />
              <FontAwesomeIcon v-if="correoTocado" :icon="correoValido ? faCheck : faXmark" class="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" :class="correoValido ? 'text-brand-600' : 'text-red-500'" />
            </div>
            <p v-if="correoTocado && !correoValido" class="text-sm text-red-600 mb-3">Ingresa un correo válido (con @).</p>
            <div v-else class="mb-3" />

            <div class="grid grid-cols-2 gap-3 mb-1">
              <div>
                <label class="block text-sm font-medium text-heading mb-1.5">Contraseña</label>
                <div class="relative">
                  <FontAwesomeIcon :icon="faLock" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    v-model="password" :type="mostrarPassword ? 'text' : 'password'" placeholder="Mínimo 8 caracteres"
                    @blur="passwordTocado = true"
                    class="w-full pl-10 pr-9 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    :class="passwordTocado ? (passwordValida ? 'border-brand-600' : 'border-red-500') : 'border-gray-200 focus:border-brand-500'"
                  />
                  <button type="button" @click="mostrarPassword = !mostrarPassword" class="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600">
                    <FontAwesomeIcon :icon="mostrarPassword ? faEyeSlash : faEye" class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-heading mb-1.5">Confirmar contraseña</label>
                <div class="relative">
                  <FontAwesomeIcon :icon="faLock" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    v-model="confirmarPassword" :type="mostrarConfirmar ? 'text' : 'password'" placeholder="Repite tu contraseña"
                    @blur="confirmarTocado = true"
                    class="w-full pl-10 pr-9 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    :class="confirmarTocado ? (confirmarValida ? 'border-brand-600' : 'border-red-500') : 'border-gray-200 focus:border-brand-500'"
                  />
                  <button type="button" @click="mostrarConfirmar = !mostrarConfirmar" class="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600">
                    <FontAwesomeIcon :icon="mostrarConfirmar ? faEyeSlash : faEye" class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-1">
              <p v-if="passwordTocado && !passwordValida" class="text-sm text-red-600">Mínimo 8 caracteres.</p>
              <p v-else-if="password" class="text-xs text-muted">Fortaleza: {{ fortalezaTexto }}</p>
              <p v-else />
              <p v-if="confirmarTocado && !confirmarValida" class="text-sm text-red-600">Las contraseñas no coinciden.</p>
            </div>
            <div v-if="password" class="flex gap-1 mb-6">
              <span v-for="n in 4" :key="n" class="h-1 flex-1 rounded-full" :class="n <= fortalezaNivel ? (fortalezaNivel >= 3 ? 'bg-brand-500' : 'bg-red-400') : 'bg-gray-200'" />
            </div>
            <div v-else class="mb-6" />

            <label class="block text-sm font-medium text-heading mb-2">¿Cuál de estas te describe mejor?</label>
            <div class="flex flex-col gap-2 mb-6">
              <label
                v-for="(p, i) in PREFERENCIAS" :key="p"
                class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors duration-75"
                :class="preferencia === p ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'"
              >
                <span
                  class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                  :class="preferencia === p ? 'border-brand-600' : 'border-gray-300'"
                >
                  <span v-if="preferencia === p" class="w-2 h-2 rounded-full bg-brand-600" />
                </span>
                <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" :class="preferencia === p ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500'">
                  <FontAwesomeIcon :icon="PREFERENCIA_ICONOS[i]" class="w-3.5 h-3.5" />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-heading leading-snug">{{ p }}</p>
                  <p class="text-[12px] text-muted leading-snug mt-0.5">{{ PREFERENCIA_HINTS[i] }}</p>
                </div>
                <input v-model="preferencia" type="radio" :value="p" class="sr-only" />
              </label>
            </div>

            <button type="submit" class="w-full py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors duration-75 flex items-center justify-center gap-2">
              Continuar
              <FontAwesomeIcon :icon="faChevronRight" class="w-3.5 h-3.5" />
            </button>
            <p class="text-sm text-center text-muted mt-4">
              ¿Ya tienes una cuenta? <RouterLink :to="{ name: 'login' }" class="font-medium text-primary-hover hover:text-brand-700">Iniciar sesión</RouterLink>
            </p>
          </form>

          <!-- Paso 2: temas de interés ILPIIE (acordeón vertical como el mock) -->
          <div v-else-if="paso === 2">
            <div class="flex flex-col sm:flex-row sm:items-start gap-3 mb-5">
              <div class="flex-1 min-w-0">
                <div class="flex items-start gap-3 mb-2">
                  <div class="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon :icon="faBullseye" class="w-5 h-5" />
                  </div>
                  <div>
                    <h2 class="text-lg font-bold text-heading leading-snug">¿Cuáles son tus temas de interés?</h2>
                    <p class="text-sm text-muted leading-relaxed mt-1">
                      Selecciona los temas y subtemas en los que te gustaría recibir asesoría del ILPIIE.
                      Puedes elegir uno o varios, según tus necesidades.
                    </p>
                  </div>
                </div>
              </div>
              <div class="sm:max-w-[200px] shrink-0 flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
                <FontAwesomeIcon :icon="faLightbulb" class="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <p class="text-[11px] text-muted leading-snug">Esto nos ayudará a brindarte una asesoría más personalizada.</p>
              </div>
            </div>

            <div class="space-y-2.5 mb-6 max-h-[min(52vh,480px)] overflow-y-auto pr-0.5">
              <div
                v-for="tema in temas"
                :key="tema.id"
                class="rounded-xl border overflow-hidden transition-colors duration-75"
                :class="temaMarcado(tema) || temasExpandidos.has(tema.id)
                  ? 'border-brand-200'
                  : 'border-gray-200'"
              >
                <div
                  class="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors duration-75 cursor-pointer"
                  :class="temaMarcado(tema) ? 'bg-brand-50' : 'bg-white hover:bg-gray-50'"
                  role="button"
                  tabindex="0"
                  @click="toggleTemaExpandido(tema.id)"
                  @keydown.enter.prevent="toggleTemaExpandido(tema.id)"
                  @keydown.space.prevent="toggleTemaExpandido(tema.id)"
                >
                  <input
                    type="checkbox"
                    class="rounded border-gray-300 text-brand-600 focus:ring-brand-300 shrink-0"
                    :checked="temaMarcado(tema)"
                    :aria-label="`Seleccionar ${tema.nombre}`"
                    @click.prevent.stop="toggleTemaCompleto(tema, $event)"
                  />
                  <span class="flex-1 min-w-0 text-sm font-semibold text-heading leading-snug">{{ tema.nombre }}</span>
                  <span
                    class="text-xs font-medium shrink-0 whitespace-nowrap"
                    :class="temaMarcado(tema) ? 'text-brand-700' : 'text-muted'"
                  >
                    {{ badgeTema(tema) }}
                  </span>
                  <FontAwesomeIcon
                    :icon="temasExpandidos.has(tema.id) ? faChevronUp : faChevronDown"
                    class="w-3 h-3 text-gray-400 shrink-0"
                  />
                </div>

                <div v-if="temasExpandidos.has(tema.id)" class="bg-white border-t border-gray-100 px-4 py-3">
                  <p class="text-xs text-muted mb-2.5">Selecciona los subtemas que te interesan:</p>
                  <div class="space-y-1">
                    <label
                      v-for="sub in tema.subtemas"
                      :key="sub.id"
                      class="flex items-center gap-2.5 px-1 py-1.5 rounded-md cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        class="rounded border-gray-300 text-brand-600 focus:ring-brand-300"
                        :checked="subtemaIdsSeleccionados.has(sub.id)"
                        @change="toggleSubtema(sub.id)"
                      />
                      <span class="text-sm text-heading leading-snug">{{ sub.nombre }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <button
                type="button"
                class="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                @click="volver"
              >
                <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
                Volver
              </button>
              <button
                type="button"
                class="flex-1 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 flex items-center justify-center gap-2"
                @click="irAPaso3"
              >
                Continuar
                <FontAwesomeIcon :icon="faChevronRight" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Paso 3: confirmar -->
          <div v-else>
            <h2 class="text-lg font-bold text-heading mb-1">Revisa tu información</h2>
            <p class="text-sm text-muted mb-5">Verifica que todo esté correcto antes de crear tu cuenta.</p>

            <div class="rounded-xl border border-gray-200 p-4 mb-4">
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-semibold text-heading">Información de cuenta</p>
                <button type="button" class="text-xs font-medium text-brand-600 hover:text-brand-700" @click="paso = 1">Editar</button>
              </div>
              <p class="text-sm text-heading">{{ nombre }}</p>
              <p class="text-sm text-muted">{{ correo }}</p>
            </div>

            <div class="rounded-xl border border-gray-200 p-4 mb-4">
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-semibold text-heading">Temas de interés seleccionados ({{ cantidadSeleccionados }})</p>
                <button type="button" class="text-xs font-medium text-brand-600 hover:text-brand-700" @click="paso = 2">Editar</button>
              </div>
              <p v-if="cantidadSeleccionados === 0" class="text-sm text-muted">Ninguno seleccionado.</p>
              <div v-else class="flex flex-wrap gap-1.5">
                <span
                  v-for="s in subtemasElegidos"
                  :key="s.id"
                  class="px-2.5 py-1 rounded-full border border-brand-200 bg-brand-50 text-brand-700 text-xs font-medium"
                >
                  {{ s.nombre }}
                </span>
              </div>
            </div>

            <div class="rounded-xl border border-gray-200 p-4 mb-5">
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-semibold text-heading">¿Cuál de estas te describe mejor?</p>
                <button type="button" class="text-xs font-medium text-brand-600 hover:text-brand-700" @click="paso = 1">Editar</button>
              </div>
              <p class="text-sm text-heading">{{ preferencia }}</p>
            </div>

            <label class="flex items-start gap-2 mb-5 cursor-pointer">
              <input v-model="aceptaTerminos" type="checkbox" class="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-300" />
              <span class="text-sm text-muted">
                Acepto los
                <a href="#" class="text-brand-600 hover:underline" @click.prevent>Términos de uso</a>
                y la
                <a href="#" class="text-brand-600 hover:underline" @click.prevent>Política de privacidad</a>.
              </span>
            </label>

            <button
              type="button"
              :disabled="!aceptaTerminos || enviando"
              class="w-full py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center justify-center gap-2 mb-3"
              @click="crearCuenta"
            >
              <FontAwesomeIcon :icon="faUserPlus" class="w-3.5 h-3.5" />
              {{ enviando ? 'Creando cuenta…' : 'Crear mi cuenta' }}
            </button>
            <button type="button" class="w-full py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2" @click="volver">
              <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
              Volver
            </button>
          </div>
        </div>

        <div class="flex items-start gap-2.5 mt-4 px-1">
          <FontAwesomeIcon :icon="faShieldHalved" class="w-4 h-4 text-muted mt-0.5 shrink-0" />
          <p class="text-[13px] text-muted leading-relaxed">
            Tu información está protegida. Usamos cifrado y buenas prácticas de seguridad para
            proteger tus datos personales.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
