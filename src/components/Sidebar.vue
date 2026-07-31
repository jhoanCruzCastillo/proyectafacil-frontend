<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faHouse, faLayerGroup, faAngleLeft, faUserGear, faCalendarWeek, faCircleInfo, faListCheck, faHeadset, faPeopleGroup, faMoneyBillTransfer, instrumentoIcons } from '@/lib/icons';
import UserMenu from '@/features/settings/UserMenu.vue';
import NotificacionesBell from '@/features/asesoria/NotificacionesBell.vue';
import { useSessionStore } from '@/stores/session';
import { puedeAccederGestionUsuarios } from '@/lib/permisos';
import logo from '@/assets/logo.png';

const session = useSessionStore();
const esCliente = computed(() => session.sesion?.rol === 'cliente');
const esAsesor = computed(() => session.sesion?.rol === 'asesor');

const navItems = computed(() => {
  let items: { to: string; label: string; icon: typeof faHouse }[];
  if (esCliente.value) {
    items = [
      { to: '/formatos', label: 'Formatos', icon: instrumentoIcons.formato },
      { to: '/fichas-tecnicas', label: 'Fichas técnicas', icon: instrumentoIcons.ficha_tecnica },
      { to: '/ioarr', label: 'IOARR', icon: instrumentoIcons.ioarr },
      { to: '/perfiles', label: 'Perfiles', icon: instrumentoIcons.perfil },
      { to: '/asesorias', label: 'Asesorías en vivo', icon: faHeadset },
    ];
  } else if (esAsesor.value) {
    items = [
      { to: '/docente/consultas', label: 'Mis consultas', icon: faHouse },
      { to: '/docente/especialidades', label: 'Mis especialidades', icon: faListCheck },
      { to: '/docente/horario', label: 'Mi disponibilidad', icon: faCalendarWeek },
    ];
  } else {
    items = [
      { to: '/', label: 'Inicio', icon: faHouse },
      { to: '/sectores', label: 'Sectores', icon: faLayerGroup },
    ];
    if (session.sesion?.rol === 'administrativo_asesorias' || session.sesion?.rol === 'superusuario') {
      items.push({ to: '/asesoria/tickets', label: 'Tickets de asesoría', icon: faListCheck });
      items.push({ to: '/asesoria/cobertura-horarios', label: 'Cobertura de horarios', icon: faCalendarWeek });
      items.push({ to: '/asesoria/docentes', label: 'Docentes', icon: faPeopleGroup });
      items.push({ to: '/asesoria/liquidaciones', label: 'Liquidaciones', icon: faMoneyBillTransfer });
    }
  }
  if (session.sesion && puedeAccederGestionUsuarios(session.sesion.rol)) {
    items.push({ to: '/usuarios', label: 'Usuarios y permisos', icon: faUserGear });
  }
  if (session.sesion?.rol === 'superusuario') {
    items.push({ to: '/about', label: 'About', icon: faCircleInfo });
  }
  return items;
});

defineProps<{ hidden?: boolean }>();
const emit = defineEmits<{ hide: [] }>();
</script>

<template>
  <aside
    class="fixed left-0 top-0 bottom-0 w-56 bg-sidebar text-white flex flex-col z-40 transition-transform duration-150 ease-out"
    :class="hidden ? '-translate-x-full' : 'translate-x-0'"
  >
    <div class="px-5 py-5 flex items-center gap-3 border-b border-white/10">
      <img :src="logo" alt="" class="w-9 h-9 object-contain shrink-0" />
      <div class="flex-1 min-w-0">
        <div class="font-bold text-sm leading-tight">
          <span class="text-white">Proyecta</span><span class="text-brand-400">Fácil</span>
        </div>
        <div class="text-[11px] text-white/50 leading-tight">Editor de plantillas</div>
      </div>
      <button
        @click="emit('hide')"
        class="w-7 h-7 rounded-md flex items-center justify-center text-white/50 hover:text-white hover:bg-sidebar-hover transition-colors duration-75 shrink-0"
        title="Ocultar menú"
      >
        <FontAwesomeIcon :icon="faAngleLeft" class="w-3.5 h-3.5" />
      </button>
    </div>

    <nav class="flex-1 px-3 pt-6">
      <p class="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-3 mb-3">
        Navegación
      </p>
      <ul class="space-y-1">
        <li v-for="item in navItems" :key="item.to">
          <RouterLink
            :to="item.to"
            custom
            v-slot="{ href, navigate, isExactActive }"
          >
            <a
              :href="href"
              @click="navigate"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              :class="isExactActive ? 'bg-sidebar-active text-white shadow-card' : 'text-white/65 hover:bg-sidebar-hover hover:text-white'"
            >
              <FontAwesomeIcon :icon="item.icon" class="w-4 text-center" />
              <span class="flex-1">{{ item.label }}</span>
            </a>
          </RouterLink>
        </li>
      </ul>
    </nav>

    <NotificacionesBell v-if="session.sesion" />
    <UserMenu />
  </aside>
</template>
