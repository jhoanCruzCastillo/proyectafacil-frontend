import type { PermisoId, RolUsuario, Usuario } from '@/types';

export interface DefinicionPermiso {
  id: PermisoId;
  etiqueta: string;
  descripcion: string;
}

export interface CategoriaPermisos {
  id: string;
  nombre: string;
  permisos: DefinicionPermiso[];
}

// Catálogo completo — un permiso por cada funcionalidad/sección real de la app. El rol de un
// usuario es solo una etiqueta; esta lista es la que en el futuro decidirá qué puede hacer cada
// quien (ver nota en types/index.ts sobre el alcance visual-only de esta primera versión).
export const catalogoPermisos: CategoriaPermisos[] = [
  {
    id: 'catalogo',
    nombre: 'Sectores y plantillas',
    permisos: [
      { id: 'sectores.ver', etiqueta: 'Ver sectores', descripcion: 'Consultar el catálogo de sectores del Estado.' },
      { id: 'sectores.gestionar', etiqueta: 'Gestionar sectores', descripcion: 'Crear, editar y eliminar sectores.' },
      { id: 'plantillas.ver', etiqueta: 'Ver plantillas', descripcion: 'Consultar las plantillas de cada sector.' },
      { id: 'plantillas.gestionar', etiqueta: 'Gestionar plantillas', descripcion: 'Crear, editar, duplicar y eliminar plantillas.' },
      { id: 'plantillas.importar_json', etiqueta: 'Importar plantilla desde JSON', descripcion: 'Cargar una plantilla completa a partir de un archivo JSON.' },
      { id: 'estructura.editar', etiqueta: 'Editar estructura', descripcion: 'Modificar secciones, subsecciones y campos de una plantilla.' },
    ],
  },
  {
    id: 'ejemplos',
    nombre: 'Ejemplos (contexto de la IA)',
    permisos: [
      { id: 'ejemplos.gestionar', etiqueta: 'Gestionar ejemplos', descripcion: 'Crear, editar y eliminar los casos de referencia que alimentan a la IA.' },
      { id: 'excel.asignar', etiqueta: 'Asignar archivos Excel', descripcion: 'Subir y asignar el Excel oficial de cada plantilla.' },
      { id: 'json.ver', etiqueta: 'Ver JSON exportado', descripcion: 'Inspeccionar el JSON de estructura/ejemplo generado por el editor.' },
    ],
  },
  {
    id: 'usuarios',
    nombre: 'Usuarios y permisos',
    permisos: [
      { id: 'usuarios.gestionar', etiqueta: 'Gestionar usuarios', descripcion: 'Crear, editar y eliminar cuentas de usuario.' },
      { id: 'roles.gestionar', etiqueta: 'Gestionar roles y permisos', descripcion: 'Editar los permisos base de cada rol desde "Gestionar roles".' },
    ],
  },
  {
    id: 'fichas',
    nombre: 'Mis fichas (cliente)',
    permisos: [
      { id: 'fichas.crear', etiqueta: 'Crear y llenar fichas', descripcion: 'Crear fichas propias a partir del catálogo oficial y llenarlas.' },
      { id: 'fichas.compartir', etiqueta: 'Compartir con el equipo', descripcion: 'Marcar fichas propias como visibles para los colaboradores de la cuenta.' },
      { id: 'fichas.ver_historial', etiqueta: 'Ver histórico de cambios', descripcion: 'Ver quién editó qué y cuándo en una ficha.' },
    ],
  },
  {
    id: 'colaboradores',
    nombre: 'Colaboradores',
    permisos: [
      { id: 'colaboradores.gestionar', etiqueta: 'Gestionar colaboradores', descripcion: 'Agregar, editar y eliminar usuarios adicionales de la cuenta.' },
    ],
  },
  {
    id: 'ia',
    nombre: 'Asistente de IA',
    permisos: [
      { id: 'ia.mejora_texto', etiqueta: 'Mejorar textos con IA', descripcion: 'Usar la sugerencia de IA para mejorar títulos y textos.' },
      { id: 'ia.asesor', etiqueta: 'Asesor de IA 24/7', descripcion: 'Chatear con el asesor de IA mientras llena una ficha.' },
    ],
  },
  {
    id: 'facturacion',
    nombre: 'Facturación',
    permisos: [
      { id: 'facturacion.gestionar', etiqueta: 'Gestionar plan y pagos', descripcion: 'Cambiar de plan, método de pago y contratar add-ons.' },
    ],
  },
  {
    id: 'asesoria',
    nombre: 'Asesoría 1:1',
    permisos: [
      { id: 'asesoria.solicitar', etiqueta: 'Solicitar asesoría', descripcion: 'Pedirle ayuda a un asesor por chat o videollamada mientras se llena una ficha.' },
      { id: 'asesoria.atender_chat', etiqueta: 'Responder chat', descripcion: 'Recibir y responder solicitudes de asesoría por chat.' },
      { id: 'asesoria.atender_video', etiqueta: 'Atender videollamada', descripcion: 'Recibir y atender solicitudes de asesoría por videollamada.' },
      { id: 'asesoria.marcar_disponibilidad', etiqueta: 'Marcar disponibilidad', descripcion: 'Configurar el horario semanal de referencia como asesor.' },
      { id: 'asesoria.autorizar_pagos', etiqueta: 'Autorizar pagos a asesores', descripcion: 'Aprobar los pagos generados por sesiones de asesoría.' },
      { id: 'asesoria.configurar_sla', etiqueta: 'Configurar SLA', descripcion: 'Definir los tiempos de respuesta esperados para las solicitudes de asesoría.' },
      { id: 'asesoria.tickets_gestionar', etiqueta: 'Gestionar tickets de asesoría', descripcion: 'Administrar las solicitudes/tickets de asesoría 1:1.' },
      { id: 'asesoria.cobertura_horarios', etiqueta: 'Ver cobertura de horarios', descripcion: 'Ver la disponibilidad horaria de los asesores.' },
      { id: 'asesoria.matchmaking', etiqueta: 'Intervenir en matchmaking', descripcion: 'Reasignar manualmente qué asesor atiende a qué cliente.' },
    ],
  },
];

export const TODOS_LOS_PERMISOS: PermisoId[] = catalogoPermisos.flatMap((c) => c.permisos.map((p) => p.id));

// Estos defaults son el fallback inicial (y el "seed" del rol en el backend) — el set real y
// editable vive en `roles_permisos_base`, administrado desde "Gestionar roles" (GestionarRolesModal).
const PERMISOS_ADMINISTRADOR: PermisoId[] = [
  'sectores.ver',
  'sectores.gestionar',
  'plantillas.ver',
  'plantillas.gestionar',
  'plantillas.importar_json',
  'estructura.editar',
  'ejemplos.gestionar',
  'excel.asignar',
  'usuarios.gestionar',
  'roles.gestionar',
];

const PERMISOS_ASESOR: PermisoId[] = ['asesoria.atender_chat', 'asesoria.atender_video', 'asesoria.marcar_disponibilidad'];
const PERMISOS_ADMINISTRATIVO_ASESORIAS: PermisoId[] = [
  'asesoria.tickets_gestionar',
  'asesoria.cobertura_horarios',
  'asesoria.matchmaking',
  'asesoria.autorizar_pagos',
  'asesoria.configurar_sla',
];

// Espeja las features de cada plan en data/planes.ts — un cliente Nivel 2 acumula también lo de
// Nivel 0 y 1. asesoria.solicitar está disponible desde el Nivel 0 (no es un beneficio de plan
// pago, es el canal de ayuda base).
function permisosDefaultCliente(numeroNivel: number): PermisoId[] {
  const permisos: PermisoId[] = ['fichas.crear', 'facturacion.gestionar', 'asesoria.solicitar'];
  if (numeroNivel >= 1) permisos.push('ia.mejora_texto', 'ia.asesor');
  if (numeroNivel >= 2) {
    permisos.push('fichas.compartir', 'fichas.ver_historial', 'colaboradores.gestionar');
  }
  return permisos;
}

export function permisosDefaultPorRol(rol: RolUsuario, numeroNivel: number): PermisoId[] {
  if (rol === 'superusuario') return TODOS_LOS_PERMISOS;
  if (rol === 'administrador') return PERMISOS_ADMINISTRADOR;
  if (rol === 'administrativo_asesorias') return PERMISOS_ADMINISTRATIVO_ASESORIAS;
  if (rol === 'asesor') return PERMISOS_ASESOR;
  return permisosDefaultCliente(numeroNivel);
}

// Si el usuario ya tiene permisos guardados explícitamente, se respetan tal cual; si no, se
// calculan por defecto según su rol (y su nivel de plan si es cliente).
export function permisosDe(usuario: Usuario, numeroNivel: number): PermisoId[] {
  return usuario.permisos ?? permisosDefaultPorRol(usuario.rol, numeroNivel);
}

// Vista curada usada por "Gestionar roles" y "Permisos individuales" — un subconjunto pequeño y
// con nombres pensados para esas 2 pantallas (no el catálogo completo de arriba, que es más
// granular/histórico). Cada categoría pertenece "de forma nativa" a un rol; en el modal de permisos
// por usuario, la categoría propia del usuario se muestra siempre, y las demás solo si ya tiene
// ahí algún permiso activado fuera de su rol base.
export type ClaveCategoriaRol = 'administrador' | 'administrativo_asesorias' | 'cliente' | 'asesor';

export interface CategoriaPermisoRol {
  clave: ClaveCategoriaRol;
  nombre: string;
  items: DefinicionPermiso[];
}

export const CATEGORIAS_PERMISOS_POR_ROL: CategoriaPermisoRol[] = [
  {
    clave: 'administrador',
    nombre: 'Plataforma',
    items: [
      { id: 'usuarios.gestionar', etiqueta: 'Gestionar usuarios', descripcion: 'Crear, editar y desactivar usuarios de la plataforma.' },
      { id: 'roles.gestionar', etiqueta: 'Gestionar roles y permisos', descripcion: 'Administrar roles y permisos base de la plataforma.' },
      { id: 'sectores.gestionar', etiqueta: 'Gestionar sectores', descripcion: 'Crear, editar y eliminar sectores.' },
    ],
  },
  {
    clave: 'administrativo_asesorias',
    nombre: 'Gestión de Asesorías',
    items: [
      { id: 'asesoria.tickets_gestionar', etiqueta: 'Gestionar tickets de asesoría', descripcion: 'Administrar las solicitudes/tickets de asesoría 1:1.' },
      { id: 'asesoria.cobertura_horarios', etiqueta: 'Ver cobertura de horarios', descripcion: 'Ver la disponibilidad horaria de los asesores.' },
      { id: 'asesoria.matchmaking', etiqueta: 'Intervenir en matchmaking', descripcion: 'Reasignar manualmente qué asesor atiende a qué cliente.' },
      { id: 'asesoria.autorizar_pagos', etiqueta: 'Autorizar pagos a asesores', descripcion: 'Autorizar y procesar pagos a asesores por su trabajo.' },
      { id: 'asesoria.configurar_sla', etiqueta: 'Configurar SLA', descripcion: 'Definir y modificar los tiempos (SLA) de la plataforma.' },
    ],
  },
  {
    clave: 'cliente',
    nombre: 'Cliente',
    items: [
      { id: 'fichas.crear', etiqueta: 'Llenar fichas técnicas', descripcion: 'Crear fichas propias a partir del catálogo oficial y llenarlas.' },
      { id: 'facturacion.gestionar', etiqueta: 'Comprar planes y add-ons', descripcion: 'Cambiar de plan, método de pago y contratar add-ons.' },
      { id: 'asesoria.solicitar', etiqueta: 'Solicitar asesoría', descripcion: 'Pedirle ayuda a un asesor por chat o videollamada mientras se llena una ficha.' },
    ],
  },
  {
    clave: 'asesor',
    nombre: 'Asesoría',
    items: [
      { id: 'asesoria.atender_chat', etiqueta: 'Responder chat', descripcion: 'Recibir y responder solicitudes de asesoría por chat.' },
      { id: 'asesoria.atender_video', etiqueta: 'Atender videollamada', descripcion: 'Recibir y atender solicitudes de asesoría por videollamada.' },
      { id: 'asesoria.marcar_disponibilidad', etiqueta: 'Marcar disponibilidad', descripcion: 'Configurar el horario semanal de referencia como asesor.' },
    ],
  },
];

export function claveCategoriaDe(rol: RolUsuario): ClaveCategoriaRol | null {
  if (rol === 'administrador') return 'administrador';
  if (rol === 'administrativo_asesorias') return 'administrativo_asesorias';
  if (rol === 'cliente') return 'cliente';
  if (rol === 'asesor') return 'asesor';
  return null;
}
