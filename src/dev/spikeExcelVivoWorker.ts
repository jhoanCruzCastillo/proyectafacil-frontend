// Fase 0 del plan "Motor de Excel vivo a un Web Worker" — spike de viabilidad, NO producción.
// Objetivo único: confirmar con evidencia real que DOMParser (usado por xlsxXmlReader.ts para
// parsear sharedStrings/estilos/hojas) funciona dentro de un WorkerGlobalScope real de Chrome,
// contra el Excel real de una plantilla — no está garantizado por el spec base de Worker, solo
// expuesto por navegadores evergreen modernos. Reusa leerLibroXlsx() TAL CUAL (sin reescribir
// nada): si el motor es de verdad puro (sin window/document/localStorage), esto debería andar
// igual que en el hilo principal. Se conserva como herramienta de depuración (mismo espíritu que
// backend/app/Commands/DiagnosticoExcelVivo.php) — no se borra tras el spike.
import { leerLibroXlsx } from '@/lib/xlsxXmlReader';
import { resumirLibro, type ResumenLibroSpike } from './resumenLibroSpike';

export type MensajeSpikeWorker = ({ ok: true; ms: number } & ResumenLibroSpike) | { ok: false; error: string };

self.onmessage = async (ev: MessageEvent<{ url: string }>) => {
  const inicio = performance.now();
  try {
    const libro = await leerLibroXlsx(ev.data.url);
    const resumen = resumirLibro(libro);
    const mensaje: MensajeSpikeWorker = { ok: true, ms: performance.now() - inicio, ...resumen };
    self.postMessage(mensaje);
  } catch (e) {
    const mensaje: MensajeSpikeWorker = { ok: false, error: e instanceof Error ? e.message : String(e) };
    self.postMessage(mensaje);
  }
};
