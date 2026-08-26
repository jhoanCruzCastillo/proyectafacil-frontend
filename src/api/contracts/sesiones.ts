import type { SesionUsuario } from '@/types';

export interface SesionesApi {
  /** Siempre las del actor autenticado — nunca las de otro usuario, ni para un superusuario. */
  misSesiones(): Promise<SesionUsuario[]>;
  cerrar(sesionId: string): Promise<void>;
}
