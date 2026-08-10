import type { ContextoSeccionIA, ContextoGlobalIA, ContextosIAPlantilla } from '@/types';

export interface ContextosIAApi {
  /** Contextos por sección de una plantilla + catálogo global. */
  porPlantilla(plantillaId: string): Promise<ContextosIAPlantilla>;
  guardarSeccion(plantillaId: string, seccionId: string, markdown: string, globales: string[]): Promise<ContextosIAPlantilla>;
  eliminarSeccion(plantillaId: string, seccionId: string): Promise<ContextosIAPlantilla>;
  globales(): Promise<ContextoGlobalIA[]>;
}

export type { ContextoSeccionIA, ContextoGlobalIA, ContextosIAPlantilla };
