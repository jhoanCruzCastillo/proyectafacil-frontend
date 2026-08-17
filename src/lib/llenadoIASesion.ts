import type { EstadoCampoIA, ResumenResultadoLlenadoIA } from '@/types';
import type { SeccionProgresoIA } from '@/features/cliente/ProcesamientoIAModal.vue';

export type FaseLlenadoIAPersistible = 'procesando' | 'completado' | 'error';

/** Sesión de llenado IA pendiente de "Terminar proceso" — sobrevive logout/reload en este navegador. */
export interface SesionLlenadoIAGuardada {
  version: 1;
  ejemploId: string;
  /** No se reanuda un HTTP a medias: si quedó 'procesando', al restaurar pasa a 'error'. */
  fase: FaseLlenadoIAPersistible;
  secciones: SeccionProgresoIA[];
  resumenResultado: ResumenResultadoLlenadoIA | null;
  estadosCamposIA: Record<string, EstadoCampoIA>;
  mensajeError: string | null;
  /** Qué modal estaba visible al guardar. */
  modal: 'progreso' | 'resultado' | null;
  guardadoEn: string;
}

const KEY_PREFIX = 'pf_llenado_ia_sesion_';
const VERSION = 1 as const;

function clave(ejemploId: string): string {
  return KEY_PREFIX + ejemploId;
}

const FASES_PERSISTIBLES: readonly FaseLlenadoIAPersistible[] = ['procesando', 'completado', 'error'];

function esFasePersistible(fase: unknown): fase is FaseLlenadoIAPersistible {
  return typeof fase === 'string' && (FASES_PERSISTIBLES as readonly string[]).includes(fase);
}

export function leerSesionLlenadoIA(ejemploId: string): SesionLlenadoIAGuardada | null {
  if (!ejemploId) return null;
  try {
    const raw = localStorage.getItem(clave(ejemploId));
    if (!raw) return null;
    const data = JSON.parse(raw) as SesionLlenadoIAGuardada;
    if (data?.version !== VERSION || data.ejemploId !== ejemploId) return null;
    // localStorage puede traer basura / versiones viejas (p. ej. fase 'idle').
    if (!esFasePersistible(data.fase)) return null;
    return data;
  } catch {
    return null;
  }
}

export function guardarSesionLlenadoIA(sesion: Omit<SesionLlenadoIAGuardada, 'version' | 'guardadoEn'>): void {
  if (!sesion.ejemploId || !esFasePersistible(sesion.fase)) return;
  try {
    const payload: SesionLlenadoIAGuardada = {
      ...sesion,
      version: VERSION,
      guardadoEn: new Date().toISOString(),
    };
    localStorage.setItem(clave(sesion.ejemploId), JSON.stringify(payload));
  } catch {
    /* cuota / modo privado */
  }
}

export function borrarSesionLlenadoIA(ejemploId: string): void {
  if (!ejemploId) return;
  try {
    localStorage.removeItem(clave(ejemploId));
  } catch {
    /* ignore */
  }
}
