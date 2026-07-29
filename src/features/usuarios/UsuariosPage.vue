<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faPlus, faPen, faTrash, faShieldHalved, faTags, faUserGear, faUserGroup, faGlobe, faGraduationCap, faSearch, rolUsuarioLabels } from '@/lib/icons';
import { rolesGestionablesPor } from '@/lib/permisos';
import { useSessionStore } from '@/stores/session';
import { useUsuariosQuery, useEliminarUsuario } from '@/composables/useUsuarios';
import { useTiposUsuarioQuery } from '@/composables/useTiposUsuario';
import { usePushActividad } from '@/composables/useActividad';
import { useFacturacionQuery } from '@/composables/useFacturacion';
import { numeroNivelDe } from '@/lib/planAcceso';
import { useUiStore } from '@/stores/ui';
import ConfirmModal from '@/components/ConfirmModal.vue';
import PageShell from '@/components/PageShell.vue';
import UsuarioModal from './UsuarioModal.vue';
import GestionarRolesModal from './GestionarRolesModal.vue';
import PermisosUsuarioModal from './PermisosUsuarioModal.vue';
import type { Usuario, RolUsuario, OrigenCliente } from '@/types';

const session = useSessionStore();
const ui = useUiStore();
const { data: usuariosData } = useUsuariosQuery();
const { data: tiposUsuarioData } = useTiposUsuarioQuery();
const eliminarUsuario = useEliminarUsuario();
const pushActividad = usePushActividad();

const usuarios = computed(() => usuariosData.value ?? []);
const tiposUsuario = computed(() => tiposUsuarioData.value ?? []);

const rolBadge: Record<RolUsuario, string> = {
  superusuario: 'bg-amber-50 text-amber-700 border border-amber-200',
  administrador: 'bg-brand-50 text-brand-700 border border-brand-200',
  cliente: 'bg-sky-50 text-sky-700 border border-sky-200',
  administrativo_asesorias: 'bg-teal-50 text-teal-700 border border-teal-200',
  asesor: 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200',
};

const origenBadge: Record<OrigenCliente, { label: string; icon: typeof faGraduationCap; class: string }> = {
  alumno: { label: 'Alumno', icon: faGraduationCap, class: 'bg-brand-50 text-brand-700' },
  externo: { label: 'Externo', icon: faGlobe, class: 'bg-gray-100 text-gray-600' },
};

const actorRol = computed(() => session.sesion?.rol ?? 'cliente');
const rolesVisibles = computed(() => rolesGestionablesPor(actorRol.value));

const filtroRol = ref<RolUsuario | ''>('');
const filtroOrigen = ref<OrigenCliente | ''>('');
const busqueda = ref('');

const lista = computed(() => {
  const q = busqueda.value.trim().toLowerCase();
  return usuarios.value.filter((u) => {
    if (!rolesVisibles.value.includes(u.rol)) return false;
    if (filtroRol.value && u.rol !== filtroRol.value) return false;
    if (filtroOrigen.value && u.origen !== filtroOrigen.value) return false;
    if (q && !u.nombre.toLowerCase().includes(q) && !u.usuario.toLowerCase().includes(q)) return false;
    return true;
  });
});

const rolesFiltrables = computed(() => rolesVisibles.value);

const showModal = ref(false);
const showRolesModal = ref(false);
const editTarget = ref<Usuario | null>(null);
const deleteTarget = ref<Usuario | null>(null);
const permisosTarget = ref<Usuario | null>(null);

// El nivel de plan del cliente (para calcular sus permisos IA/mentorías por defecto) vive bajo la
// facturación de la cuenta titular — un colaborador comparte el nivel de su titular.
const cuentaIdPermisos = computed(() => {
  const u = permisosTarget.value;
  return u && u.rol === 'cliente' ? (u.cuentaClienteId ?? u.id) : '';
});
const { data: facturacionPermisos } = useFacturacionQuery(cuentaIdPermisos);
const numeroNivelPermisos = computed(() => (cuentaIdPermisos.value ? numeroNivelDe(facturacionPermisos.value?.planId ?? 'nivel-1') : 0));

function handleNuevo() {
  editTarget.value = null;
  showModal.value = true;
}
function handleEditar(u: Usuario) {
  editTarget.value = u;
  showModal.value = true;
}
async function handleDelete() {
  if (!deleteTarget.value) return;
  await eliminarUsuario.mutateAsync(deleteTarget.value.id);
  await pushActividad.mutateAsync({ mensaje: `Se eliminó el usuario "${deleteTarget.value.nombre}"`, color: 'red' });
  ui.toast(`Usuario "${deleteTarget.value.nombre}" eliminado`);
  deleteTarget.value = null;
}
</script>

<template>
  <PageShell
    :icon="faUserGear"
    title="Usuarios y permisos"
    :description="actorRol === 'superusuario' ? 'Gestiona superusuarios, administradores, clientes y sus permisos' : 'Gestiona los clientes del sistema y sus permisos'"
    content-class="overflow-auto"
  >
    <template #actions>
      <button
        @click="showRolesModal = true"
        type="button"
        class="px-5 py-2.5 rounded-lg bg-white/[0.06] border border-white/10 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faTags" class="w-3.5 h-3.5" />
        Gestionar roles
      </button>
      <button
        @click="handleNuevo"
        type="button"
        class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faPlus" class="w-3.5 h-3.5" />
        Nuevo usuario
      </button>
    </template>

    <div class="flex flex-wrap items-center gap-3 px-6 pt-6 pb-2">
      <div class="relative">
        <FontAwesomeIcon :icon="faUserGroup" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <select
          v-model="filtroRol"
          class="appearance-none pl-9 pr-8 py-2.5 rounded-lg border border-gray-200 text-sm text-heading bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        >
          <option value="">Todos los roles</option>
          <option v-for="r in rolesFiltrables" :key="r" :value="r">{{ rolUsuarioLabels[r] }}</option>
        </select>
      </div>
      <div class="relative">
        <FontAwesomeIcon :icon="faGlobe" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <select
          v-model="filtroOrigen"
          class="appearance-none pl-9 pr-8 py-2.5 rounded-lg border border-gray-200 text-sm text-heading bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        >
          <option value="">Todos los orígenes</option>
          <option value="alumno">Alumno</option>
          <option value="externo">Externo</option>
        </select>
      </div>
      <div class="relative ml-auto">
        <FontAwesomeIcon :icon="faSearch" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          v-model="busqueda"
          type="text"
          placeholder="Buscar usuario..."
          class="w-64 pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
      </div>
    </div>

    <table class="w-full">
      <thead>
        <tr class="border-b border-gray-100">
          <th class="text-left text-[11px] font-semibold uppercase tracking-wider text-muted px-6 py-4">Nombre</th>
          <th class="text-left text-[11px] font-semibold uppercase tracking-wider text-muted px-4 py-4">Usuario</th>
          <th class="text-left text-[11px] font-semibold uppercase tracking-wider text-muted px-4 py-4">Rol</th>
          <th class="text-left text-[11px] font-semibold uppercase tracking-wider text-muted px-4 py-4">Origen</th>
          <th class="text-center text-[11px] font-semibold uppercase tracking-wider text-muted px-6 py-4">Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in lista" :key="u.id" class="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
          <td class="px-6 py-4 font-semibold text-heading text-sm">{{ u.nombre }}</td>
          <td class="px-4 py-4 text-sm text-gray-600 font-mono">{{ u.usuario }}</td>
          <td class="px-4 py-4">
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full" :class="rolBadge[u.rol]">
              {{ tiposUsuario.find((t) => t.id === u.tipoUsuarioId)?.nombre ?? rolUsuarioLabels[u.rol] }}
            </span>
          </td>
          <td class="px-4 py-4">
            <span
              v-if="u.origen"
              class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
              :class="origenBadge[u.origen].class"
            >
              <FontAwesomeIcon :icon="origenBadge[u.origen].icon" class="w-3 h-3" />
              {{ origenBadge[u.origen].label }}
            </span>
            <span v-else class="text-sm text-gray-300">—</span>
          </td>
          <td class="px-6 py-4">
            <div class="flex items-center justify-center gap-2">
              <button
                @click="permisosTarget = u"
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors"
              >
                <FontAwesomeIcon :icon="faShieldHalved" class="w-3 h-3" />
                Permisos
              </button>
              <button
                @click="handleEditar(u)"
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-sidebar hover:bg-heading transition-colors"
              >
                <FontAwesomeIcon :icon="faPen" class="w-3 h-3" />
                Editar
              </button>
              <button
                @click="deleteTarget = u"
                :disabled="u.id === session.sesion?.usuarioId"
                :title="u.id === session.sesion?.usuarioId ? 'No puedes eliminar tu propia cuenta' : 'Eliminar'"
                type="button"
                class="inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
              >
                <FontAwesomeIcon :icon="faTrash" class="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="lista.length === 0">
          <td colspan="5" class="px-6 py-8 text-center text-sm text-muted">No hay usuarios para mostrar.</td>
        </tr>
      </tbody>
    </table>

    <UsuarioModal :is-open="showModal" :actor-rol="actorRol" :usuario="editTarget" :usuarios="usuarios" @close="showModal = false" />

    <GestionarRolesModal :is-open="showRolesModal" @close="showRolesModal = false" />

    <PermisosUsuarioModal
      :is-open="!!permisosTarget"
      :usuario="permisosTarget"
      :numero-nivel="numeroNivelPermisos"
      @close="permisosTarget = null"
    />

    <ConfirmModal
      :is-open="!!deleteTarget"
      title="Eliminar usuario"
      :message="`¿Seguro que deseas eliminar a &quot;${deleteTarget?.nombre}&quot;? Esta acción no se puede deshacer.`"
      @confirm="handleDelete"
      @close="deleteTarget = null"
    />
  </PageShell>
</template>
