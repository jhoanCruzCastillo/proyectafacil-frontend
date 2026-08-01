import type { SubtemaEspecialidad } from '@/types';

export interface SubtemasEspecialidadApi {
  /** Catálogo completo de subtemas activos, de todos los sectores. */
  catalogo(): Promise<SubtemaEspecialidad[]>;
  /** IDs de los subtemas que atiende un asesor. */
  delAsesor(usuarioId: string): Promise<string[]>;
  guardarDelAsesor(usuarioId: string, subtemaIds: string[]): Promise<string[]>;
}
