import type { UsuariosApi } from '../contracts/usuarios';
import { delay, readLocal, writeLocal } from './_shared';
import { usuarios as usuariosSeed } from '@/data/usuarios';
import { planes } from '@/data/planes';
import type { AsignarBeneficiosPayload, BeneficiosAsignados, Usuario } from '@/types';

const KEY = 'vf_usuarios';
const KEY_BENEFICIOS = 'vf_beneficios_asignados';

function load(): Usuario[] {
  return readLocal<Usuario[]>(KEY, usuariosSeed);
}

function save(data: Usuario[]): void {
  writeLocal(KEY, data);
}

function loadBeneficios(): Record<string, BeneficiosAsignados> {
  return readLocal<Record<string, BeneficiosAsignados>>(KEY_BENEFICIOS, {});
}

function saveBeneficios(data: Record<string, BeneficiosAsignados>): void {
  writeLocal(KEY_BENEFICIOS, data);
}

function vacio(id: string): BeneficiosAsignados {
  return {
    cuentaId: id,
    planId: null,
    planNombre: null,
    limitePlantillas: 0,
    limitePlantillasBase: 0,
    fichasChatDisponibles: 0,
    fichasVideoDisponibles: 0,
  };
}

/** Espejo simplificado de UsuariosController::fechaVigenciaDesde (backend) — solo para que el modo
 * mock no rompa cuando VITE_MOCK_USUARIOS está activo. */
function vigenciaDesde(fechaBase: string, meses: number | null | undefined): string | null {
  if (meses == null) return null;
  const fecha = new Date(fechaBase);
  fecha.setMonth(fecha.getMonth() + meses);
  return fecha.toISOString().slice(0, 10);
}

export const usuariosMock: UsuariosApi = {
  async list() {
    await delay();
    return load();
  },

  async create(usuario) {
    await delay();
    const data = load();
    const ahora = new Date().toISOString();
    const esAlumno = usuario.origen === 'alumno';
    const creado: Usuario = {
      ...usuario,
      fechaRegistro: ahora,
      vigenciaAlumnoHasta: esAlumno ? vigenciaDesde(ahora, usuario.vigenciaMeses) : null,
      correoEnviado: esAlumno && !!usuario.correo,
    };
    data.push(creado);
    save(data);
    return creado;
  },

  async update(id, patch) {
    await delay();
    const data = load();
    const idx = data.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error(`Usuario ${id} no encontrado`);
    const actual = data[idx];
    const origenFinal = patch.origen ?? actual.origen;
    const cambios = { ...patch };
    if ('vigenciaMeses' in patch) {
      cambios.vigenciaAlumnoHasta = origenFinal === 'alumno'
        ? vigenciaDesde(actual.fechaRegistro ?? new Date().toISOString(), patch.vigenciaMeses)
        : null;
    }
    delete cambios.vigenciaMeses;
    data[idx] = { ...actual, ...cambios };
    save(data);
    return data[idx];
  },

  async remove(id) {
    await delay();
    save(load().filter((u) => u.id !== id));
  },

  async enviarAccesos() {
    await delay();
  },

  async enviarAccesosDirecto() {
    await delay();
  },

  async beneficiosAsignados(id) {
    await delay();
    return loadBeneficios()[id] ?? vacio(id);
  },

  async asignarBeneficios(id, payload: AsignarBeneficiosPayload) {
    await delay();
    const all = loadBeneficios();
    const actual = all[id] ?? vacio(id);
    const plan = planes.find((p) => p.id === payload.planId);
    if (plan) {
      actual.planId = plan.id;
      actual.planNombre = plan.nombre;
      actual.limitePlantillasBase = plan.limiteFichasBase;
      if (payload.limitePlantillas == null) {
        actual.limitePlantillas = Math.max(actual.limitePlantillas, plan.limiteFichasBase);
      }
    }
    if (payload.limitePlantillas != null) {
      actual.limitePlantillas = payload.limitePlantillas;
    }
    actual.fichasChatDisponibles += payload.agregarFichasChat ?? 0;
    actual.fichasVideoDisponibles += payload.agregarFichasVideo ?? 0;
    all[id] = actual;
    saveBeneficios(all);
    return actual;
  },
};
