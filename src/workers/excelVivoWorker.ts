// Web Worker del motor de "Excel vivo" — corre excelFormulaEval.ts + xlsxListas.ts fuera del hilo
// principal (ver plan: eliminar el freeze documentado en excelFormulaEval.ts). NO descarga ni
// parsea el .xlsx (DOMParser no está disponible en WorkerGlobalScope, confirmado en el spike de la
// Fase 0, frontend/src/dev/spikeExcelVivoWorker.ts): recibe el libro ya parseado como snapshot
// serializado (ver excelVivoSnapshot.ts) desde el hilo principal, una sola vez por archivo.
import { libroDesdeSnapshot } from '@/lib/excelVivoSnapshot';
import { catalogoDeListas } from '@/lib/xlsxListas';
import { calcularCelda, crearMemoCompartido, type ResultadoCelda } from '@/lib/excelFormulaEval';
import type { LibroLeido } from '@/lib/xlsxXmlReader';
import type { CeldaResultado, MensajeAWorker, MensajeDeWorker } from './excelVivoProtocolo';

let libro: LibroLeido | null = null;

function enviar(msg: MensajeDeWorker): void {
  self.postMessage(msg);
}

function claveAHojaRef(clave: string): [string, string] | null {
  const idx = clave.indexOf('!');
  if (idx < 0) return null;
  return [clave.slice(0, idx), clave.slice(idx + 1)];
}

function manejarCargar(msg: Extract<MensajeAWorker, { tipo: 'cargar' }>): void {
  libro = libroDesdeSnapshot(msg.snapshot);
  enviar({ tipo: 'libro-ok', reqId: msg.reqId });
}

function manejarRecalcular(msg: Extract<MensajeAWorker, { tipo: 'recalcular' }>): void {
  if (!libro) throw new Error('El worker todavía no tiene un libro cargado (falta el mensaje "cargar")');

  const valores = new Map(msg.entradas);
  const usarCache = msg.modo === 'cache';
  const memoFormulas = usarCache ? crearMemoCompartido() : undefined;
  const catalogo = catalogoDeListas(libro, valores, memoFormulas, usarCache);
  // Memoriza por celda (no por fórmula): si dos campos visibles apuntan a la misma celda, no se
  // recalcula dos veces dentro de esta misma pasada — mismo criterio que useListasExcel.ts hoy.
  const memoCalculado = new Map<string, ResultadoCelda | undefined>();

  const porCelda: [string, CeldaResultado][] = [];
  for (const [clave] of msg.entradas) {
    const partes = claveAHojaRef(clave);
    if (!partes) continue;
    const [hoja, ref] = partes;

    // Try/catch POR CELDA (no solo alrededor de todo el batch): una fórmula rara en una sola celda
    // no debe descartar las miles de celdas ya resueltas del resto del batch — mismo criterio de
    // "falla aislada, no cascada" que ya existe cuando calcularCelda() detecta un caso no soportado
    // y devuelve el texto cacheado en vez de reventar.
    try {
      if (!memoCalculado.has(clave)) {
        memoCalculado.set(clave, calcularCelda(libro, valores, hoja, ref, memoFormulas));
      }
      const calculado = memoCalculado.get(clave);
      const opciones = catalogo.opcionesDe(hoja, ref);

      if (calculado !== undefined || opciones !== undefined) {
        porCelda.push([clave, { calculado, opciones }]);
      }
    } catch (e) {
      console.warn(`[excel-vivo-worker] no se pudo resolver ${clave}, se omite:`, e);
    }
  }

  enviar({ tipo: 'resultado', reqId: msg.reqId, version: msg.version, porCelda });
}

function manejarSimular(msg: Extract<MensajeAWorker, { tipo: 'simular' }>): void {
  if (!libro) throw new Error('El worker todavía no tiene un libro cargado (falta el mensaje "cargar")');

  const valoresSimulados = new Map(msg.entradas);
  for (const [clave, valor] of msg.overrides) valoresSimulados.set(clave, valor);

  const resultado =
    msg.kind === 'opciones'
      ? (catalogoDeListas(libro, valoresSimulados, undefined, false).opcionesDe(msg.hoja, msg.ref) ?? null)
      : (calcularCelda(libro, valoresSimulados, msg.hoja, msg.ref, undefined) ?? null);

  enviar({ tipo: 'simulado', reqId: msg.reqId, resultado });
}

self.onmessage = (ev: MessageEvent<MensajeAWorker>) => {
  const msg = ev.data;
  try {
    switch (msg.tipo) {
      case 'cargar':
        manejarCargar(msg);
        break;
      case 'recalcular':
        manejarRecalcular(msg);
        break;
      case 'simular':
        manejarSimular(msg);
        break;
    }
  } catch (e) {
    // Falla aislada: nunca dejar que una fórmula rara mate el worker entero (ver plan, "manejo de
    // errores/degradación") — la celda puntual queda undefined, el resto del formulario sigue.
    if (msg.tipo === 'cargar') {
      enviar({ tipo: 'libro-error', reqId: msg.reqId, mensaje: e instanceof Error ? e.message : String(e) });
    } else {
      enviar({ tipo: 'error', reqId: msg.reqId, mensaje: e instanceof Error ? e.message : String(e) });
    }
  }
};
