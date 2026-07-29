<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faXmark, faShieldHalved, faCircleCheck, faInfoCircle, faSave,
  faUserGear, faBook, faLayerGroup, faGraduationCap, faMoneyBillTransfer, faGear,
  faUser, faFileCirclePlus, faCreditCard, faChalkboardUser, faHeadset, faComments, faVideo, faCalendarWeek,
  rolUsuarioLabels,
} from '@/lib/icons';
import { CATEGORIAS_PERMISOS_POR_ROL, claveCategoriaDe, permisosDe, permisosDefaultPorRol, type ClaveCategoriaRol } from '@/lib/permisosCatalogo';
import { useRolesPermisosQuery } from '@/composables/useRolesPermisos';
import { useActualizarUsuario } from '@/composables/useUsuarios';
import { useUiStore } from '@/stores/ui';
import PermisoCategoriaCard from './PermisoCategoriaCard.vue';
import type { ItemCategoriaPermiso } from './PermisoCategoriaCard.vue';
import type { Usuario, PermisoId } from '@/types';

const props = defineProps<{ isOpen: boolean; usuario: Usuario | null; numeroNivel: number }>();
const emit = defineEmits<{ close: [] }>();

const ui = useUiStore();
const { data: rolesBaseData } = useRolesPermisosQuery();
const actualizarUsuario = useActualizarUsuario();

const CATEGORIA_ICON = { administrador: faBook, administrativo_asesorias: faGraduationCap, cliente: faUser, asesor: faHeadset } as const;
const ITEM_ICON: Partial<Record<PermisoId, typeof faUserGear>> = {
  'usuarios.gestionar': faUserGear,
  'roles.gestionar': faShieldHalved,
  'sectores.gestionar': faLayerGroup,
  'asesoria.tickets_gestionar': faGraduationCap,
  'asesoria.cobertura_horarios': faCalendarWeek,
  'asesoria.matchmaking': faUserGear,
  'asesoria.autorizar_pagos': faMoneyBillTransfer,
  'asesoria.configurar_sla': faGear,
  'fichas.crear': faFileCirclePlus,
  'facturacion.gestionar': faCreditCard,
  'asesoria.solicitar': faChalkboardUser,
  'asesoria.atender_chat': faComments,
  'asesoria.atender_video': faVideo,
  'asesoria.marcar_disponibilidad': faCalendarWeek,
};
const TEMA: Record<ClaveCategoriaRol | 'amber', { border: string; iconBg: string; titulo: string; itemIconBg: string }> = {
  administrador: { border: 'border-brand-200', iconBg: 'bg-brand-100 text-brand-600', titulo: 'text-brand-700', itemIconBg: 'bg-brand-50 text-brand-600' },
  administrativo_asesorias: { border: 'border-teal-200', iconBg: 'bg-teal-100 text-teal-600', titulo: 'text-teal-700', itemIconBg: 'bg-teal-50 text-teal-600' },
  cliente: { border: 'border-sky-200', iconBg: 'bg-sky-100 text-sky-600', titulo: 'text-sky-700', itemIconBg: 'bg-sky-50 text-sky-600' },
  asesor: { border: 'border-violet-200', iconBg: 'bg-violet-100 text-violet-600', titulo: 'text-violet-700', itemIconBg: 'bg-violet-50 text-violet-600' },
  amber: { border: 'border-amber-200', iconBg: 'bg-amber-100 text-amber-600', titulo: 'text-amber-700', itemIconBg: 'bg-amber-50 text-amber-600' },
};

const seleccionados = ref<Set<PermisoId>>(new Set());

const baseDelRol = computed<PermisoId[]>(() => {
  if (!props.usuario) return [];
  return rolesBaseData.value?.[props.usuario.rol] ?? permisosDefaultPorRol(props.usuario.rol, props.numeroNivel);
});

watch(
  [() => props.isOpen, () => props.usuario, rolesBaseData],
  ([open, usuario]) => {
    if (open && usuario) seleccionados.value = new Set(permisosDe(usuario, props.numeroNivel));
  },
);

const claveCategoriaPropia = computed(() => (props.usuario ? claveCategoriaDe(props.usuario.rol) : null));

const categoriasAMostrar = computed(() => {
  return CATEGORIAS_PERMISOS_POR_ROL.filter((cat) => {
    if (cat.clave === claveCategoriaPropia.value) return true;
    return cat.items.some((i) => seleccionados.value.has(i.id) && !baseDelRol.value.includes(i.id));
  });
});

function itemsDeCategoria(itemsDef: { id: PermisoId; etiqueta: string; descripcion: string }[]): ItemCategoriaPermiso[] {
  return itemsDef.map((d) => ({ ...d, icon: ITEM_ICON[d.id] ?? faUserGear, activo: seleccionados.value.has(d.id) }));
}

function toggle(id: PermisoId) {
  const next = new Set(seleccionados.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  seleccionados.value = next;
}

async function handleGuardar() {
  if (!props.usuario) return;
  // No tocar permisos fuera de estas categorías curadas (ej. catálogo granular histórico) —
  // solo se reemplaza el estado de lo que este modal realmente controla.
  const idsControlados = new Set(CATEGORIAS_PERMISOS_POR_ROL.flatMap((c) => c.items.map((i) => i.id)));
  const actuales = permisosDe(props.usuario, props.numeroNivel);
  const permisosFinal = [...actuales.filter((id) => !idsControlados.has(id)), ...seleccionados.value];

  await actualizarUsuario.mutateAsync({ id: props.usuario.id, data: { permisos: permisosFinal } });
  ui.toast(`Permisos de "${props.usuario.nombre}" actualizados`);
  emit('close');
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen && usuario" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" @click.stop>
          <div class="flex items-start justify-between p-6 pb-4 shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center">
                <FontAwesomeIcon :icon="faShieldHalved" class="w-4 h-4" />
              </div>
              <div>
                <h2 class="text-lg font-bold text-heading">Permisos individuales: {{ usuario.nombre }}</h2>
                <p class="text-sm text-muted">
                  Ajustes específicos para este usuario, además de su rol base
                  <span class="font-semibold text-brand-600">({{ rolUsuarioLabels[usuario.rol] }})</span>
                </p>
              </div>
            </div>
            <button @click="emit('close')" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100">
              <FontAwesomeIcon :icon="faXmark" />
            </button>
          </div>

          <div v-if="usuario.rol === 'superusuario'" class="px-6 pb-6">
            <div class="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
              <FontAwesomeIcon :icon="faCircleCheck" class="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p class="text-sm text-amber-800">
                Los superusuarios siempre tienen acceso a todos los permisos del sistema — no se pueden restringir.
              </p>
            </div>
          </div>
          <template v-else>
            <div class="px-6 overflow-y-auto flex-1 space-y-4 pb-4">
              <p class="flex items-start gap-2.5 text-sm text-brand-800 bg-brand-50 border border-brand-100 rounded-lg px-4 py-3">
                <FontAwesomeIcon :icon="faInfoCircle" class="w-4 h-4 mt-0.5 shrink-0" />
                Estos permisos sobrescriben (habilitan o limitan) lo que ya incluye su rol. Los permisos no definidos aquí se mantendrán según su rol base.
              </p>

              <PermisoCategoriaCard
                v-for="cat in categoriasAMostrar"
                :key="cat.clave"
                :titulo="cat.nombre"
                :descripcion="cat.clave === claveCategoriaPropia ? `Permisos estándar incluidos en su rol base (${rolUsuarioLabels[usuario.rol]})` : `Permisos relacionados a ${cat.nombre.toLowerCase()}.`"
                :icon="CATEGORIA_ICON[cat.clave]"
                :es-extra="cat.clave !== claveCategoriaPropia"
                :border-class="cat.clave === claveCategoriaPropia ? TEMA[cat.clave].border : TEMA.amber.border"
                :icon-bg-class="cat.clave === claveCategoriaPropia ? TEMA[cat.clave].iconBg : TEMA.amber.iconBg"
                :titulo-class="cat.clave === claveCategoriaPropia ? TEMA[cat.clave].titulo : TEMA.amber.titulo"
                :item-icon-bg-class="TEMA[cat.clave].itemIconBg"
                :items="itemsDeCategoria(cat.items)"
                @toggle="toggle"
              />
            </div>

            <div class="flex justify-end px-6 py-4 border-t border-gray-100 shrink-0 gap-3">
              <button @click="emit('close')" class="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-75">
                Cancelar
              </button>
              <button
                @click="handleGuardar"
                type="button"
                class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors duration-75 flex items-center gap-2"
              >
                <FontAwesomeIcon :icon="faSave" class="w-3.5 h-3.5" />
                Guardar cambios
              </button>
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
