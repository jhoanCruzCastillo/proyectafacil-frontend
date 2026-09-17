<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faHouse, faLayerGroup, faAnglesLeft, faAnglesRight, faUserGear, faCalendarWeek, faCalendarCheck, faCircleInfo, faCircleExclamation, faListCheck, faHeadset, faPeopleGroup, faUserPlus, faMoneyBillTransfer, faClock, faFolderOpen, faChevronUp, faChevronDown, faLock, faVideo, faComments, faStar, instrumentoIcons } from '@/lib/icons';
import UserMenu from '@/features/settings/UserMenu.vue';
import MejorarPlanCard from '@/features/settings/MejorarPlanCard.vue';
import NotificacionesBell from '@/features/asesoria/NotificacionesBell.vue';
import { useSessionStore } from '@/stores/session';
import { cuentaEfectivaDe, puedeAccederGestionUsuarios, puedeAccederProyectosIA, tieneServicioIlpiieLive } from '@/lib/permisos';
import { useUsuariosQuery } from '@/composables/useUsuarios';
import { useTicketsConsultaQuery } from '@/composables/useTicketsConsulta';
import { useIsDesktop, SIDEBAR_WIDTH, SIDEBAR_WIDTH_COLLAPSED } from '@/composables/useViewport';
import logoIcono from '@/assets/logo-icono.png';

const session = useSessionStore();
const route = useRoute();
const esCliente = computed(() => session.sesion?.rol === 'cliente');
const esAsesor = computed(() => session.sesion?.rol === 'asesor');

const { data: usuariosData } = useUsuariosQuery();
const cuentaIdTickets = computed(() => {
  if (!session.sesion || session.sesion.rol !== 'cliente') return '';
  return cuentaEfectivaDe(usuariosData.value ?? [], session.sesion);
});
const { data: ticketsConsulta } = useTicketsConsultaQuery(cuentaIdTickets);
const tieneIlpiieLive = computed(() => tieneServicioIlpiieLive(ticketsConsulta.value));
const tieneProyectosIA = computed(() => !!(session.sesion && puedeAccederProyectosIA(session.sesion)));

interface NavLink { to: string; label: string; icon: typeof faHouse; locked?: boolean }
// Un ítem del menú es un link directo (trae `to`) o un grupo desplegable (trae `children`,
// sin ruta propia) — nunca ambos. `to` queda opcional solo para que un mismo array admita las
// dos formas sin dos interfaces separadas. `locked`: cliente sin plan — se muestra apagado y sin
// navegación (el guard de router/index.ts ya lo rebota a "elegir-plan" de todas formas, esto solo
// lo hace visible de entrada en vez de un rebote silencioso). `accent`: identidad visual del grupo
// desplegable (fondo, borde, título, indicadores de los hijos) — pedido explícito del cliente para
// distinguir "ILPIIE Live" (rojo) de "Proyectos de Inversión con IA" (verde).
interface NavItem { to?: string; label: string; icon: typeof faHouse; children?: NavLink[]; locked?: boolean; showLock?: boolean; accent?: 'red' | 'green' | 'gray' }

// "Gestión de fichas": agrupa Formatos/Fichas técnicas/IOARR/Perfiles bajo un solo desplegable —
// mismos 4 instrumentos, dos ubicaciones distintas (cliente en la raíz, catálogo del superusuario
// bajo /catalogo), por eso el prefijo de ruta es el único parámetro.
function grupoGestionFichas(prefijo: string): NavItem {
  return {
    label: 'Proyectos de Inversión con IA',
    icon: faFolderOpen,
    accent: 'green',
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
    // Candado + gris hasta que el cliente compre el servicio; el color de marca (verde / rojo)
    // aparece recién al adquirirlo. El grupo se abre y se puede entrar igual.
    items = [
      { to: '/inicio', label: 'Inicio', icon: faHouse },
      { ...grupoGestionFichas(''), showLock: !tieneProyectosIA.value, accent: tieneProyectosIA.value ? 'green' : 'gray' },
      {
        label: 'ILPIIE Live',
        icon: faHeadset,
        accent: tieneIlpiieLive.value ? 'red' : 'gray',
        showLock: !tieneIlpiieLive.value,
        children: [
          { to: '/asesorias/chat', label: 'Por chat', icon: faComments },
          { to: '/asesorias/videollamada', label: 'Por videollamada', icon: faVideo },
        ],
      },
      { to: '/elegir-plan', label: 'Planes y servicios', icon: faStar },
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
      items.push({
        label: 'Especialistas',
        icon: faUserPlus,
        children: [
          { to: '/especialistas/candidatos', label: 'Candidatos', icon: faUserPlus },
          { to: '/especialistas/docentes', label: 'Docentes / Asesores', icon: faPeopleGroup },
        ],
      });
      items.push({ to: '/asesoria/liquidaciones', label: 'Liquidaciones', icon: faMoneyBillTransfer });
      items.push({ to: '/asesoria/configuracion-sla', label: 'Configuración de SLA', icon: faClock });
      items.push({ to: '/asesoria/configuracion-videollamadas', label: 'Configuración de videollamadas', icon: faVideo });
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

// Ahora hay más de un grupo desplegable ("Proyectos de Inversión con IA", "ILPIIE Live") — cada
// uno con su propio estado abierto/cerrado, identificado por label (ambos abiertos por defecto,
// como antes).
const gruposAbiertos = ref(new Set<string>(['Proyectos de Inversión con IA', 'ILPIIE Live']));
function toggleGrupo(label: string) {
  if (gruposAbiertos.value.has(label)) gruposAbiertos.value.delete(label);
  else gruposAbiertos.value.add(label);
}

/** Alguna subsección del grupo está en la ruta actual → el padre se marca selected. */
function grupoActivo(item: NavItem): boolean {
  return (item.children ?? []).some(
    (c) => route.path === c.to || route.path.startsWith(`${c.to}/`),
  );
}

function hijoActivo(to: string): boolean {
  return route.path === to || route.path.startsWith(`${to}/`);
}

function claseBotonGrupo(item: NavItem): string {
  const activo = grupoActivo(item);
  if (item.accent === 'red') {
    return activo
      ? 'border-red-500 bg-red-600/35 hover:bg-red-600/40'
      : 'border-red-500 bg-red-500/[0.08] hover:bg-red-500/15';
  }
  if (item.accent === 'green') {
    return activo
      ? 'border-brand-500 bg-brand-600/35 hover:bg-brand-600/40'
      : 'border-brand-500 bg-brand-500/[0.08] hover:bg-brand-500/15';
  }
  return activo
    ? 'border-slate-500 bg-white/10 hover:bg-white/12'
    : 'border-slate-600 bg-white/[0.04] hover:bg-white/[0.07]';
}

function claseTituloGrupo(item: NavItem): string {
  const activo = grupoActivo(item);
  if (item.accent === 'red') return activo ? 'font-bold text-red-200' : 'font-bold text-red-300';
  if (item.accent === 'green') return activo ? 'font-semibold text-text-primary' : 'font-semibold text-brand-300';
  return activo ? 'font-semibold text-slate-200' : 'font-semibold text-slate-400';
}

function claseChevronGrupo(item: NavItem): string {
  if (item.accent === 'red') return 'text-red-300';
  if (item.accent === 'green') return 'text-brand-300';
  return 'text-slate-500';
}

function strokeIconoGrupo(item: NavItem): string {
  if (item.accent === 'red') return '#ef4444';
  if (item.accent === 'green') return '#22c55e';
  return '#94a3b8';
}

function strokeCandadoPi(item: NavItem): string {
  return item.accent === 'green' ? '#4ade80' : '#94a3b8';
}

function fillCandadoPi(item: NavItem): string {
  return item.accent === 'green' ? '#22c55e' : '#94a3b8';
}

function claseHijo(item: NavItem, to: string): string {
  if (!hijoActivo(to)) return 'border-slate-600 text-slate-400 hover:text-slate-200';
  if (item.accent === 'red') return 'border-red-500 bg-red-600/45 text-red-50 font-semibold';
  if (item.accent === 'green') return 'border-brand-500 bg-brand-600/45 text-white font-semibold';
  return 'border-slate-400 bg-white/10 text-slate-200 font-semibold';
}

function claseNodoHijo(item: NavItem, to: string): string {
  if (!hijoActivo(to)) return 'bg-slate-600';
  if (item.accent === 'red') return 'bg-red-500';
  if (item.accent === 'green') return 'bg-brand-500';
  return 'bg-slate-400';
}

function strokeHijo(item: NavItem, to: string): string {
  if (!hijoActivo(to)) return '#94a3b8';
  if (item.accent === 'red') return '#fca5a5';
  if (item.accent === 'green') return '#86efac';
  return '#cbd5e1';
}

const props = defineProps<{
  collapsed?: boolean;
  /** Drawer abierto en pantallas angostas (<1024px) — sin efecto en escritorio. */
  mobileOpen?: boolean;
}>();
const emit = defineEmits<{ toggle: [] }>();

const isDesktop = useIsDesktop();
// En escritorio el ancho lo fija SIDEBAR_WIDTH (no es redimensionable — pedido explícito del
// cliente: lo justo para que entren el logo de 60px y el texto "ProyectaFácil" a 1.8rem sin
// apretarse contra el botón de colapsar); en móvil lo maneja el CSS (w-[85vw] max-w-[320px] del
// <aside>) — mezclar ambos pisaría uno al otro, por eso acá se devuelve `undefined` en móvil para
// no aplicar ningún style inline de ancho.
const anchoPx = computed(() => (isDesktop.value ? (props.collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH) : undefined));
// En móvil el sidebar es un drawer que se abre entero o nada — pedido explícito del cliente. El
// estado "colapsado" solo existe como concepto de escritorio (el riel angosto de solo íconos), así
// que acá se ignora por completo aunque venga en true desde un toggle hecho antes en escritorio.
const colapsadoEfectivo = computed(() => isDesktop.value && !!props.collapsed);
</script>

<template>
  <aside
    class="fixed left-0 top-0 bottom-0 bg-sidebar text-white flex flex-col z-40 overflow-x-hidden w-[85vw] max-w-[320px] lg:max-w-none"
    :class="[
      isDesktop ? 'transition-[width] duration-150 ease-out' : 'transition-transform duration-200 ease-out',
      isDesktop ? 'translate-x-0' : (mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'),
    ]"
    :style="anchoPx !== undefined ? { width: `${anchoPx}px` } : undefined"
  >
    <div
      class="flex items-center border-b border-white/10"
      :class="colapsadoEfectivo ? 'justify-center px-0 py-4' : 'gap-3 px-2.5 py-5'"
    >
      <!-- Colapsado: el botón de expandir vive superpuesto sobre el logo, oculto hasta el hover
           del mismo hueco — así el header no gana una fila extra ni empuja la navegación hacia
           abajo (antes el botón se apilaba debajo del logo). -->
      <div v-if="colapsadoEfectivo" class="relative w-[60px] h-[60px] shrink-0 group">
        <img :src="logoIcono" alt="" class="w-[60px] h-[60px] object-contain absolute inset-0 transition-opacity duration-100 group-hover:opacity-0" />
        <button
          @click="emit('toggle')"
          class="absolute inset-0 w-[60px] h-[60px] rounded-md flex items-center justify-center text-white/50 hover:text-white hover:bg-sidebar-hover transition-opacity duration-100 opacity-0 group-hover:opacity-100"
          title="Expandir menú"
        >
          <FontAwesomeIcon :icon="faAnglesRight" class="w-3.5 h-3.5" />
        </button>
      </div>
      <template v-else>
        <div class="flex-1 min-w-0 flex items-center gap-1">
          <img :src="logoIcono" alt="" class="w-[60px] h-[60px] object-contain shrink-0" />
          <div class="min-w-0">
            <div class="font-heading font-semibold text-[1.8rem] leading-tight">
              <span class="text-white">Proyecta</span><span class="text-brand-400">Fácil</span>
            </div>
            <div class="text-[.55rem] text-dark-muted leading-tight whitespace-nowrap" title="Proyectos de Inversión y Asesorías -by ILPIIE">Proyectos de Inversión y Asesorías -by ILPIIE</div>
          </div>
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
      <p v-if="!colapsadoEfectivo" class="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-3 mb-3">
        Navegación
      </p>
      <ul class="space-y-1">
        <template v-for="item in navItems" :key="item.to ?? item.label">
          <!-- Grupo desplegable ("Gestión de fichas"): colapsado no tiene sentido un desplegable
               sin texto, así que se aplana a sus hijos como links sueltos, igual que cualquier
               otro ítem en modo ícono. -->
          <template v-if="item.children">
            <li v-if="item.locked">
              <div
                :title="colapsadoEfectivo ? `${item.label} — elige un plan para desbloquear` : 'Elige un plan para desbloquear'"
                class="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-white/30 cursor-not-allowed"
                :class="colapsadoEfectivo ? 'justify-center px-0' : 'gap-3'"
              >
                <FontAwesomeIcon :icon="item.icon" class="w-4 text-center shrink-0" />
                <span v-if="!colapsadoEfectivo" class="flex-1">{{ item.label }}</span>
                <FontAwesomeIcon v-if="!colapsadoEfectivo" :icon="faLock" class="w-3 h-3 text-white/25 shrink-0" />
              </div>
            </li>
            <template v-else-if="colapsadoEfectivo">
              <li v-for="child in item.children" :key="child.to">
                <RouterLink :to="child.to" custom v-slot="{ href, navigate, isExactActive }">
                  <a
                    :href="href"
                    :title="child.label"
                    class="flex items-center justify-center px-0 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    :class="isExactActive ? 'bg-sidebar-active text-white shadow-card' : 'text-white/65 hover:bg-sidebar-hover hover:text-white'"
                    @click="navigate"
                  >
                    <FontAwesomeIcon :icon="child.icon" class="w-4 text-center shrink-0" />
                  </a>
                </RouterLink>
              </li>
            </template>
            <li v-else class="!mt-2 first:mt-0">
              <button
                @click="toggleGrupo(item.label)"
                type="button"
                class="flex items-center gap-3 px-4 py-2.5 text-[13.5px] transition-colors border-l-[3px] rounded-none -mx-3 w-[calc(100%+1.5rem)]"
                :class="claseBotonGrupo(item)"
              >
                <!-- Íconos del mock ILPIIE LIVE (HTML Kimi): candado-en-documento / auriculares. -->
                <span v-if="item.label === 'ILPIIE Live'" class="relative shrink-0 inline-flex">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" :stroke="strokeIconoGrupo(item)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 18v-6a9 9 0 0118 0v6" />
                    <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
                  </svg>
                  <span
                    class="absolute -top-0.5 -right-1 w-2 h-2 rounded-full"
                    :class="item.accent === 'red' ? 'bg-red-500 live-pulse-dot' : 'bg-slate-500'"
                  />
                </span>
                <svg v-else-if="item.label === 'Proyectos de Inversión con IA'" width="22" height="22" viewBox="0 0 24 24" fill="none" :stroke="strokeIconoGrupo(item)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                  <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <rect x="8" y="13" width="8" height="5" rx="1" :stroke="strokeCandadoPi(item)" stroke-width="1.5" />
                  <path d="M10 13v-1a2 2 0 014 0v1" :stroke="strokeCandadoPi(item)" stroke-width="1.5" />
                  <circle cx="12" cy="15.5" r="0.8" :fill="fillCandadoPi(item)" stroke="none" />
                </svg>
                <FontAwesomeIcon v-else :icon="item.icon" class="w-[22px] text-center shrink-0" :class="claseChevronGrupo(item)" />

                <span
                  class="flex-1 text-left leading-snug"
                  :class="claseTituloGrupo(item)"
                >
                  {{ item.label }}
                </span>

                <span
                  v-if="item.label === 'ILPIIE Live'"
                  class="text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded shrink-0"
                  :class="item.accent === 'red' ? 'bg-red-500 text-white' : 'bg-slate-600 text-slate-300'"
                >
                  LIVE
                </span>

                <FontAwesomeIcon
                  v-if="item.showLock"
                  :icon="faLock"
                  class="w-3 h-3 text-white/35 shrink-0"
                  title="Aún no has adquirido este beneficio"
                />

                <FontAwesomeIcon
                  :icon="gruposAbiertos.has(item.label) ? faChevronUp : faChevronDown"
                  class="w-3 h-3 shrink-0"
                  :class="claseChevronGrupo(item)"
                />
              </button>

              <!-- Árbol de subsecciones: el hijo activo lleva línea/nodo en color del grupo. -->
              <div v-if="gruposAbiertos.has(item.label)" class="-mx-3 pl-[46px]">
                <RouterLink
                  v-for="child in item.children"
                  :key="child.to"
                  :to="child.to"
                  custom
                  v-slot="{ href, navigate }"
                >
                  <a
                    :href="href"
                    class="relative flex items-center gap-2.5 py-[7px] pl-3.5 border-l-[1.5px] text-[12.5px] transition-colors"
                    :class="claseHijo(item, child.to)"
                    @click="navigate"
                  >
                    <span
                      class="absolute -left-[3.5px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full shrink-0"
                      :class="claseNodoHijo(item, child.to)"
                    />
                    <!-- Íconos hijos del mock (stroke slate; más claros si selected). -->
                    <svg v-if="child.label === 'Formatos'" width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="strokeHijo(item, child.to)" stroke-width="2" stroke-linecap="round" class="shrink-0">
                      <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
                    </svg>
                    <svg v-else-if="child.label === 'Fichas técnicas'" width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="strokeHijo(item, child.to)" stroke-width="2" stroke-linecap="round" class="shrink-0">
                      <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M8 13h2l1-2 2 4 1-2h2" />
                    </svg>
                    <svg v-else-if="child.label === 'IOARR'" width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="strokeHijo(item, child.to)" stroke-width="2" stroke-linecap="round" class="shrink-0">
                      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                    <svg v-else-if="child.label === 'Perfiles'" width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="strokeHijo(item, child.to)" stroke-width="2" stroke-linecap="round" class="shrink-0">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                    <svg v-else-if="child.label === 'Por chat'" width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="strokeHijo(item, child.to)" stroke-width="2" stroke-linecap="round" class="shrink-0">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    <svg v-else-if="child.label === 'Por videollamada'" width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="strokeHijo(item, child.to)" stroke-width="2" stroke-linecap="round" class="shrink-0">
                      <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                    <FontAwesomeIcon v-else :icon="child.icon" class="w-3.5 text-center shrink-0 text-slate-400" />
                    <span class="flex-1">{{ child.label }}</span>
                  </a>
                </RouterLink>
              </div>
            </li>
          </template>

          <!-- Link simple, bloqueado (cliente sin plan) -->
          <li v-else-if="item.locked">
            <div
              :title="colapsadoEfectivo ? `${item.label} — elige un plan para desbloquear` : 'Elige un plan para desbloquear'"
              class="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-white/30 cursor-not-allowed"
              :class="colapsadoEfectivo ? 'justify-center px-0' : 'gap-3'"
            >
              <FontAwesomeIcon :icon="item.icon" class="w-4 text-center shrink-0" />
              <span v-if="!colapsadoEfectivo" class="flex-1">{{ item.label }}</span>
              <FontAwesomeIcon v-if="!colapsadoEfectivo" :icon="faLock" class="w-3 h-3 text-white/25 shrink-0" />
            </div>
          </li>

          <!-- Link simple -->
          <li v-else>
            <RouterLink :to="item.to!" custom v-slot="{ href, navigate, isExactActive }">
              <a
                :href="href"
                :title="colapsadoEfectivo ? item.label : undefined"
                class="relative flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                :class="[
                  isExactActive ? 'bg-primary-dim text-text-primary font-semibold' : 'text-white/65 hover:bg-sidebar-hover hover:text-white',
                  colapsadoEfectivo ? 'justify-center px-0' : 'gap-3',
                ]"
                @click="navigate"
              >
                <span v-if="isExactActive && !colapsadoEfectivo" class="absolute left-0 top-1 bottom-1 w-1 rounded-full bg-brand-400" />
                <!-- Estrella amarilla del mock para Planes y servicios -->
                <svg
                  v-if="item.label === 'Planes y servicios'"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fbbf24"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="shrink-0"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <FontAwesomeIcon v-else :icon="item.icon" class="w-4 text-center shrink-0" />
                <span v-if="!colapsadoEfectivo" class="flex-1" :class="item.label === 'Planes y servicios' ? 'text-slate-200' : undefined">{{ item.label }}</span>
              </a>
            </RouterLink>
          </li>
        </template>
      </ul>
    </nav>

    <!-- Oculto sin plan: esa tarjeta abre PlanesModal, pensado para quien ya tiene membresía.
         Quien aún no compró usa "Planes y servicios". -->
    <MejorarPlanCard v-if="esCliente && !colapsadoEfectivo && session.sesion?.tienePlan !== false" />
    <NotificacionesBell v-if="session.sesion" :collapsed="colapsadoEfectivo" />
    <UserMenu :collapsed="colapsadoEfectivo" />
  </aside>
</template>

<style scoped>
@keyframes live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}
.live-pulse-dot {
  animation: live-pulse 2s infinite;
  box-shadow: 0 0 6px #ef4444;
}
</style>
