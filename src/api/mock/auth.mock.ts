import { delay, readLocal, writeLocal } from './_shared';
import { usuarios as usuariosSeed } from '@/data/usuarios';
import type { AuthApi } from '../contracts/auth';
import type { Sesion, Usuario } from '@/types';

const USUARIOS_KEY = 'vf_usuarios';
const SESION_KEY = 'vf_sesion';

function loadUsuarios(): Usuario[] {
  return readLocal<Usuario[]>(USUARIOS_KEY, usuariosSeed);
}

export const authMock: AuthApi = {
  async login(usuario, password) {
    await delay(200);
    const u = loadUsuarios().find(
      (candidato) =>
        candidato.usuario.toLowerCase() === usuario.trim().toLowerCase() &&
        candidato.password === password &&
        candidato.estado !== 'inactivo',
    );
    if (!u) return null;

    const sesion: Sesion = {
      usuarioId: u.id,
      nombre: u.nombre,
      usuario: u.usuario,
      rol: u.rol,
      iniciadaEn: new Date().toISOString(),
      tienePlan: true,
    };
    writeLocal(SESION_KEY, sesion);
    return sesion;
  },

  async me() {
    return readLocal<Sesion | null>(SESION_KEY, null);
  },

  async logout() {
    localStorage.removeItem(SESION_KEY);
  },

  // Mock mínimo — este modo (VITE_MOCK_AUTH=true) no se usa en el entorno real de este proyecto,
  // pero debe cumplir el contrato para que el resto del código compile igual con cualquier switch.
  async registro() {
    await delay(200);
  },

  async verificarCorreo() {
    await delay(200);
  },
};
