import type { SesionesApi } from '../contracts/sesiones';
import { delay } from './_shared';
import type { SesionUsuario } from '@/types';

// Mock mínimo — este modo no simula sesiones reales por dispositivo, solo cumple el contrato.
export const sesionesMock: SesionesApi = {
  async misSesiones() {
    await delay();
    const ahora = new Date().toISOString();
    const actual: SesionUsuario = {
      id: 'mock-actual',
      dispositivo: 'Windows',
      navegador: 'Chrome',
      ip: null,
      ubicacion: 'Lima, Perú',
      esActual: true,
      activa: true,
      iniciadaEn: ahora,
      ultimaActividad: ahora,
      revocadaEn: null,
    };
    return [actual];
  },

  async cerrar() {
    await delay();
  },
};
