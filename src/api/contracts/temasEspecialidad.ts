import type { TemaEspecialidad } from '@/types';

// Temas de especialidad del asesor (Proyectos de Inversión, Ejecución de Obras...) — catálogo
// SEPARADO de EspecialidadesAsesorApi (sectores MEF de las fichas/plantillas).
export interface TemasEspecialidadApi {
  /** Catálogo completo de temas de especialidad activos. */
  catalogo(): Promise<TemaEspecialidad[]>;
  /** IDs de los temas que atiende un asesor. */
  delAsesor(usuarioId: string): Promise<string[]>;
  guardarDelAsesor(usuarioId: string, temaIds: string[]): Promise<string[]>;
}
