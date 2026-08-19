import type { EjemplosApi } from '../contracts/ejemplos';
import { delay, readLocal, writeLocal } from './_shared';
import { ejemplos as ejemplosSeed } from '@/data/ejemplos';
import type { Ejemplo } from '@/types';

const KEY = 'vf_ejemplos';

function load(): Ejemplo[] {
  return readLocal<Ejemplo[]>(KEY, ejemplosSeed);
}

function save(data: Ejemplo[]): void {
  writeLocal(KEY, data);
}

export const ejemplosMock: EjemplosApi = {
  async list() {
    await delay();
    return load();
  },

  async listByPlantilla(plantillaId) {
    await delay();
    return load().filter((e) => e.plantillaId === plantillaId);
  },

  async get(id) {
    await delay();
    return load().find((e) => e.id === id) ?? null;
  },

  async create(ejemplo) {
    await delay();
    const data = load();
    data.push(ejemplo);
    save(data);
    return ejemplo;
  },

  async update(id, patch) {
    await delay();
    const data = load();
    const idx = data.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error(`Ejemplo ${id} no encontrado`);
    data[idx] = { ...data[idx], ...patch };
    save(data);
    return data[idx];
  },

  async remove(id) {
    await delay();
    save(load().filter((e) => e.id !== id));
  },

  async marcarReferenciaIA(id, activo) {
    await delay();
    const data = load();
    const idx = data.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error(`Ejemplo ${id} no encontrado`);
    // Mismo comportamiento que el backend: a lo más uno marcado por plantilla.
    if (activo) {
      const plantillaId = data[idx].plantillaId;
      for (const e of data) {
        if (e.plantillaId === plantillaId) e.esReferenciaIA = false;
      }
    }
    data[idx] = { ...data[idx], esReferenciaIA: activo };
    save(data);
    return data[idx];
  },
};
