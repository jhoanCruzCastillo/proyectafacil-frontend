<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faCheck, faUserGear, faUser, faEnvelope, rolUsuarioLabels } from '@/lib/icons';
import { rolesGestionablesPor } from '@/lib/permisos';
import { useCrearUsuario, useActualizarUsuario, useEnviarAccesos } from '@/composables/useUsuarios';
import { usePushActividad } from '@/composables/useActividad';
import { generateId } from '@/api/mock/_shared';
import { useUiStore } from '@/stores/ui';
import RolDropdown from './RolDropdown.vue';
import OrigenClienteFields from './OrigenClienteFields.vue';
import UsuarioCreadoPanel from './UsuarioCreadoPanel.vue';
import PlanActualInfo from './PlanActualInfo.vue';
import type { RolUsuario, Usuario, OrigenCliente } from '@/types';

const props = defineProps<{
  isOpen: boolean;
  actorRol: RolUsuario;
  usuario?: Usuario | null;
  usuarios: Usuario[];
}>();

const emit = defineEmits<{ close: [] }>();

const ui = useUiStore();
const crearUsuario = useCrearUsuario();
const actualizarUsuario = useActualizarUsuario();
const enviarAccesos = useEnviarAccesos();
const pushActividad = usePushActividad();
const accesosEnviados = ref(false);

const rolesDisponibles = computed(() => rolesGestionablesPor(props.actorRol));
// Superusuario no es asignable desde este formulario — es el rol raíz del sistema, no una simple
// etiqueta. Se protege aquí para que nadie pueda promoverse a sí mismo ni a otros.
const rolesSeleccionables = computed(() => rolesDisponibles.value.filter((r) => r !== 'superusuario'));
const esEdicion = computed(() => !!props.usuario);
const esSuperusuarioProtegido = computed(() => props.usuario?.rol === 'superusuario');

const nombre = ref('');
const login = ref('');
const correo = ref('');
const password = ref('');
const rol = ref<RolUsuario>('cliente');
const origen = ref<OrigenCliente>('alumno');
const origenGuardado = ref<OrigenCliente | null>(null);
const vigenciaAlumnoHasta = ref('');
const error = ref('');
const credencialGenerada = ref<{ id: string; usuario: string; password: string; correo?: string } | null>(null);

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return;
    credencialGenerada.value = null;
    accesosEnviados.value = false;
    nombre.value = props.usuario?.nombre ?? '';
    login.value = props.usuario?.usuario ?? '';
    correo.value = props.usuario?.correo ?? '';
    password.value = '';
    rol.value = props.usuario?.rol ?? rolesSeleccionables.value[rolesSeleccionables.value.length - 1] ?? 'cliente';
    origen.value = props.usuario?.origen ?? 'alumno';
    origenGuardado.value = props.usuario?.origen ?? null;
    vigenciaAlumnoHasta.value = props.usuario?.vigenciaAlumnoHasta ?? '';
    error.value = '';
  },
);

async function handleSubmit() {
  if (!nombre.value.trim() || !login.value.trim()) return;
  const loginNormalizado = login.value.trim().toLowerCase();
  const duplicado = props.usuarios.some(
    (u) => u.usuario.toLowerCase() === loginNormalizado && u.id !== props.usuario?.id,
  );
  if (duplicado) {
    error.value = 'Ya existe un usuario con ese nombre de acceso.';
    return;
  }

  const datosOrigen = rol.value === 'cliente'
    ? { origen: origen.value, vigenciaAlumnoHasta: origen.value === 'alumno' ? (vigenciaAlumnoHasta.value || null) : null }
    : { origen: null, vigenciaAlumnoHasta: null };

  if (esEdicion.value && props.usuario) {
    const rolCambio = rol.value !== props.usuario.rol;
    await actualizarUsuario.mutateAsync({
      id: props.usuario.id,
      data: {
        nombre: nombre.value.trim(),
        usuario: login.value.trim(),
        correo: correo.value.trim() || undefined,
        rol: rol.value,
        ...datosOrigen,
        ...(password.value.trim() ? { password: password.value.trim() } : {}),
      },
    });
    // Mensaje específico cuando cambia el rol — es uno de los eventos que se rastrean en el tab
    // "Actividad" del panel de detalles (ver UsuariosPage.vue).
    await pushActividad.mutateAsync(
      rolCambio
        ? { mensaje: `Actualizó el rol de "${nombre.value.trim()}" a ${rolUsuarioLabels[rol.value]}`, color: 'blue', categoria: 'Usuarios y permisos' }
        : { mensaje: `Se actualizó el usuario "${nombre.value.trim()}"`, color: 'blue', categoria: 'Usuarios y permisos' },
    );
    ui.toast(`Usuario "${nombre.value.trim()}" actualizado`);
    emit('close');
    return;
  }

  const creado = await crearUsuario.mutateAsync({
    id: generateId(),
    nombre: nombre.value.trim(),
    usuario: login.value.trim(),
    correo: correo.value.trim() || undefined,
    password: '',
    rol: rol.value,
    ...datosOrigen,
  });
  await pushActividad.mutateAsync({ mensaje: `Se creó el usuario "${nombre.value.trim()}"`, color: 'green', categoria: 'Usuarios y permisos' });
  if (creado.password) {
    credencialGenerada.value = { id: creado.id, usuario: creado.usuario, password: creado.password, correo: creado.correo };
  } else {
    ui.toast(`Usuario "${nombre.value.trim()}" creado`);
    emit('close');
  }
}

async function handleEnviarAccesos() {
  if (!props.usuario) return;
  try {
    await enviarAccesos.mutateAsync(props.usuario.id);
    accesosEnviados.value = true;
    ui.toast(`Se envió una contraseña nueva a ${props.usuario.correo}`);
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo enviar el correo', 'error');
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-md max-h-[90vh] overflow-y-auto" @click.stop>
          <UsuarioCreadoPanel
            v-if="credencialGenerada"
            :id="credencialGenerada.id"
            :usuario="credencialGenerada.usuario"
            :password="credencialGenerada.password"
            :correo="credencialGenerada.correo"
            @close="emit('close')"
          />

          <template v-else>
          <div class="flex items-start justify-between p-6 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center">
                <FontAwesomeIcon :icon="faUserGear" class="w-4 h-4" />
              </div>
              <div>
                <h2 class="text-lg font-bold text-heading">{{ esEdicion ? `Editar usuario: ${usuario?.nombre}` : 'Nuevo usuario' }}</h2>
                <p class="text-sm text-muted">{{ esEdicion ? 'Actualiza los datos de acceso y rol' : 'Crea un nuevo acceso al panel' }}</p>
              </div>
            </div>
            <button @click="emit('close')" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <div class="px-6 pb-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-heading mb-1.5">Nombre completo</label>
              <div class="relative">
                <FontAwesomeIcon :icon="faUser" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input v-model="nombre" type="text" placeholder="Ej. María Fernanda Quispe Gómez" class="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-heading mb-1.5">Nombre de usuario</label>
              <div class="relative">
                <FontAwesomeIcon :icon="faUser" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input v-model="login" type="text" placeholder="Ej. mariaquispe" class="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-heading mb-1.5">Correo electrónico</label>
              <div class="relative">
                <FontAwesomeIcon :icon="faEnvelope" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input v-model="correo" type="email" placeholder="Ej. maria@dominio.com" class="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
            </div>

            <div v-if="esSuperusuarioProtegido">
              <label class="block text-sm font-medium text-heading mb-1.5">Rol</label>
              <div class="px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
                Superusuario — este rol no se puede reasignar desde aquí.
              </div>
            </div>
            <div v-else>
              <label class="block text-sm font-medium text-heading mb-1.5">Rol</label>
              <RolDropdown v-model="rol" :opciones="rolesSeleccionables" />
              <p class="text-xs text-muted mt-1.5">El rol define los permisos base del usuario en la plataforma.</p>
            </div>

            <OrigenClienteFields
              v-if="rol === 'cliente'"
              v-model:origen="origen"
              v-model:vigenciaAlumnoHasta="vigenciaAlumnoHasta"
              :origen-guardado="origenGuardado ?? undefined"
              :cambiado-por-nombre="usuario?.origenCambiadoPorNombre"
              :cambiado-en="usuario?.origenCambiadoEn"
            />

            <PlanActualInfo v-if="esEdicion && rol === 'cliente' && usuario" :usuario-id="usuario.cuentaClienteId ?? usuario.id" />

            <div v-if="esEdicion">
              <label class="block text-sm font-medium text-heading mb-1.5">
                Contraseña <span class="text-muted font-normal">(dejar en blanco para no cambiarla)</span>
              </label>
              <input v-model="password" type="password" placeholder="••••••••" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>

            <div v-if="esEdicion">
              <button
                @click="handleEnviarAccesos"
                type="button"
                :disabled="!usuario?.correo || enviarAccesos.isPending.value"
                class="w-full px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors duration-75 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                :class="accesosEnviados ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60'"
              >
                <FontAwesomeIcon :icon="accesosEnviados ? faCheck : faEnvelope" class="w-3.5 h-3.5" />
                {{ accesosEnviados ? 'Accesos enviados' : enviarAccesos.isPending.value ? 'Enviando…' : 'Enviar accesos por correo' }}
              </button>
              <p v-if="!usuario?.correo" class="text-xs text-muted mt-1.5">Este usuario no tiene un correo cargado.</p>
              <p v-else class="text-xs text-muted mt-1.5">Genera una contraseña nueva y se la envía a {{ usuario?.correo }}.</p>
            </div>

            <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

            <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button @click="emit('close')" class="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75">
                Cancelar
              </button>
              <button
                @click="handleSubmit"
                :disabled="!nombre.trim() || !login.trim()"
                class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center gap-2"
              >
                <FontAwesomeIcon :icon="faCheck" class="w-3.5 h-3.5" />
                {{ esEdicion ? 'Guardar cambios' : 'Crear usuario' }}
              </button>
            </div>
          </div>
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
