<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faUser, faLock, faEye, faEyeSlash, faCircleExclamation, faCheck, faXmark,
  faChevronLeft, faChevronRight, faShieldHalved, faEnvelope, faUserPlus,
  faGraduationCap, faBriefcase, faBook, faGlobe,
} from '@/lib/icons';
import { sectorIcons } from '@/lib/icons';
import { authApi } from '@/api/auth';
import logo from '@/assets/logo.png';

interface SectorPublico {
  id: string;
  nombre: string;
  icono: string;
  descripcion?: string;
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
const sectorIdsSeleccionados = ref<Set<string>>(new Set());
const aceptaTerminos = ref(false);
const error = ref('');
const enviando = ref(false);
const registrado = ref(false);

const sectores = ref<SectorPublico[]>([]);
onMounted(async () => {
  try {
    const res = await fetch('/api/sectores/publico');
    sectores.value = res.ok ? await res.json() : [];
  } catch {
    sectores.value = [];
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

function toggleSector(id: string) {
  const next = new Set(sectorIdsSeleccionados.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  sectorIdsSeleccionados.value = next;
}

const sectoresElegidos = computed(() => sectores.value.filter((s) => sectorIdsSeleccionados.value.has(s.id)));

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
      sectorIds: Array.from(sectorIdsSeleccionados.value),
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
  <div class="min-h-screen flex bg-surface">
    <div class="relative hidden lg:flex flex-col justify-between w-[45%] bg-sidebar bg-[url('/bg-cont.webp')] bg-cover bg-center text-white p-12 overflow-hidden">
      <div class="absolute inset-0 bg-black/5 pointer-events-none" />

      <div class="relative flex items-center gap-3">
        <img :src="logo" alt="" class="w-10 h-10 object-contain shrink-0" />
        <div>
          <div class="font-heading font-semibold leading-tight"><span class="text-white">Proyecta</span><span class="text-brand-400">Fácil</span></div>
          <div class="text-xs text-white/60 leading-tight">Editor de plantillas</div>
        </div>
      </div>

      <div class="relative">
        <h1 class="font-heading font-semibold text-3xl leading-snug mb-4">
          Únete a Proyecta Fácil y empieza a transformar tus proyectos
        </h1>
        <p class="text-white/70 text-sm leading-relaxed max-w-md mb-6">
          Crea tu cuenta para acceder a plantillas, fichas técnicas e IOARR diseñadas para la
          inversión pública.
        </p>
        <ul class="space-y-3 max-w-md">
          <li v-for="beneficio in [
            'Plantillas oficiales listas para llenar con ayuda de IA',
            'Asesoría en vivo con especialistas del ILPIIE',
            'Sigue el progreso de todos tus proyectos en un solo lugar',
          ]" :key="beneficio" class="flex items-start gap-2.5 text-sm text-white/80">
            <span class="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center shrink-0 mt-0.5">
              <FontAwesomeIcon :icon="faCheck" class="w-2.5 h-2.5 text-white" />
            </span>
            {{ beneficio }}
          </li>
        </ul>
      </div>

      <p class="relative text-[11px] text-white/40">
        © Proyecta Fácil — Todos los derechos reservados
      </p>
    </div>

    <div class="flex-1 flex items-center justify-center p-6">
      <div v-if="registrado" class="w-full max-w-sm bg-surface-card rounded-2xl shadow-card p-8 text-center">
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

      <div v-else class="w-full max-w-lg">
        <!-- Indicador de pasos -->
        <div class="flex items-center justify-center gap-3 mb-6">
          <template v-for="(etiqueta, i) in ['Crear cuenta', 'Temas de interés', 'Confirmar']" :key="etiqueta">
            <div class="flex items-center gap-2">
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                :class="paso > i + 1 ? 'bg-brand-600 text-white' : paso === i + 1 ? 'bg-brand-600 text-white' : 'bg-gray-300 text-gray-500'"
              >
                <FontAwesomeIcon v-if="paso > i + 1" :icon="faCheck" class="w-2.5 h-2.5" />
                <template v-else>{{ i + 1 }}</template>
              </div>
              <span class="text-xs font-medium" :class="paso === i + 1 ? 'text-heading' : 'text-muted'">{{ etiqueta }}</span>
            </div>
            <div v-if="i < 2" class="w-8 h-px" :class="paso > i + 1 ? 'bg-brand-600' : 'bg-gray-300'" />
          </template>
        </div>

        <div class="bg-surface-card rounded-2xl shadow-card p-8">
          <p v-if="error" class="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            <FontAwesomeIcon :icon="faCircleExclamation" class="w-3.5 h-3.5 shrink-0" />
            {{ error }}
          </p>

          <!-- Paso 1: crear cuenta -->
          <form v-if="paso === 1" @submit.prevent="irAPaso2">
            <h2 class="text-lg font-bold text-heading mb-1">Crea tu cuenta</h2>
            <p class="text-sm text-muted mb-6">Completa la información para comenzar</p>

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
            <p v-if="correoTocado && !correoValido" class="text-sm text-red-600 mb-3">Ingresa un correo válido.</p>
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
            <!-- Indicador de fortaleza — 4 segmentos, uno por criterio real cumplido (longitud,
                 mayúscula, número, símbolo), no una estimación inventada. -->
            <div v-if="password" class="flex gap-1 mb-6">
              <span v-for="n in 4" :key="n" class="h-1 flex-1 rounded-full" :class="n <= fortalezaNivel ? (fortalezaNivel >= 3 ? 'bg-brand-500' : 'bg-red-400') : 'bg-gray-200'" />
            </div>
            <div v-else class="mb-6" />

            <label class="block text-sm font-medium text-heading mb-2">¿Cuál de estas te describe mejor?</label>
            <div class="grid grid-cols-2 gap-2 mb-6">
              <label
                v-for="(p, i) in PREFERENCIAS" :key="p"
                class="flex flex-col gap-1.5 p-3 rounded-xl border cursor-pointer transition-colors duration-75"
                :class="preferencia === p ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'"
              >
                <input v-model="preferencia" type="radio" :value="p" class="sr-only" />
                <div class="w-7 h-7 rounded-full flex items-center justify-center" :class="preferencia === p ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500'">
                  <FontAwesomeIcon :icon="PREFERENCIA_ICONOS[i]" class="w-3.5 h-3.5" />
                </div>
                <span class="text-xs font-medium text-heading leading-tight">{{ p }}</span>
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

          <!-- Paso 2: temas de interés -->
          <div v-else-if="paso === 2">
            <h2 class="text-lg font-bold text-heading mb-1">¿Cuáles son tus temas de interés?</h2>
            <p class="text-sm text-muted mb-1">Selecciona los sectores que más te interesan.</p>
            <p class="text-xs text-muted mb-4">Puedes elegir uno o varios — es opcional.</p>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto mb-4 pr-1">
              <button
                v-for="s in sectores"
                :key="s.id"
                type="button"
                @click="toggleSector(s.id)"
                class="text-left p-3 rounded-xl border transition-colors duration-75"
                :class="sectorIdsSeleccionados.has(s.id) ? 'border-brand-500 bg-brand-50/60' : 'border-gray-200 hover:bg-gray-50'"
              >
                <div class="flex items-start justify-between mb-1.5">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center" :class="sectorIdsSeleccionados.has(s.id) ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500'">
                    <FontAwesomeIcon v-if="sectorIcons[s.icono]" :icon="sectorIcons[s.icono]" class="w-3 h-3" />
                  </div>
                  <div v-if="sectorIdsSeleccionados.has(s.id)" class="w-4 h-4 rounded bg-brand-600 text-white flex items-center justify-center">
                    <FontAwesomeIcon :icon="faCheck" class="w-2 h-2" />
                  </div>
                  <div v-else class="w-4 h-4 rounded border border-gray-300" />
                </div>
                <p class="text-xs font-semibold text-heading leading-tight">{{ s.nombre }}</p>
                <p v-if="s.descripcion" class="text-[11px] text-muted leading-tight mt-0.5 line-clamp-2">{{ s.descripcion }}</p>
              </button>
            </div>

            <div class="flex items-center gap-3">
              <button type="button" @click="volver" class="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                <FontAwesomeIcon :icon="faChevronLeft" class="w-3 h-3" />
                Volver
              </button>
              <button type="button" @click="irAPaso3" class="flex-1 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 flex items-center justify-center gap-2">
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
                <button type="button" @click="paso = 1" class="text-xs font-medium text-brand-600 hover:text-brand-700">Editar</button>
              </div>
              <p class="text-sm text-heading">{{ nombre }}</p>
              <p class="text-sm text-muted">{{ correo }}</p>
            </div>

            <div class="rounded-xl border border-gray-200 p-4 mb-4">
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-semibold text-heading">Temas de interés seleccionados ({{ sectoresElegidos.length }})</p>
                <button type="button" @click="paso = 2" class="text-xs font-medium text-brand-600 hover:text-brand-700">Editar</button>
              </div>
              <p v-if="sectoresElegidos.length === 0" class="text-sm text-muted">Ninguno seleccionado.</p>
              <div v-else class="flex flex-wrap gap-1.5">
                <span v-for="s in sectoresElegidos" :key="s.id" class="px-2.5 py-1 rounded-full border border-brand-200 bg-brand-50 text-brand-700 text-xs font-medium">{{ s.nombre }}</span>
              </div>
            </div>

            <div class="rounded-xl border border-gray-200 p-4 mb-5">
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-semibold text-heading">¿Cuál de estas te describe mejor?</p>
                <button type="button" @click="paso = 1" class="text-xs font-medium text-brand-600 hover:text-brand-700">Editar</button>
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
              @click="crearCuenta"
              :disabled="!aceptaTerminos || enviando"
              class="w-full py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center justify-center gap-2 mb-3"
            >
              <FontAwesomeIcon :icon="faUserPlus" class="w-3.5 h-3.5" />
              {{ enviando ? 'Creando cuenta…' : 'Crear mi cuenta' }}
            </button>
            <button type="button" @click="volver" class="w-full py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2">
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
