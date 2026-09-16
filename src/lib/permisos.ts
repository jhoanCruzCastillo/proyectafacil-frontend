import type { RolUsuario, Usuario, Sesion, Ejemplo } from '@/types';

// Reglas de gestión de usuarios: un superusuario gestiona cualquier rol; un administrador gestiona
// clientes, asesores y administrativos de asesorías (personal, no clientes finales); el resto de
// roles no gestionan a nadie y no acceden a esta sección.
const ROLES_GESTIONABLES: Record<RolUsuario, RolUsuario[]> = {
  superusuario: ['superusuario', 'administrador', 'cliente', 'administrativo_asesorias', 'asesor'],
  administrador: ['cliente', 'administrativo_asesorias', 'asesor'],
  cliente: [],
  administrativo_asesorias: [],
  asesor: [],
};

export function rolesGestionablesPor(actorRol: RolUsuario): RolUsuario[] {
  return ROLES_GESTIONABLES[actorRol];
}

export function puedeGestionarRol(actorRol: RolUsuario, targetRol: RolUsuario): boolean {
  return ROLES_GESTIONABLES[actorRol].includes(targetRol);
}

export function puedeAccederGestionUsuarios(rol: RolUsuario): boolean {
  return rol === 'superusuario' || rol === 'administrador';
}

// "Proyectos de Inversión con IA" (Formatos/Fichas técnicas/IOARR/Perfiles) se "adquiere" con plan
// o alumno vigente. Quien no lo tiene ve candado, pero SÍ puede entrar (el candado es visual).
// Función única para router, Sidebar y portada. "ILPIIE Live" se adquiere al tener al menos una
// ficha de chat/video — ver tieneServicioIlpiieLive.
export function puedeAccederProyectosIA(sesion: Sesion): boolean {
  return sesion.tienePlan || sesion.alumnoVigente;
}

/** Ya compró o recibió al menos una ficha de chat/video (plan o consultoría 1 a 1). */
export function tieneServicioIlpiieLive(tickets: Array<{ id: string }> | undefined): boolean {
  return (tickets ?? []).length > 0;
}

// La "cuenta" bajo la que se guardan/ven las fichas de un cliente: si el usuario en sesión es un
// colaborador (tiene cuentaClienteId), sus fichas viven bajo el titular; si no, bajo sí mismo.
export function cuentaEfectivaDe(usuarios: Usuario[], sesion: Sesion): string {
  const usuario = usuarios.find((u) => u.id === sesion.usuarioId);
  return usuario?.cuentaClienteId ?? sesion.usuarioId;
}

// Visibilidad de una ficha dentro de una cuenta compartida (titular + colaboradores, Nivel 2):
// el titular ve todo bajo su cuenta; un colaborador solo ve las fichas que él mismo creó, más las
// que el titular decidió marcar como `compartida`. No confundir con "pertenece a la cuenta"
// (ejemplo.propietarioId === cuentaId), que se valida aparte.
export function puedeVerFicha(ejemplo: Ejemplo, usuarioId: string, esTitular: boolean): boolean {
  if (esTitular) return true;
  const creadorId = ejemplo.creadoPorUsuarioId ?? ejemplo.propietarioId;
  return creadorId === usuarioId || !!ejemplo.compartida;
}
