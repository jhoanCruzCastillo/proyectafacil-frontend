import type { ContextoSeccionIA, ContextoGeneralIA, ContextoGlobalIA, ContextosIAPlantilla } from '@/types';

export interface ContextosIAApi {
  /** Contextos por sección de una plantilla + generales de la ficha + catálogo global. */
  porPlantilla(plantillaId: string): Promise<ContextosIAPlantilla>;
  guardarSeccion(plantillaId: string, seccionId: string, markdown: string, globales: string[]): Promise<ContextosIAPlantilla>;
  eliminarSeccion(plantillaId: string, seccionId: string): Promise<ContextosIAPlantilla>;

  /** Upsert de un contexto general de esta ficha — sin `id` crea uno nuevo. */
  guardarGeneral(plantillaId: string, id: string | null, nombre: string, markdown: string): Promise<ContextoGeneralIA[]>;
  eliminarGeneral(plantillaId: string, id: string): Promise<ContextoGeneralIA[]>;

  globales(): Promise<ContextoGlobalIA[]>;
  /** Upsert de un contexto global — sin `id` crea uno nuevo. */
  guardarGlobal(id: string | null, nombre: string, markdown: string, icono: string | null): Promise<ContextoGlobalIA[]>;
  eliminarGlobal(id: string): Promise<ContextoGlobalIA[]>;
}

export type { ContextoSeccionIA, ContextoGeneralIA, ContextoGlobalIA, ContextosIAPlantilla };
