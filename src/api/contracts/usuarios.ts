import type { Usuario } from '@/types';

export interface UsuariosApi {
  list(): Promise<Usuario[]>;
  create(usuario: Usuario): Promise<Usuario>;
  update(id: string, data: Partial<Usuario>): Promise<Usuario>;
  remove(id: string): Promise<void>;
  /** Genera una contraseña nueva para el usuario y se la envía por correo. Usado desde "Editar". */
  enviarAccesos(id: string): Promise<void>;
  /** Envía por correo una contraseña ya conocida (la que el admin acaba de ver al crear el usuario),
   * sin regenerarla. Usado solo desde el modal de "Usuario creado". */
  enviarAccesosDirecto(id: string, password: string): Promise<void>;
}
