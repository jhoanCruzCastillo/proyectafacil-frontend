import { apiFetch } from './_shared';
import type { AuthApi } from '../contracts/auth';
import type { LoginResponse, Sesion } from '@/types';
import { clearAuthToken, getAuthToken, setAuthToken } from '@/lib/authToken';

function sinToken(res: LoginResponse): Sesion {
  const { token: _t, ...sesion } = res;
  return sesion;
}

export const authHttp: AuthApi = {
  async login(usuario, password) {
    const res = await apiFetch<LoginResponse>('auth/login', {
      method: 'POST',
      body: JSON.stringify({ usuario, password }),
    });
    if (!res?.token) return null;
    setAuthToken(res.token);
    return sinToken(res);
  },

  async me() {
    if (!getAuthToken()) return null;
    return apiFetch<Sesion | null>('auth/me');
  },

  async logout() {
    try {
      await apiFetch<unknown>('auth/logout', { method: 'POST' });
    } finally {
      clearAuthToken();
    }
  },
};
