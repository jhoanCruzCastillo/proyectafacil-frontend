// Tipos del protocolo de mensajes entre el hilo principal y excelVivoWorker.ts. Sin código en
// tiempo de ejecución (solo tipos) — importable por ambos lados sin arrastrar nada de Vue.
import type { ResultadoCelda } from '@/lib/excelFormulaEval';
import type { LibroSerializado } from '@/lib/excelVivoSnapshot';

/** 'cache' (por defecto): ver catalogoDeListas() en xlsxListas.ts. 'tiempo_real' apaga el caché
 * permanente de listas y el memo compartido de fórmulas — vía de escape manual del editor. */
export type ModoCalculoExcel = 'cache' | 'tiempo_real';

// `codigoFormato` no viaja acá: es una propiedad estática de la celda (no depende de
// valoresPorCelda ni del motor de fórmulas), así que el hilo principal la sigue leyendo directo
// del LibroLeido real que nunca deja de existir ahí — no hay razón para pasarla por el worker.
export interface CeldaResultado {
  calculado?: ResultadoCelda;
  opciones?: string[];
}

export type MensajeAWorker =
  | { tipo: 'cargar'; reqId: number; snapshot: LibroSerializado }
  | { tipo: 'recalcular'; reqId: number; version: number; entradas: [string, string][]; modo: ModoCalculoExcel }
  | {
      tipo: 'simular';
      reqId: number;
      kind: 'opciones' | 'calculado';
      hoja: string;
      ref: string;
      entradas: [string, string][];
      overrides: [string, string][];
    };

export type MensajeDeWorker =
  | { tipo: 'libro-ok'; reqId: number }
  | { tipo: 'libro-error'; reqId: number; mensaje: string }
  | { tipo: 'resultado'; reqId: number; version: number; porCelda: [string, CeldaResultado][] }
  | { tipo: 'simulado'; reqId: number; resultado: string[] | ResultadoCelda | null }
  | { tipo: 'error'; reqId: number; mensaje: string };
