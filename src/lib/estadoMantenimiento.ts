import { obtenerEstadoSistema } from '@/api/http/estadoSistema.http';

// Se consulta UNA sola vez al arrancar la SPA (ver main.ts), antes de instalar el router — pedido
// explícito del usuario: no hace falta expulsar en vivo a quien ya tiene la pestaña abierta, basta
// con que lo vea la próxima vez que recargue o navegue a la app. Sin polling.
let mantenimientoActivo = false;
let mensajeMantenimiento = '';

export async function cargarEstadoMantenimiento(): Promise<void> {
  try {
    const estado = await obtenerEstadoSistema();
    mantenimientoActivo = estado.mantenimiento;
    mensajeMantenimiento = estado.mensaje;
  } catch (e) {
    // Si el backend no responde (o está caído de verdad), no hay forma de saber si el modo
    // mantenimiento está activo — falla "abierto" (deja pasar) en vez de bloquear a todo el mundo
    // por un error de red ajeno al mantenimiento real.
    console.error('[estado-sistema] no se pudo consultar, se continúa sin mantenimiento:', e);
    mantenimientoActivo = false;
  }
}

export function estaEnMantenimiento(): boolean {
  return mantenimientoActivo;
}

export function obtenerMensajeMantenimiento(): string {
  return mensajeMantenimiento;
}
