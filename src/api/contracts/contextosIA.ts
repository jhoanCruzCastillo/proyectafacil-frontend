import type { ContextoSeccionIA, ContextoGeneralIA, ContextoGlobalIA, ContextosIAPlantilla, ContextoIAPasoAsignacion, ContextoIAPasoFallback } from '@/types';

export interface ContextosIAApi {
  /** Contextos por sección de una plantilla + generales de la ficha + catálogo global + pasos. */
  porPlantilla(plantillaId: string): Promise<ContextosIAPlantilla>;
  /** Texto base para "Restaurar predeterminado" del pilar Prompt del sistema — armado en el backend
   * para no duplicar ahí el rol/contrato JSON que ya está fijo en LlenadoIAController. */
  promptSistemaPredeterminado(plantillaId: string): Promise<{ markdown: string }>;
  guardarSeccion(plantillaId: string, seccionId: string, markdown: string, globales: string[]): Promise<ContextosIAPlantilla>;
  eliminarSeccion(plantillaId: string, seccionId: string): Promise<ContextosIAPlantilla>;

  /** Upsert de un contexto general de esta ficha — sin `id` crea uno nuevo. */
  guardarGeneral(plantillaId: string, id: string | null, nombre: string, markdown: string): Promise<ContextoGeneralIA[]>;
  eliminarGeneral(plantillaId: string, id: string): Promise<ContextoGeneralIA[]>;

  globales(): Promise<ContextoGlobalIA[]>;
  /** Upsert de un contexto global — sin `id` crea uno nuevo. */
  guardarGlobal(id: string | null, nombre: string, markdown: string, icono: string | null): Promise<ContextoGlobalIA[]>;
  eliminarGlobal(id: string): Promise<ContextoGlobalIA[]>;

  /** Asigna un insumo (general o global) al paso indicado (1/2/4/5) — tab "Estructura". */
  guardarPaso(plantillaId: string, paso: number, tipo: 'general' | 'global', insumoId: string): Promise<ContextosIAPlantilla>;
  eliminarPaso(plantillaId: string, asignacionId: string): Promise<ContextosIAPlantilla>;
}

export type { ContextoSeccionIA, ContextoGeneralIA, ContextoGlobalIA, ContextosIAPlantilla, ContextoIAPasoAsignacion, ContextoIAPasoFallback };
