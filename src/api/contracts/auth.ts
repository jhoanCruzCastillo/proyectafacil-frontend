import type { Sesion } from '@/types';

export interface DatosRegistro {
  nombre: string;
  correo: string;
  password: string;
  preferencia?: string;
  sectorIds: string[];
}

export interface AuthApi {
  login(usuario: string, password: string): Promise<Sesion | null>;
  me(): Promise<Sesion | null>;
  logout(): Promise<void>;
  /** Registro público — lanza si el backend rechaza (correo repetido, datos inválidos, etc.). */
  registro(datos: DatosRegistro): Promise<void>;
  /** Confirma el correo a partir del token del link — lanza si el token es inválido o venció. */
  verificarCorreo(token: string): Promise<void>;
}
