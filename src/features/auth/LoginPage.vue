<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faUser, faLock, faEye, faEyeSlash, faRightToBracket, faCircleExclamation, faListCheck } from '@/lib/icons';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { rolUsuarioLabels } from '@/lib/icons';
import AuthBrandPanel from './AuthBrandPanel.vue';
import logoClaro from '@/assets/logo-horizontal-claro.png';

const session = useSessionStore();
const ui = useUiStore();
const router = useRouter();

const usuario = ref('superuser');
const password = ref('Super#2026');
const showPassword = ref(false);
const error = ref('');

// Solo en desarrollo (npm run dev): credenciales de los usuarios de muestra sembrados por
// UsuariosSeeder — un usuario por rol (Cliente cuenta con uno de origen Alumno y otro Externo,
// ya que esa distinción cambia el comportamiento de la app; Asesor cuenta con dos, para poder
// probar flujos con múltiples asesores — ej. un horario cubierto por más de uno) — acelera probar
// cada combinación sin escribir usuario/contraseña a mano. Se excluye del build de producción — el
// template no puede evaluar import.meta directamente, así que se resuelve una sola vez acá.
const esDev = import.meta.env.DEV;
const credencialesDev = [
  { id: 'superusuario', label: `${rolUsuarioLabels.superusuario} — Carlos Núñez`, usuario: 'superuser', password: 'Super#2026' },
  { id: 'administrador', label: `${rolUsuarioLabels.administrador} — María Quispe`, usuario: 'admin', password: 'Admin#2026' },
  { id: 'administrativo_asesorias', label: `${rolUsuarioLabels.administrativo_asesorias} — Roberto Salas`, usuario: 'coord.asesorias', password: 'Asesorias#2026' },
  { id: 'cliente-alumno', label: `${rolUsuarioLabels.cliente} (Alumno) — Juan Pérez`, usuario: 'cliente', password: 'Cliente#2026' },
  { id: 'cliente-externo', label: `${rolUsuarioLabels.cliente} (Externo) — Ana Gómez`, usuario: 'cliente2', password: 'Cliente#2026' },
  { id: 'asesor', label: `${rolUsuarioLabels.asesor} — Pedro Ríos`, usuario: 'asesor1', password: 'Asesor#2026' },
  { id: 'asesor2', label: `${rolUsuarioLabels.asesor} — Laura Medina`, usuario: 'asesor2', password: 'Asesor#2026' },
];

function usarCredencialDev(id: string) {
  const c = credencialesDev.find((cred) => cred.id === id);
  if (!c) return;
  usuario.value = c.usuario;
  password.value = c.password;
  error.value = '';
}

async function handleSubmit() {
  if (!usuario.value.trim() || !password.value) return;
  error.value = '';
  try {
    const nueva = await session.login(usuario.value, password.value);
    if (!nueva) {
      error.value = 'Usuario o contraseña incorrectos';
      password.value = '';
      return;
    }
    ui.toast(`Bienvenido, ${nueva.nombre} — ${rolUsuarioLabels[nueva.rol]}`);
    router.replace({ name: 'home' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    // apiFetch lanza "Credenciales inválidas" (401) o "Error 502…" / fallos de red.
    if (/credencial|401/i.test(msg)) {
      error.value = 'Usuario o contraseña incorrectos';
      password.value = '';
    } else if (/502|503|504|ECONNREFUSED|conectar|gateway|network|Failed to fetch/i.test(msg)) {
      error.value = 'No se pudo conectar con el servidor. ¿Está corriendo el backend (php spark serve)?';
    } else {
      error.value = msg || 'No se pudo iniciar sesión. Intenta de nuevo.';
    }
  }
}
</script>

<template>
  <div class="min-h-screen flex bg-white">
    <AuthBrandPanel />

    <div class="flex-1 flex items-center justify-center p-6 sm:p-10 overflow-y-auto">
      <form @submit.prevent="handleSubmit" class="w-full max-w-sm">
        <img :src="logoClaro" alt="ProyectaFácil" class="lg:hidden h-10 w-auto object-contain object-left mb-8" />
        <h2 class="font-heading font-semibold text-xl text-heading mb-1">Iniciar sesión</h2>
        <p class="text-sm text-muted mb-6">Ingresa tus credenciales. Tu rol se detecta automáticamente.</p>

        <div v-if="esDev" class="mb-5">
          <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Acceso rápido (solo desarrollo)</p>
          <div class="relative">
            <FontAwesomeIcon :icon="faListCheck" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <select
              @change="usarCredencialDev(($event.target as HTMLSelectElement).value)"
              class="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            >
              <option value="" disabled selected>Selecciona un usuario de prueba…</option>
              <option v-for="c in credencialesDev" :key="c.id" :value="c.id">{{ c.label }}</option>
            </select>
          </div>
        </div>

        <label class="block text-sm font-medium text-heading mb-1.5">Usuario</label>
        <div class="relative mb-4">
          <FontAwesomeIcon :icon="faUser" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            v-model="usuario"
            @input="error = ''"
            type="text"
            placeholder="nombre de usuario"
            autofocus
            class="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>

        <label class="block text-sm font-medium text-heading mb-1.5">Contraseña</label>
        <div class="relative mb-4">
          <FontAwesomeIcon :icon="faLock" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            v-model="password"
            @input="error = ''"
            :type="showPassword ? 'text' : 'password'"
            placeholder="••••••••"
            class="w-full pl-10 pr-11 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          <button
            type="button"
            @click="showPassword = !showPassword"
            class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-75"
            :title="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          >
            <FontAwesomeIcon :icon="showPassword ? faEyeSlash : faEye" class="w-3.5 h-3.5" />
          </button>
        </div>

        <p v-if="error" class="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          <FontAwesomeIcon :icon="faCircleExclamation" class="w-3.5 h-3.5" />
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="!usuario.trim() || !password"
          class="w-full py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center justify-center gap-2"
        >
          <FontAwesomeIcon :icon="faRightToBracket" class="w-3.5 h-3.5" />
          Iniciar sesión
        </button>

        <p class="text-sm text-center text-muted mt-4">
          ¿No tienes una cuenta? <RouterLink :to="{ name: 'registro' }" class="font-medium text-brand-600 hover:text-brand-700">Regístrate</RouterLink>
        </p>

        <p class="text-[11px] text-muted text-center mt-6">
          Acceso para superusuarios, administradores, asesores y clientes autorizados.
        </p>
      </form>
    </div>
  </div>
</template>
