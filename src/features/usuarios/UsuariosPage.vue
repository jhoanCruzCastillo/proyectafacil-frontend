<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faPlus, faPen, faTrash, faShieldHalved, faTags, faUserGear, faUserGroup, faGlobe,
  faGraduationCap, faSearch, faBuilding, faLayerGroup, faHeadset, faEllipsisVertical,
  faIdCard, faClockRotateLeft, faDesktop, faXmark, faEnvelope, faPhone, faCalendarDays,
  faCheck, faGear, faMobileScreen, faCreditCard, faCalendarCheck, faStar, faComments,
  faRotate, faGem, faCrown, faBolt, rolUsuarioLabels,
} from '@/lib/icons';
import { rolesGestionablesPor } from '@/lib/permisos';
import { catalogoPermisos, permisosDefaultPorRol } from '@/lib/permisosCatalogo';
import { useSessionStore } from '@/stores/session';
import { useUsuariosQuery, useEliminarUsuario, useActualizarUsuario } from '@/composables/useUsuarios';
import { useTiposUsuarioQuery } from '@/composables/useTiposUsuario';
import { usePushActividad, useActividadPorActorQuery, useUltimaModificacionPerfilQuery } from '@/composables/useActividad';
import { useFacturacionQuery, useResumenNivelesQuery } from '@/composables/useFacturacion';
import { useDashboardAsesoriaQuery } from '@/composables/useTicketsAsesoria';
import { useMisSolicitudesQuery } from '@/composables/useAsesoria';
import { useMisSesionesQuery, useCerrarSesion } from '@/composables/useSesiones';
import { numeroNivelDe } from '@/lib/planAcceso';
import { planes } from '@/data/planes';
import { useUiStore } from '@/stores/ui';
import ConfirmModal from '@/components/ConfirmModal.vue';
import PageShell from '@/components/PageShell.vue';
import Avatar from '@/components/Avatar.vue';
import UsuarioModal from './UsuarioModal.vue';
import GestionarRolesModal from './GestionarRolesModal.vue';
import PermisosUsuarioModal from './PermisosUsuarioModal.vue';
import type { Usuario, RolUsuario, OrigenCliente, ActividadReciente } from '@/types';

const session = useSessionStore();
const router = useRouter();
const ui = useUiStore();
const queryClient = useQueryClient();
const { data: usuariosData } = useUsuariosQuery();
const { data: tiposUsuarioData } = useTiposUsuarioQuery();
const { data: resumenNiveles } = useResumenNivelesQuery();
const { data: dashboardAsesoria } = useDashboardAsesoriaQuery();
const eliminarUsuario = useEliminarUsuario();
const actualizarUsuario = useActualizarUsuario();
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

// "Área" — no existe como campo propio en el modelo de datos, se deriva del rol (mismo patrón
// visual que el mockup: Dirección General/Administración/Asesorías). Para un cliente se muestra
// el origen (Alumno/Externo) en su lugar, ver columna de la tabla.
const areaPorRol: Record<RolUsuario, string> = {
  superusuario: 'Dirección General',
  administrador: 'Administración',
  administrativo_asesorias: 'Asesorías',
  asesor: 'Asesorías',
  cliente: '',
};

// "Acceso" — simplificado a dos niveles, pedido explícito del usuario: Completo para los roles de
// plataforma (superusuario/administrador), Limitado para el resto.
function accesoDe(rol: RolUsuario): 'Completo' | 'Limitado' {
  return rol === 'superusuario' || rol === 'administrador' ? 'Completo' : 'Limitado';
}

const ESTADO_LABEL: Record<string, string> = { activo: 'Activo', inactivo: 'Inactivo', pendiente_verificacion: 'Pendiente' };
const ESTADO_DOT: Record<string, string> = { activo: 'bg-green-500', inactivo: 'bg-red-500', pendiente_verificacion: 'bg-amber-500' };

const actorRol = computed(() => session.sesion?.rol ?? 'cliente');
const rolesVisibles = computed(() => rolesGestionablesPor(actorRol.value));

const busqueda = ref('');

// Lista base: visibilidad por rol del actor + búsqueda — los tabs de abajo filtran sobre esto.
const listaBase = computed(() => {
  const q = busqueda.value.trim().toLowerCase();
  return usuarios.value.filter((u) => {
    if (!rolesVisibles.value.includes(u.rol)) return false;
    if (q && !u.nombre.toLowerCase().includes(q) && !u.usuario.toLowerCase().includes(q) && !(u.correo ?? '').toLowerCase().includes(q)) return false;
    return true;
  });
});

// KPI 1 — Organización: pedido explícito, cuenta solo asesores y administrativos (de asesorías),
// no superusuario/administrador — aunque el tab "Organización" de abajo sí los incluye a todos.
const conteoAsesores = computed(() => usuarios.value.filter((u) => u.rol === 'asesor').length);
const conteoAdministrativos = computed(() => usuarios.value.filter((u) => u.rol === 'administrativo_asesorias').length);
const totalOrganizacion = computed(() => conteoAsesores.value + conteoAdministrativos.value);

// KPI 2 — Clientes: alumnos + externos.
const conteoAlumnos = computed(() => usuarios.value.filter((u) => u.rol === 'cliente' && u.origen === 'alumno').length);
const conteoExternos = computed(() => usuarios.value.filter((u) => u.rol === 'cliente' && u.origen === 'externo').length);
const totalClientes = computed(() => conteoAlumnos.value + conteoExternos.value);

// KPI 3 — Membresías activas por nivel (datos reales de facturaciones, no de esta lista de usuarios).
const membresiasPorNivel = computed(() => ({
  0: resumenNiveles.value?.['0'] ?? 0,
  1: resumenNiveles.value?.['1'] ?? 0,
  2: resumenNiveles.value?.['2'] ?? 0,
}));
const totalMembresias = computed(() => membresiasPorNivel.value[0] + membresiasPorNivel.value[1] + membresiasPorNivel.value[2]);
function porcentajeNivel(nivel: 0 | 1 | 2): number {
  return totalMembresias.value === 0 ? 0 : Math.round((membresiasPorNivel.value[nivel] / totalMembresias.value) * 100);
}

// KPI 4 — Asesorías atendidas (histórico completo, plataforma entera).
const totalAsesoriasAtendidas = computed(() => dashboardAsesoria.value?.completadosTotal ?? 0);

// Tabs — los que ya existían más "Todos", pedido explícito del usuario.
type TabUsuarios = 'todos' | 'organizacion' | 'alumnos' | 'externos';
const TABS: { value: TabUsuarios; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'organizacion', label: 'Organización' },
  { value: 'alumnos', label: 'Clientes - Alumnos' },
  { value: 'externos', label: 'Clientes - Externos' },
];
const tabActiva = ref<TabUsuarios>('todos');

const lista = computed(() => {
  if (tabActiva.value === 'organizacion') return listaBase.value.filter((u) => u.rol !== 'cliente');
  if (tabActiva.value === 'alumnos') return listaBase.value.filter((u) => u.rol === 'cliente' && u.origen === 'alumno');
  if (tabActiva.value === 'externos') return listaBase.value.filter((u) => u.rol === 'cliente' && u.origen === 'externo');
  return listaBase.value;
});

// Selección — pedido explícito: al entrar a la sección, el primer usuario de la tabla queda
// seleccionado por defecto en el panel de detalles de la derecha.
const usuarioSeleccionado = ref<Usuario | null>(null);
watch(lista, (l) => {
  if (!usuarioSeleccionado.value && l.length > 0) usuarioSeleccionado.value = l[0];
}, { immediate: true });

type TabDetalle = 'informacion' | 'roles' | 'membresia' | 'actividad' | 'sesiones';
const TABS_DETALLE_ESTANDAR: { value: TabDetalle; label: string; icon: typeof faIdCard }[] = [
  { value: 'informacion', label: 'Información', icon: faIdCard },
  { value: 'roles', label: 'Roles y permisos', icon: faShieldHalved },
  { value: 'actividad', label: 'Actividad', icon: faClockRotateLeft },
  { value: 'sesiones', label: 'Sesiones', icon: faDesktop },
];
// Cliente (alumno/externo): "Roles y permisos" se reemplaza por "Membresía y pagos" — mismo resto.
const TABS_DETALLE_CLIENTE: { value: TabDetalle; label: string; icon: typeof faIdCard }[] = [
  { value: 'informacion', label: 'Información', icon: faIdCard },
  { value: 'membresia', label: 'Membresía y pagos', icon: faCreditCard },
  { value: 'actividad', label: 'Actividad', icon: faClockRotateLeft },
  { value: 'sesiones', label: 'Sesiones', icon: faDesktop },
];
const tabsDetalle = computed(() => (usuarioSeleccionado.value?.rol === 'cliente' ? TABS_DETALLE_CLIENTE : TABS_DETALLE_ESTANDAR));
const tabDetalleActiva = ref<TabDetalle>('informacion');

function seleccionar(u: Usuario) {
  usuarioSeleccionado.value = u;
  tabDetalleActiva.value = 'informacion';
}

function formatFechaHora(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// --- Tab "Información": edición inline de nombre/correo/teléfono (zona horaria y fecha de
// registro nunca son editables — pedido explícito del usuario). ---
const editandoInfo = ref(false);
const infoNombre = ref('');
const infoCorreo = ref('');
const infoTelefono = ref('');
const guardandoInfo = ref(false);

watch(usuarioSeleccionado, () => { editandoInfo.value = false; });

function iniciarEdicionInfo() {
  if (!usuarioSeleccionado.value) return;
  infoNombre.value = usuarioSeleccionado.value.nombre;
  infoCorreo.value = usuarioSeleccionado.value.correo ?? '';
  infoTelefono.value = usuarioSeleccionado.value.telefono ?? '';
  editandoInfo.value = true;
}
function cancelarEdicionInfo() {
  editandoInfo.value = false;
}
async function guardarInfo() {
  if (!usuarioSeleccionado.value) return;
  guardandoInfo.value = true;
  try {
    const actualizado = await actualizarUsuario.mutateAsync({
      id: usuarioSeleccionado.value.id,
      data: { nombre: infoNombre.value.trim(), correo: infoCorreo.value.trim() || undefined, telefono: infoTelefono.value.trim() || undefined },
    });
    usuarioSeleccionado.value = actualizado;
    editandoInfo.value = false;
    ui.toast('Información actualizada');
    queryClient.invalidateQueries({ queryKey: ['actividad', 'ultima-modificacion-perfil', actualizado.id] });
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
  } finally {
    guardandoInfo.value = false;
  }
}

// Roles con el panel de detalles completo (mismo diseño que superusuario). Cliente y roles
// futuros siguen mostrando el placeholder "Próximamente" hasta que se defina su contenido.
const ROLES_DETALLE_COMPLETO = ['superusuario', 'administrador', 'administrativo_asesorias', 'asesor', 'cliente'];
const tieneDetalleCompleto = computed(() => !!usuarioSeleccionado.value && ROLES_DETALLE_COMPLETO.includes(usuarioSeleccionado.value.rol));

const usuarioIdSel = computed(() => usuarioSeleccionado.value?.id ?? '');
const { data: ultimaModificacion } = useUltimaModificacionPerfilQuery(usuarioIdSel);
const actorUltimaModificacion = computed(() => usuarios.value.find((u) => u.id === ultimaModificacion.value?.actorId)?.nombre ?? 'Alguien');

// --- Tab "Roles y permisos": una categoría se marca cumplida si el usuario tiene TODOS sus
// permisos — para superusuario siempre son todos. ---
function categoriaCompleta(cat: (typeof catalogoPermisos)[number]): boolean {
  if (!usuarioSeleccionado.value) return false;
  const permisos = usuarioSeleccionado.value.permisos ?? permisosDefaultPorRol(usuarioSeleccionado.value.rol, 0);
  return cat.permisos.every((p) => permisos.includes(p.id));
}

// --- Tab "Actividad": lo que ESTE usuario hizo — filtro de ventana de tiempo + "ver más" por
// bloques (no trae todo de una), pedido explícito del usuario. ---
const filtroDiasActividad = ref(30);
const paginaActividad = ref(1);
const verTodaActividad = ref(false);
const actividadAcumulada = ref<ActividadReciente[]>([]);
const { data: actividadPagina } = useActividadPorActorQuery(usuarioIdSel, filtroDiasActividad, paginaActividad);

watch(usuarioIdSel, () => {
  filtroDiasActividad.value = 30;
  paginaActividad.value = 1;
  verTodaActividad.value = false;
  actividadAcumulada.value = [];
});
watch(filtroDiasActividad, () => {
  paginaActividad.value = 1;
  actividadAcumulada.value = [];
});
watch(actividadPagina, (p) => {
  if (!p) return;
  actividadAcumulada.value = paginaActividad.value === 1 ? p.items : [...actividadAcumulada.value, ...p.items];
});

const hayMasActividad = computed(() => (actividadPagina.value?.total ?? 0) > actividadAcumulada.value.length);
function verMasActividad() {
  verTodaActividad.value = true;
  paginaActividad.value++;
}

const CATEGORIA_ICONO: Record<string, typeof faShieldHalved> = {
  'Usuarios y permisos': faShieldHalved,
  Configuración: faGear,
  Perfil: faIdCard,
  Sesiones: faCalendarCheck,
  Evaluación: faStar,
  'Asesoría 1:1': faComments,
  Facturación: faRotate,
};
const COLOR_BG: Record<string, string> = {
  blue: 'bg-sky-50 text-sky-600',
  green: 'bg-green-50 text-green-600',
  orange: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-gray-100 text-gray-500',
};

// --- Tab "Sesiones": siempre las del ACTOR autenticado (así lo devuelve el backend, ver
// SesionesController) — si el usuario seleccionado en la tabla es otra persona, no tiene sentido
// mostrar "tus" sesiones ahí, así que el tab se restringe a "estás viendo tu propia cuenta".
const esCuentaPropia = computed(() => usuarioSeleccionado.value?.id === session.sesion?.usuarioId);
const { data: misSesiones } = useMisSesionesQuery();
const cerrarSesion = useCerrarSesion();
const cerrandoSesionId = ref<string | null>(null);

const sesionesOrdenadas = computed(() => {
  const lista = misSesiones.value ?? [];
  return [...lista].sort((a, b) => (a.esActual ? -1 : b.esActual ? 1 : new Date(b.iniciadaEn).getTime() - new Date(a.iniciadaEn).getTime()));
});

function iconoDispositivo(dispositivo: string) {
  return dispositivo === 'iPhone' || dispositivo === 'iPad' || dispositivo === 'Android' ? faMobileScreen : faDesktop;
}

async function handleCerrarSesion(s: (typeof sesionesOrdenadas.value)[number]) {
  cerrandoSesionId.value = s.id;
  try {
    if (s.esActual) {
      // Es la sesión con la que estás navegando ahora mismo — cerrarla es un logout real.
      session.logout();
      router.replace({ name: 'login' });
      return;
    }
    await cerrarSesion.mutateAsync(s.id);
    ui.toast('Sesión cerrada');
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo cerrar la sesión', 'error');
  } finally {
    cerrandoSesionId.value = null;
  }
}

// --- Tab "Información" (cliente): estadísticas rápidas — solo estas 2 métricas, pedido explícito. ---
// Sin cliente seleccionado (o para cualquier otro rol) la query queda deshabilitada (id vacío).
const clienteIdStats = computed(() => (usuarioSeleccionado.value?.rol === 'cliente' ? usuarioSeleccionado.value.id : ''));
const { data: solicitudesCliente } = useMisSolicitudesQuery(clienteIdStats, 'cliente');
const asesoriasRealizadas = computed(() => (solicitudesCliente.value ?? []).filter((s) => s.estado === 'completado').length);
const diasComoMiembro = computed(() => {
  const fecha = usuarioSeleccionado.value?.fechaRegistro;
  return fecha ? Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000)) : 0;
});

// --- Tab "Membresía y pagos" (cliente): un colaborador comparte la facturación de su cuenta
// titular (mismo criterio que cuentaIdPermisos más arriba) — nunca tiene su propia fila. ---
const cuentaIdMembresia = computed(() => {
  const u = usuarioSeleccionado.value;
  return u && u.rol === 'cliente' ? (u.cuentaClienteId ?? u.id) : '';
});
const { data: facturacionMembresia } = useFacturacionQuery(cuentaIdMembresia);
const planMembresia = computed(() => planes.find((p) => p.id === facturacionMembresia.value?.planId) ?? null);

// Sin campo de ícono en el modelo de plan — se asigna uno de un set fijo según el nivel (pedido
// explícito: "por ahora el ícono será random", sin que cambie en cada refresco/reactividad).
const ICONOS_PLAN = [faLayerGroup, faGem, faCrown, faBolt];
function iconoPlan(numeroNivel: number) {
  return ICONOS_PLAN[numeroNivel % ICONOS_PLAN.length];
}

// `fechaInicioPlan` llega tal cual de MySQL ("Y-m-d H:i:s", sin 'T' — Date lo interpreta distinto
// según navegador); `fechaRenovacion` llega ya formateada "d/m/Y" (FacturacionController::
// fechaIsoACliente) — con '/' el constructor de Date asume M/D/Y (inglés) y desfasa cualquier día > 12.
// Ambos se parsean a mano para el cálculo del ciclo en vez de confiar en `new Date(string)`.
function parseFechaMysql(valor?: string | null): Date | null {
  if (!valor) return null;
  const fecha = new Date(valor.replace(' ', 'T'));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}
function parseFechaCliente(valor?: string | null): Date | null {
  if (!valor) return null;
  const [d, m, y] = valor.split('/').map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}
const cicloInicio = computed(() => parseFechaMysql(facturacionMembresia.value?.fechaInicioPlan));
const cicloFin = computed(() => parseFechaCliente(facturacionMembresia.value?.fechaRenovacion));
const diasRestantesCiclo = computed(() => (cicloFin.value ? Math.max(0, Math.ceil((cicloFin.value.getTime() - Date.now()) / 86_400_000)) : null));
const progresoCiclo = computed(() => {
  if (!cicloInicio.value || !cicloFin.value) return 0;
  const total = cicloFin.value.getTime() - cicloInicio.value.getTime();
  return total <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(((Date.now() - cicloInicio.value.getTime()) / total) * 100)));
});
function formatFechaLarga(fecha: Date | null): string {
  return fecha ? fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
}
function formatFechaCorta(fecha: Date | null): string {
  return fecha ? fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : '—';
}
// `facturas.fecha` es una columna DATE pura ("Y-m-d", sin hora) — a diferencia de fechaInicioPlan
// (datetime completo), acá SÍ hay que parsear a mano: `new Date('2026-08-24')` la interpreta como
// medianoche UTC, y al mostrarla en hora de Lima (UTC-5) se corre un día hacia atrás.
function formatFechaFactura(fecha: string): string {
  const [y, m, d] = fecha.split(' ')[0].split('-').map(Number);
  if (!y || !m || !d) return fecha;
  return new Date(y, m - 1, d).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
}

const menuAccionAbierto = ref<string | null>(null);
function toggleMenuAccion(id: string) {
  menuAccionAbierto.value = menuAccionAbierto.value === id ? null : id;
}

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
  menuAccionAbierto.value = null;
  editTarget.value = u;
  showModal.value = true;
}
function handlePermisos(u: Usuario) {
  menuAccionAbierto.value = null;
  permisosTarget.value = u;
}
function handlePedirEliminar(u: Usuario) {
  menuAccionAbierto.value = null;
  deleteTarget.value = u;
}
async function handleDelete() {
  if (!deleteTarget.value) return;
  await eliminarUsuario.mutateAsync(deleteTarget.value.id);
  await pushActividad.mutateAsync({ mensaje: `Se eliminó el usuario "${deleteTarget.value.nombre}"`, color: 'red', categoria: 'Usuarios y permisos' });
  ui.toast(`Usuario "${deleteTarget.value.nombre}" eliminado`);
  if (usuarioSeleccionado.value?.id === deleteTarget.value.id) usuarioSeleccionado.value = null;
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

    <!-- KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-6 pt-6">
      <div class="rounded-xl border border-gray-200 p-4">
        <div class="flex items-start justify-between">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-muted">Organización</p>
          <div class="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <FontAwesomeIcon :icon="faBuilding" class="w-3.5 h-3.5" />
          </div>
        </div>
        <p class="text-2xl font-bold text-heading mt-1">{{ totalOrganizacion }}</p>
        <p class="text-xs text-muted">Asesores y administrativos</p>
        <div class="h-1.5 rounded-full bg-gray-100 mt-3 overflow-hidden flex">
          <div class="h-full bg-fuchsia-400" :style="{ width: `${totalOrganizacion ? (conteoAsesores / totalOrganizacion) * 100 : 0}%` }" />
          <div class="h-full bg-teal-400" :style="{ width: `${totalOrganizacion ? (conteoAdministrativos / totalOrganizacion) * 100 : 0}%` }" />
        </div>
        <p class="text-[10px] text-muted mt-1.5">{{ conteoAsesores }} asesores · {{ conteoAdministrativos }} administrativos</p>
      </div>

      <div class="rounded-xl border border-gray-200 p-4">
        <div class="flex items-start justify-between">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-muted">Clientes</p>
          <div class="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <FontAwesomeIcon :icon="faUserGroup" class="w-3.5 h-3.5" />
          </div>
        </div>
        <p class="text-2xl font-bold text-heading mt-1">{{ totalClientes }}</p>
        <p class="text-xs text-muted">Alumnos y externos</p>
        <div class="h-1.5 rounded-full bg-gray-100 mt-3 overflow-hidden flex">
          <div class="h-full bg-brand-500" :style="{ width: `${totalClientes ? (conteoAlumnos / totalClientes) * 100 : 0}%` }" />
          <div class="h-full bg-gray-400" :style="{ width: `${totalClientes ? (conteoExternos / totalClientes) * 100 : 0}%` }" />
        </div>
        <p class="text-[10px] text-muted mt-1.5">{{ conteoAlumnos }} alumnos · {{ conteoExternos }} externos</p>
      </div>

      <div class="rounded-xl border border-gray-200 p-4">
        <div class="flex items-start justify-between">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-muted">Membresías activas</p>
          <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FontAwesomeIcon :icon="faLayerGroup" class="w-3.5 h-3.5" />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-1">
          <div v-for="p in planes" :key="p.id">
            <p class="text-lg font-bold text-heading leading-tight">{{ membresiasPorNivel[p.numeroNivel as 0 | 1 | 2] }}</p>
            <p class="text-[10px] text-muted truncate">{{ p.nombre }}</p>
            <p class="text-[10px] font-medium" :class="p.numeroNivel === 0 ? 'text-gray-500' : p.numeroNivel === 1 ? 'text-sky-600' : 'text-amber-600'">
              {{ porcentajeNivel(p.numeroNivel as 0 | 1 | 2) }}%
            </p>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 p-4">
        <div class="flex items-start justify-between">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-muted">Asesorías atendidas</p>
          <div class="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">
            <FontAwesomeIcon :icon="faHeadset" class="w-3.5 h-3.5" />
          </div>
        </div>
        <p class="text-2xl font-bold text-heading mt-1">{{ totalAsesoriasAtendidas }}</p>
        <p class="text-xs text-muted">Consultas finalizadas en total</p>
      </div>
    </div>

    <!-- Tabs + búsqueda -->
    <div class="flex flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-2">
      <div class="flex gap-1 border-b border-gray-100 -mb-px">
        <button
          v-for="tab in TABS"
          :key="tab.value"
          @click="tabActiva = tab.value"
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-75"
          :class="tabActiva === tab.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="relative">
        <FontAwesomeIcon :icon="faSearch" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          v-model="busqueda"
          type="text"
          placeholder="Buscar por nombre, correo o usuario..."
          class="w-72 pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
      </div>
    </div>

    <!-- Tabla + panel de detalles -->
    <div class="flex items-start gap-5 px-6 pb-6">
      <div class="flex-1 min-w-0 rounded-xl border border-gray-200 overflow-hidden">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-100 bg-gray-50">
              <th class="text-left text-[11px] font-semibold uppercase tracking-wider text-muted px-4 py-3">Usuario</th>
              <th class="text-left text-[11px] font-semibold uppercase tracking-wider text-muted px-4 py-3">Rol</th>
              <th class="text-left text-[11px] font-semibold uppercase tracking-wider text-muted px-4 py-3">Área / Origen</th>
              <th class="text-left text-[11px] font-semibold uppercase tracking-wider text-muted px-4 py-3">Estado</th>
              <th class="text-left text-[11px] font-semibold uppercase tracking-wider text-muted px-4 py-3">Acceso</th>
              <th class="text-center text-[11px] font-semibold uppercase tracking-wider text-muted px-4 py-3">Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="u in lista"
              :key="u.id"
              @click="seleccionar(u)"
              class="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors cursor-pointer"
              :class="usuarioSeleccionado?.id === u.id ? 'bg-brand-50/40' : ''"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3 min-w-0">
                  <Avatar :nombre="u.nombre" :fotoUrl="u.fotoUrl" size="w-9 h-9" />
                  <div class="min-w-0">
                    <p class="font-semibold text-heading text-sm truncate">{{ u.nombre }}</p>
                    <p class="text-xs text-muted truncate">{{ u.correo || u.usuario }}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" :class="rolBadge[u.rol]">
                  {{ tiposUsuario.find((t) => t.id === u.tipoUsuarioId)?.nombre ?? rolUsuarioLabels[u.rol] }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  v-if="u.rol === 'cliente' && u.origen"
                  class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                  :class="origenBadge[u.origen].class"
                >
                  <FontAwesomeIcon :icon="origenBadge[u.origen].icon" class="w-3 h-3" />
                  {{ origenBadge[u.origen].label }}
                </span>
                <span v-else-if="areaPorRol[u.rol]" class="text-sm text-gray-600">{{ areaPorRol[u.rol] }}</span>
                <span v-else class="text-sm text-gray-300">—</span>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5 text-sm text-gray-600">
                  <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="ESTADO_DOT[u.estado ?? 'activo']" />
                  {{ ESTADO_LABEL[u.estado ?? 'activo'] }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ accesoDe(u.rol) }}</td>
              <td class="px-4 py-3">
                <div class="relative flex items-center justify-center" @click.stop>
                  <button
                    @click="toggleMenuAccion(u.id)"
                    type="button"
                    class="w-8 h-8 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex items-center justify-center transition-colors"
                  >
                    <FontAwesomeIcon :icon="faEllipsisVertical" class="w-3.5 h-3.5" />
                  </button>
                  <div
                    v-if="menuAccionAbierto === u.id"
                    class="absolute top-full right-0 mt-1 z-20 bg-white rounded-lg shadow-modal border border-gray-200 py-1 w-36"
                  >
                    <button @click="handlePermisos(u)" type="button" class="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <FontAwesomeIcon :icon="faShieldHalved" class="w-3 h-3" />
                      Permisos
                    </button>
                    <button @click="handleEditar(u)" type="button" class="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <FontAwesomeIcon :icon="faPen" class="w-3 h-3" />
                      Editar
                    </button>
                    <button
                      @click="handlePedirEliminar(u)"
                      :disabled="u.id === session.sesion?.usuarioId"
                      type="button"
                      class="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <FontAwesomeIcon :icon="faTrash" class="w-3 h-3" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </td>
            </tr>
            <tr v-if="lista.length === 0">
              <td colspan="6" class="px-6 py-8 text-center text-sm text-muted">No hay usuarios para mostrar.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Panel de detalles -->
      <div class="w-[480px] shrink-0 rounded-xl border border-gray-200 p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold text-heading">Detalles del usuario</h3>
          <button v-if="usuarioSeleccionado" @click="usuarioSeleccionado = null" type="button" class="w-6 h-6 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600">
            <FontAwesomeIcon :icon="faXmark" class="w-3 h-3" />
          </button>
        </div>

        <template v-if="usuarioSeleccionado">
          <div class="flex items-center gap-3 mb-4">
            <Avatar :nombre="usuarioSeleccionado.nombre" :fotoUrl="usuarioSeleccionado.fotoUrl" size="w-12 h-12" />
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-semibold text-heading text-sm truncate">{{ usuarioSeleccionado.nombre }}</p>
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" :class="rolBadge[usuarioSeleccionado.rol]">
                  {{ rolUsuarioLabels[usuarioSeleccionado.rol] }}
                </span>
              </div>
              <p class="text-xs text-muted truncate">{{ usuarioSeleccionado.correo || usuarioSeleccionado.usuario }}</p>
              <p class="text-[11px] text-gray-400 truncate">Último acceso: {{ usuarioSeleccionado.ultimoAcceso ? formatFechaHora(usuarioSeleccionado.ultimoAcceso) : 'Nunca' }}</p>
              <span class="inline-flex items-center gap-1.5 text-[11px] text-gray-500 mt-1">
                <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="ESTADO_DOT[usuarioSeleccionado.estado ?? 'activo']" />
                {{ ESTADO_LABEL[usuarioSeleccionado.estado ?? 'activo'] }}
              </span>
            </div>
          </div>

          <div class="flex gap-1 border-b border-gray-100 mb-4 overflow-x-auto">
            <button
              v-for="tab in tabsDetalle"
              :key="tab.value"
              @click="tabDetalleActiva = tab.value"
              type="button"
              class="px-2.5 py-2 text-xs font-medium border-b-2 whitespace-nowrap flex items-center gap-1.5 transition-colors duration-75"
              :class="tabDetalleActiva === tab.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'"
            >
              <FontAwesomeIcon :icon="tab.icon" class="w-3 h-3" />
              {{ tab.label }}
            </button>
          </div>

          <!-- Tab: Información -->
          <div v-if="tabDetalleActiva === 'informacion' && tieneDetalleCompleto" class="space-y-4">
            <div>
              <h4 class="text-[11px] font-semibold text-heading uppercase tracking-wide mb-2">Información personal</h4>
              <div class="rounded-lg border border-gray-200 divide-y divide-gray-100">
                <div class="flex items-center gap-2.5 px-3 py-2.5">
                  <FontAwesomeIcon :icon="faIdCard" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <div class="min-w-0 flex-1">
                    <p class="text-[10px] text-muted">Nombre completo</p>
                    <input v-if="editandoInfo" v-model="infoNombre" type="text" class="w-full mt-0.5 px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                    <p v-else class="text-xs font-medium text-heading truncate">{{ usuarioSeleccionado.nombre }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2.5 px-3 py-2.5">
                  <FontAwesomeIcon :icon="faEnvelope" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <div class="min-w-0 flex-1">
                    <p class="text-[10px] text-muted">Correo electrónico</p>
                    <input v-if="editandoInfo" v-model="infoCorreo" type="email" class="w-full mt-0.5 px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                    <p v-else class="text-xs font-medium text-heading truncate">{{ usuarioSeleccionado.correo || '—' }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2.5 px-3 py-2.5">
                  <FontAwesomeIcon :icon="faPhone" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <div class="min-w-0 flex-1">
                    <p class="text-[10px] text-muted">Teléfono</p>
                    <input v-if="editandoInfo" v-model="infoTelefono" type="text" placeholder="Sin registrar" class="w-full mt-0.5 px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                    <p v-else class="text-xs font-medium text-heading truncate">{{ usuarioSeleccionado.telefono || '—' }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2.5 px-3 py-2.5">
                  <FontAwesomeIcon :icon="faCalendarDays" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <div class="min-w-0 flex-1">
                    <p class="text-[10px] text-muted">Fecha de registro</p>
                    <p class="text-xs font-medium text-heading truncate">{{ formatFechaHora(usuarioSeleccionado.fechaRegistro) }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50/60">
                  <FontAwesomeIcon :icon="faGlobe" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <div class="min-w-0 flex-1">
                    <p class="text-[10px] text-muted">Zona horaria</p>
                    <p class="text-xs font-medium text-heading truncate">(GMT-5) Lima, Perú</p>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="ultimaModificacion" class="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2.5">
              <p class="text-[11px] font-semibold text-violet-700 flex items-center gap-1.5">
                <FontAwesomeIcon :icon="faClockRotateLeft" class="w-3 h-3" />
                Últimas modificaciones del perfil
              </p>
              <p class="text-xs text-violet-800 mt-1">{{ ultimaModificacion.mensaje }}</p>
              <p class="text-[10px] text-violet-500 mt-0.5">{{ formatFechaHora(ultimaModificacion.creadoEn) }} · por {{ actorUltimaModificacion }}</p>
            </div>

            <div v-if="usuarioSeleccionado.rol === 'cliente'">
              <h4 class="text-[11px] font-semibold text-heading uppercase tracking-wide mb-2">Estadísticas rápidas</h4>
              <div class="grid grid-cols-2 gap-2.5">
                <div class="rounded-lg border border-gray-200 px-3 py-2.5">
                  <FontAwesomeIcon :icon="faHeadset" class="w-3.5 h-3.5 text-violet-500 mb-1.5" />
                  <p class="text-lg font-bold text-heading leading-none">{{ asesoriasRealizadas }}</p>
                  <p class="text-[10px] text-muted mt-1">Asesorías realizadas</p>
                </div>
                <div class="rounded-lg border border-gray-200 px-3 py-2.5">
                  <FontAwesomeIcon :icon="faCalendarDays" class="w-3.5 h-3.5 text-violet-500 mb-1.5" />
                  <p class="text-lg font-bold text-heading leading-none">{{ diasComoMiembro }}</p>
                  <p class="text-[10px] text-muted mt-1">Días como miembro</p>
                </div>
              </div>
            </div>

            <button v-if="!editandoInfo" @click="iniciarEdicionInfo" type="button" class="w-full py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              <FontAwesomeIcon :icon="faPen" class="w-3.5 h-3.5" />
              Editar información
            </button>
            <div v-else class="flex gap-2">
              <button @click="cancelarEdicionInfo" type="button" class="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button @click="guardarInfo" :disabled="guardandoInfo" type="button" class="flex-1 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                <FontAwesomeIcon :icon="faCheck" class="w-3.5 h-3.5" />
                {{ guardandoInfo ? 'Guardando…' : 'Guardar cambios' }}
              </button>
            </div>
          </div>

          <!-- Tab: Roles y permisos -->
          <div v-else-if="tabDetalleActiva === 'roles' && tieneDetalleCompleto" class="space-y-4">
            <div>
              <h4 class="text-[11px] font-semibold text-heading uppercase tracking-wide mb-2">Roles asignados</h4>
              <div class="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full" :class="rolBadge[usuarioSeleccionado.rol]">{{ rolUsuarioLabels[usuarioSeleccionado.rol] }}</span>
                <span class="text-[11px] text-muted">Rol principal</span>
              </div>
            </div>
            <div>
              <h4 class="text-[11px] font-semibold text-heading uppercase tracking-wide mb-2">Permisos principales</h4>
              <div class="rounded-lg border border-gray-200 divide-y divide-gray-100">
                <div v-for="cat in catalogoPermisos" :key="cat.id" class="flex items-center justify-between px-3 py-2.5">
                  <span class="text-xs text-gray-700">{{ cat.nombre }}</span>
                  <FontAwesomeIcon :icon="categoriaCompleta(cat) ? faCheck : faXmark" class="w-3 h-3" :class="categoriaCompleta(cat) ? 'text-green-500' : 'text-gray-300'" />
                </div>
              </div>
            </div>
          </div>

          <!-- Tab: Membresía y pagos (cliente) -->
          <div v-else-if="tabDetalleActiva === 'membresia' && tieneDetalleCompleto" class="space-y-4">
            <template v-if="facturacionMembresia && planMembresia">
              <div>
                <h4 class="text-[11px] font-semibold text-heading uppercase tracking-wide mb-2">Plan actual</h4>
                <div class="rounded-lg border border-violet-100 bg-violet-50/40 p-3.5 space-y-3">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="w-9 h-9 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                        <FontAwesomeIcon :icon="iconoPlan(planMembresia.numeroNivel)" class="w-4 h-4" />
                      </div>
                      <div class="min-w-0">
                        <p class="text-sm font-bold text-heading truncate">{{ planMembresia.nombre }}</p>
                        <span
                          class="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5"
                          :class="facturacionMembresia.cancelada ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'"
                        >
                          {{ facturacionMembresia.cancelada ? 'Se cancela al terminar el periodo' : 'Activo' }}
                        </span>
                      </div>
                    </div>
                    <div class="text-right shrink-0">
                      <p class="text-sm font-bold text-heading">{{ facturacionMembresia.precio }}</p>
                      <p class="text-[10px] text-muted">{{ facturacionMembresia.periodicidad }}</p>
                    </div>
                  </div>

                  <div class="flex items-center justify-between text-[11px] text-gray-600 flex-wrap gap-1">
                    <span>
                      Renovación automática:
                      <strong :class="facturacionMembresia.cancelada ? 'text-amber-600' : 'text-green-600'">{{ facturacionMembresia.cancelada ? 'Desactivada' : 'Activada' }}</strong>
                    </span>
                    <span>Próximo cobro: {{ formatFechaLarga(cicloFin) }}</span>
                  </div>

                  <div v-if="cicloInicio && cicloFin">
                    <div class="h-1.5 rounded-full bg-violet-100 overflow-hidden">
                      <div class="h-full bg-violet-500 rounded-full" :style="{ width: progresoCiclo + '%' }" />
                    </div>
                    <div class="flex items-center justify-between text-[10px] text-muted mt-1">
                      <span>Ciclo actual: {{ formatFechaCorta(cicloInicio) }} – {{ formatFechaCorta(cicloFin) }}</span>
                      <span>Quedan {{ diasRestantesCiclo }} días</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 class="text-[11px] font-semibold text-heading uppercase tracking-wide mb-2">Historial de pagos</h4>
                <p v-if="facturacionMembresia.facturas.length === 0" class="text-xs text-muted text-center py-4">Todavía no hay pagos registrados.</p>
                <div v-else class="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  <div v-for="f in facturacionMembresia.facturas" :key="f.id" class="flex items-center justify-between px-3 py-2.5">
                    <div class="min-w-0">
                      <p class="text-xs font-medium text-heading">{{ formatFechaFactura(f.fecha) }}</p>
                      <p class="text-[10px] text-muted truncate">{{ planMembresia.nombre }} · {{ facturacionMembresia.periodicidad }}</p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">{{ f.estado }}</span>
                      <span class="text-xs font-semibold text-heading">{{ f.total }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 class="text-[11px] font-semibold text-heading uppercase tracking-wide mb-2">Beneficios incluidos</h4>
                <ul class="space-y-1.5">
                  <li v-for="(feat, i) in planMembresia.features" :key="i" class="flex items-start gap-2 text-xs text-gray-600 rounded-lg border border-gray-100 px-3 py-2">
                    <FontAwesomeIcon :icon="faCheck" class="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    {{ feat }}
                  </li>
                </ul>
              </div>
            </template>
            <p v-else class="text-xs text-muted text-center py-8">Este cliente todavía no tiene un plan asignado.</p>
          </div>

          <!-- Tab: Actividad -->
          <div v-else-if="tabDetalleActiva === 'actividad' && tieneDetalleCompleto" class="space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-[11px] font-semibold text-heading uppercase tracking-wide">Actividad reciente</h4>
              <select v-model.number="filtroDiasActividad" class="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
                <option :value="7">Última semana</option>
                <option :value="30">Últimos 30 días</option>
                <option :value="365">Último año</option>
              </select>
            </div>

            <p v-if="actividadAcumulada.length === 0" class="text-xs text-muted text-center py-6">Sin actividad en este período.</p>
            <div v-else class="space-y-2" :class="verTodaActividad ? 'max-h-72 overflow-y-auto pr-1' : ''">
              <div v-for="item in actividadAcumulada" :key="item.id" class="flex items-start gap-2.5 rounded-lg border border-gray-100 px-3 py-2.5">
                <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0" :class="COLOR_BG[item.color]">
                  <FontAwesomeIcon :icon="CATEGORIA_ICONO[item.categoria ?? ''] ?? faClockRotateLeft" class="w-3 h-3" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-medium text-heading">{{ item.mensaje }}</p>
                  <p class="text-[10px] text-muted mt-0.5">{{ formatFechaHora(item.creadoEn) }}</p>
                </div>
                <span v-if="item.categoria" class="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0 whitespace-nowrap">{{ item.categoria }}</span>
              </div>
            </div>

            <button v-if="hayMasActividad" @click="verMasActividad" type="button" class="w-full py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Ver toda la actividad
            </button>
          </div>

          <!-- Tab: Sesiones -->
          <div v-else-if="tabDetalleActiva === 'sesiones' && tieneDetalleCompleto" class="space-y-3">
            <p v-if="!esCuentaPropia" class="text-xs text-muted text-center py-8">
              Por seguridad, solo podés ver el historial de sesiones de tu propia cuenta.
            </p>
            <template v-else>
              <h4 class="text-[11px] font-semibold text-heading uppercase tracking-wide">Sesiones activas</h4>
              <div
                v-for="s in sesionesOrdenadas.filter((x) => x.activa)"
                :key="s.id"
                class="rounded-lg border px-3 py-2.5"
                :class="s.esActual ? 'border-green-200 bg-green-50' : 'border-gray-200'"
              >
                <div class="flex items-start gap-2.5">
                  <FontAwesomeIcon :icon="iconoDispositivo(s.dispositivo)" class="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-medium text-heading flex items-center gap-1.5 flex-wrap">
                      {{ s.dispositivo }} · {{ s.navegador }} · {{ s.ubicacion ?? '—' }}
                      <span v-if="s.esActual" class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500 text-white">Sesión actual</span>
                    </p>
                    <p class="text-[10px] text-muted mt-0.5">IP: {{ s.ip ?? '—' }} · Última actividad: {{ formatFechaHora(s.ultimaActividad) }}</p>
                    <p class="text-[10px] text-muted">Iniciada: {{ formatFechaHora(s.iniciadaEn) }}</p>
                  </div>
                  <button
                    @click="handleCerrarSesion(s)"
                    :disabled="cerrandoSesionId === s.id"
                    type="button"
                    class="shrink-0 px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>

              <h4 class="text-[11px] font-semibold text-heading uppercase tracking-wide pt-1">Historial de sesiones</h4>
              <p v-if="sesionesOrdenadas.filter((x) => !x.activa).length === 0" class="text-xs text-muted text-center py-4">Todavía no hay sesiones cerradas.</p>
              <div v-else class="space-y-2 max-h-56 overflow-y-auto pr-1">
                <div v-for="s in sesionesOrdenadas.filter((x) => !x.activa)" :key="s.id" class="flex items-center gap-2.5 rounded-lg border border-gray-100 px-3 py-2">
                  <FontAwesomeIcon :icon="iconoDispositivo(s.dispositivo)" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <div class="min-w-0 flex-1">
                    <p class="text-[11px] text-gray-600 truncate">{{ s.dispositivo }} · {{ s.navegador }} · {{ s.ubicacion ?? '—' }}</p>
                    <p class="text-[10px] text-muted">{{ formatFechaHora(s.iniciadaEn) }}</p>
                  </div>
                  <span class="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">Cerrada</span>
                </div>
              </div>

              <div class="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2.5">
                <p class="text-[11px] font-semibold text-violet-700 flex items-center gap-1.5">
                  <FontAwesomeIcon :icon="faShieldHalved" class="w-3 h-3" />
                  Recomendación de seguridad
                </p>
                <p class="text-[11px] text-violet-700/90 mt-1">Si no reconocés alguna de estas sesiones, te recomendamos cambiar tu contraseña.</p>
              </div>
            </template>
          </div>

          <!-- Cualquier otro rol — todavía sin definir. -->
          <p v-else class="text-xs text-muted text-center py-8">Próximamente.</p>

          <button
            v-if="!tieneDetalleCompleto"
            @click="handleEditar(usuarioSeleccionado)"
            type="button"
            class="w-full mt-2 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <FontAwesomeIcon :icon="faPen" class="w-3.5 h-3.5" />
            Editar roles y permisos
          </button>
        </template>

        <p v-else class="text-sm text-muted text-center py-10">Selecciona un usuario para ver sus detalles.</p>
      </div>
    </div>

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
