<script setup lang="ts">
import { ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faXmark, faSave, faShieldHalved, faCrown, faUserGear, faUserGroup, faUser, faBriefcase } from '@/lib/icons';
import { useRolesPermisosQuery, useGuardarRolPermisos } from '@/composables/useRolesPermisos';
import { permisosDefaultPorRol } from '@/lib/permisosCatalogo';
import { useUiStore } from '@/stores/ui';
import RolPermisosCard from './RolPermisosCard.vue';
import type { PermisoId } from '@/types';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ close: [] }>();

const ui = useUiStore();
const { data: base } = useRolesPermisosQuery();
const guardarRol = useGuardarRolPermisos();

const administrador = ref<PermisoId[]>([]);
const administrativoAsesorias = ref<PermisoId[]>([]);
const cliente = ref<PermisoId[]>([]);
const asesor = ref<PermisoId[]>([]);
const guardando = ref(false);

function cargar() {
  administrador.value = base.value?.administrador ?? permisosDefaultPorRol('administrador', 0);
  administrativoAsesorias.value = base.value?.administrativo_asesorias ?? permisosDefaultPorRol('administrativo_asesorias', 0);
  cliente.value = base.value?.cliente ?? permisosDefaultPorRol('cliente', 0);
  asesor.value = base.value?.asesor ?? permisosDefaultPorRol('asesor', 0);
}

watch(() => props.isOpen, (open) => { if (open) cargar(); });
watch(base, () => { if (props.isOpen) cargar(); });

const administradorItems = itemsDe(['usuarios.gestionar', 'roles.gestionar', 'sectores.gestionar', 'plantillas.gestionar']);
const asesoriasItems = itemsDe(['asesoria.tickets_gestionar', 'asesoria.cobertura_horarios', 'asesoria.matchmaking', 'asesoria.autorizar_pagos', 'asesoria.configurar_sla']);
const clienteItems = itemsDe(['fichas.crear', 'facturacion.gestionar', 'asesoria.solicitar']);
const asesorItems = itemsDe(['asesoria.atender_chat', 'asesoria.atender_video', 'asesoria.marcar_disponibilidad']);

function itemsDe(ids: PermisoId[]) {
  const etiquetas: Partial<Record<PermisoId, string>> = {
    'usuarios.gestionar': 'Gestionar usuarios',
    'roles.gestionar': 'Gestionar roles y permisos',
    'sectores.gestionar': 'Gestionar sectores',
    'plantillas.gestionar': 'Gestionar fichas oficiales',
    'asesoria.tickets_gestionar': 'Gestionar tickets de asesoría',
    'asesoria.cobertura_horarios': 'Ver cobertura de horarios',
    'asesoria.matchmaking': 'Intervenir en matchmaking',
    'asesoria.autorizar_pagos': 'Autorizar pagos a asesores',
    'asesoria.configurar_sla': 'Configurar SLA',
    'fichas.crear': 'Llenar fichas técnicas',
    'facturacion.gestionar': 'Comprar planes y add-ons',
    'asesoria.solicitar': 'Solicitar asesoría',
    'asesoria.atender_chat': 'Responder chat',
    'asesoria.atender_video': 'Atender videollamada',
    'asesoria.marcar_disponibilidad': 'Marcar disponibilidad',
  };
  return ids.map((id) => ({ id, etiqueta: etiquetas[id] ?? id }));
}

async function handleGuardar() {
  guardando.value = true;
  try {
    await Promise.all([
      guardarRol.mutateAsync({ rol: 'administrador', permisos: administrador.value }),
      guardarRol.mutateAsync({ rol: 'administrativo_asesorias', permisos: administrativoAsesorias.value }),
      guardarRol.mutateAsync({ rol: 'cliente', permisos: cliente.value }),
      guardarRol.mutateAsync({ rol: 'asesor', permisos: asesor.value }),
    ]);
    ui.toast('Permisos base actualizados');
    emit('close');
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-3xl max-h-[90vh] overflow-y-auto" @click.stop>
          <div class="flex items-start justify-between p-6 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faShieldHalved" class="w-4 h-4" />
              </div>
              <div>
                <h2 class="text-lg font-bold text-heading">Gestionar roles y permisos base</h2>
                <p class="text-sm text-muted">Define qué puede hacer cada rol por defecto</p>
              </div>
            </div>
            <button @click="emit('close')" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <div class="px-6 pb-6 space-y-4">
            <RolPermisosCard
              titulo="Superusuario"
              descripcion="Acceso total a la plataforma"
              :icon="faCrown"
              border-class="border-amber-200 bg-amber-50/30"
              icon-bg-class="bg-amber-100 text-amber-600"
              titulo-class="text-amber-700"
              check-class=""
              :items="[]"
              :model-value="[]"
              locked
              locked-note="Todos los permisos están activos y no se pueden modificar."
            />

            <RolPermisosCard
              v-model="administrador"
              titulo="Administrador"
              :icon="faUserGear"
              border-class="border-brand-200"
              icon-bg-class="bg-brand-100 text-brand-600"
              titulo-class="text-brand-700"
              check-class="bg-brand-500 border-brand-500"
              :items="administradorItems"
            />

            <RolPermisosCard
              v-model="administrativoAsesorias"
              titulo="Administrativo de Asesorías"
              :icon="faUserGroup"
              border-class="border-teal-200"
              icon-bg-class="bg-teal-100 text-teal-600"
              titulo-class="text-teal-700"
              check-class="bg-teal-500 border-teal-500"
              :items="asesoriasItems"
            />

            <RolPermisosCard
              v-model="cliente"
              titulo="Cliente"
              :icon="faUser"
              border-class="border-sky-200"
              icon-bg-class="bg-sky-100 text-sky-600"
              titulo-class="text-sky-700"
              check-class="bg-sky-500 border-sky-500"
              :items="clienteItems"
            />

            <RolPermisosCard
              v-model="asesor"
              titulo="Asesor"
              :icon="faBriefcase"
              border-class="border-violet-200"
              icon-bg-class="bg-violet-100 text-violet-600"
              titulo-class="text-violet-700"
              check-class="bg-violet-500 border-violet-500"
              :items="asesorItems"
            />
          </div>

          <div class="flex justify-end px-6 py-4 border-t border-gray-100">
            <button
              @click="handleGuardar"
              :disabled="guardando"
              type="button"
              class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors duration-75 flex items-center gap-2"
            >
              <FontAwesomeIcon :icon="faSave" class="w-3.5 h-3.5" />
              Guardar cambios
            </button>
          </div>
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
