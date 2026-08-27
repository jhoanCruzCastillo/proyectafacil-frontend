<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faHouse, faLayerGroup, faAnglesLeft, faAnglesRight, faUserGear, faCalendarWeek, faCalendarCheck, faCircleInfo, faCircleExclamation, faListCheck, faHeadset, faPeopleGroup, faMoneyBillTransfer, faClock, faFolderOpen, faChevronUp, faChevronDown, instrumentoIcons } from '@/lib/icons';
import UserMenu from '@/features/settings/UserMenu.vue';
import MejorarPlanCard from '@/features/settings/MejorarPlanCard.vue';
import NotificacionesBell from '@/features/asesoria/NotificacionesBell.vue';
import { useSessionStore } from '@/stores/session';
import { puedeAccederGestionUsuarios } from '@/lib/permisos';
import logo from '@/assets/logo.png';

const session = useSessionStore();
const esCliente = computed(() => session.sesion?.rol === 'cliente');
const esAsesor = computed(() => session.sesion?.rol === 'asesor');

interface NavLink { to: string; label: string; icon: typeof faHouse }
// Un ítem del menú es un link directo (trae `to`) o un grupo desplegable (trae `children`,
// sin ruta propia) — nunca ambos. `to` queda opcional solo para que un mismo array admita las
// dos formas sin dos interfaces separadas.
interface NavItem { to?: string; label: string; icon: typeof faHouse; children?: NavLink[] }

// "Gestión de fichas": agrupa Formatos/Fichas técnicas/IOARR/Perfiles bajo un solo desplegable —
// mismos 4 instrumentos, dos ubicaciones distintas (cliente en la raíz, catálogo del superusuario
// bajo /catalogo), por eso el prefijo de ruta es el único parámetro.
function grupoGestionFichas(prefijo: string): NavItem {
  return {
    label: 'Gestión de fichas',
    icon: faFolderOpen,
    children: [
      { to: `${prefijo}/formatos`, label: 'Formatos', icon: instrumentoIcons.formato },
      { to: `${prefijo}/fichas-tecnicas`, label: 'Fichas técnicas', icon: instrumentoIcons.ficha_tecnica },
      { to: `${prefijo}/ioarr`, label: 'IOARR', icon: instrumentoIcons.ioarr },
      { to: `${prefijo}/perfiles`, label: 'Perfiles', icon: instrumentoIcons.perfil },
    ],
  };
}

const navItems = computed(() => {
  let items: NavItem[];
  if (esCliente.value) {
    items = [
      grupoGestionFichas(''),
      { to: '/asesorias', label: 'Asesorías en vivo', icon: faHeadset },
    ];
  } else if (esAsesor.value) {
    items = [
      { to: '/docente/consultas', label: 'Mis consultas', icon: faHouse },
      { to: '/docente/especialidades', label: 'Temas de especialidad', icon: faListCheck },
      { to: '/docente/horario', label: 'Mi disponibilidad', icon: faCalendarWeek },
      { to: '/docente/cronograma', label: 'Cronograma', icon: faCalendarCheck },
      { to: '/docente/no-atendidas', label: 'No atendidas / reasignadas', icon: faCircleExclamation },
      { to: '/docente/liquidacion', label: 'Mi Liquidación', icon: faMoneyBillTransfer },
    ];
  } else {
    items = [
      { to: '/', label: 'Inicio', icon: faHouse },
      { to: '/sectores', label: 'Sectores', icon: faLayerGroup },
    ];
    // Catálogo por instrumento — atraviesa todos los sectores, a diferencia de "Sectores".
    if (session.sesion?.rol === 'superusuario') {
      items.push(grupoGestionFichas('/catalogo'));
    }
    if (session.sesion?.rol === 'administrativo_asesorias' || session.sesion?.rol === 'superusuario') {
      items.push({ to: '/asesoria/tickets', label: 'Tickets de asesoría', icon: faListCheck });
      items.push({ to: '/asesoria/cobertura-horarios', label: 'Cobertura de horarios', icon: faCalendarWeek });
      items.push({ to: '/asesoria/docentes', label: 'Docentes', icon: faPeopleGroup });
      items.push({ to: '/asesoria/liquidaciones', label: 'Liquidaciones', icon: faMoneyBillTransfer });
      items.push({ to: '/asesoria/configuracion-sla', label: 'Configuración de SLA', icon: faClock });
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

// Un solo grupo desplegable existe hoy en todo el sidebar — no hace falta un estado por grupo.
const gestionFichasAbierto = ref(true);

const props = defineProps<{ collapsed?: boolean }>();
const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <aside
    class="fixed left-0 top-0 bottom-0 bg-sidebar text-white flex flex-col z-40 transition-[width] duration-150 ease-out overflow-x-hidden"
    :class="collapsed ? 'w-16' : 'w-56'"
  >
    <div
      class="flex items-center border-b border-white/10"
      :class="collapsed ? 'justify-center px-0 py-4' : 'gap-3 px-5 py-5'"
    >
      <!-- Colapsado: el botón de expandir vive superpuesto sobre el logo, oculto hasta el hover
           del mismo hueco — así el header no gana una fila extra ni empuja la navegación hacia
           abajo (antes el botón se apilaba debajo del logo). -->
      <div v-if="collapsed" class="relative w-9 h-9 shrink-0 group">
        <img :src="logo" alt="" class="w-9 h-9 object-contain absolute inset-0 transition-opacity duration-100 group-hover:opacity-0" />
        <button
          @click="emit('toggle')"
          class="absolute inset-0 w-9 h-9 rounded-md flex items-center justify-center text-white/50 hover:text-white hover:bg-sidebar-hover transition-opacity duration-100 opacity-0 group-hover:opacity-100"
          title="Expandir menú"
        >
          <FontAwesomeIcon :icon="faAnglesRight" class="w-3.5 h-3.5" />
        </button>
      </div>
      <template v-else>
        <img :src="logo" alt="" class="w-9 h-9 object-contain shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm leading-tight">
            <span class="text-white">Proyecta</span><span class="text-brand-400">Fácil</span>
          </div>
          <div class="text-[11px] text-white/50 leading-tight">Editor de plantillas</div>
        </div>
        <button
          @click="emit('toggle')"
          class="w-7 h-7 rounded-md flex items-center justify-center text-white/50 hover:text-white hover:bg-sidebar-hover transition-colors duration-75 shrink-0"
          title="Colapsar menú"
        >
          <FontAwesomeIcon :icon="faAnglesLeft" class="w-3.5 h-3.5" />
        </button>
      </template>
    </div>

    <nav class="flex-1 min-h-0 overflow-y-auto px-3 pt-6">
      <p v-if="!collapsed" class="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-3 mb-3">
        Navegación
      </p>
      <ul class="space-y-1">
        <template v-for="item in navItems" :key="item.to ?? item.label">
          <!-- Grupo desplegable ("Gestión de fichas"): colapsado no tiene sentido un desplegable
               sin texto, así que se aplana a sus hijos como links sueltos, igual que cualquier
               otro ítem en modo ícono. -->
          <template v-if="item.children">
            <template v-if="collapsed">
              <li v-for="child in item.children" :key="child.to">
                <RouterLink :to="child.to" custom v-slot="{ href, navigate, isExactActive }">
                  <a
                    :href="href"
                    @click="navigate"
                    :title="child.label"
                    class="flex items-center justify-center px-0 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    :class="isExactActive ? 'bg-sidebar-active text-white shadow-card' : 'text-white/65 hover:bg-sidebar-hover hover:text-white'"
                  >
                    <FontAwesomeIcon :icon="child.icon" class="w-4 text-center shrink-0" />
                  </a>
                </RouterLink>
              </li>
            </template>
            <li v-else>
              <button
                @click="gestionFichasAbierto = !gestionFichasAbierto"
                type="button"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/90 hover:bg-sidebar-hover hover:text-white transition-colors"
              >
                <FontAwesomeIcon :icon="item.icon" class="w-4 text-center shrink-0 text-brand-400" />
                <span class="flex-1 text-left">{{ item.label }}</span>
                <FontAwesomeIcon :icon="gestionFichasAbierto ? faChevronUp : faChevronDown" class="w-2.5 h-2.5 text-white/40 shrink-0" />
              </button>
              <div v-if="gestionFichasAbierto" class="relative ml-5 mt-1 space-y-1">
                <div class="absolute left-0 top-1 bottom-1 w-px bg-white/10" />
                <RouterLink v-for="child in item.children" :key="child.to" :to="child.to" custom v-slot="{ href, navigate, isExactActive }">
                  <a
                    :href="href"
                    @click="navigate"
                    class="relative flex items-center gap-2.5 pl-4 pr-3 py-2 rounded-lg text-sm transition-colors"
                    :class="isExactActive ? 'bg-gradient-to-r from-brand-600/15 to-brand-600 text-white shadow-card font-semibold' : 'text-white/60 hover:bg-sidebar-hover hover:text-white'"
                  >
                    <span v-if="isExactActive" class="absolute left-0 top-1 bottom-1 w-1 rounded-full bg-brand-300" />
                    <span v-else class="absolute left-0 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                    <FontAwesomeIcon :icon="child.icon" class="w-3.5 text-center shrink-0" />
                    <span class="flex-1">{{ child.label }}</span>
                  </a>
                </RouterLink>
              </div>
            </li>
          </template>

          <!-- Link simple -->
          <li v-else>
            <RouterLink :to="item.to!" custom v-slot="{ href, navigate, isExactActive }">
              <a
                :href="href"
                @click="navigate"
                :title="collapsed ? item.label : undefined"
                class="relative flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                :class="[
                  isExactActive ? 'bg-gradient-to-r from-brand-600/15 to-brand-600 text-white shadow-card font-semibold' : 'text-white/65 hover:bg-sidebar-hover hover:text-white',
                  collapsed ? 'justify-center px-0' : 'gap-3',
                ]"
              >
                <span v-if="isExactActive && !collapsed" class="absolute left-0 top-1 bottom-1 w-1 rounded-full bg-brand-300" />
                <FontAwesomeIcon :icon="item.icon" class="w-4 text-center shrink-0" />
                <span v-if="!collapsed" class="flex-1">{{ item.label }}</span>
              </a>
            </RouterLink>
          </li>
        </template>
      </ul>
    </nav>

    <MejorarPlanCard v-if="esCliente && !collapsed" />
    <NotificacionesBell v-if="session.sesion" :collapsed="props.collapsed" />
    <UserMenu :collapsed="props.collapsed" />
  </aside>
</template>
