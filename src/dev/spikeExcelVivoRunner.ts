// Fase 0 del plan "Motor de Excel vivo a un Web Worker" (ya completada y validada — DOMParser no
// funciona en Workers, ver el plan) — disparador manual desde la consola del navegador
// (`window.spikeExcelVivo(url)`). Corre leerLibroXlsx() en el HILO PRINCIPAL y, en paralelo, en un
// Worker real — compara el resumen (hojas, fórmulas, fusiones, validaciones de muestra). Ya no se
// auto-importa desde main.ts (la migración quedó verificada) — para reusarlo, pega en la consola del
// navegador en dev: `await import('/src/dev/spikeExcelVivoRunner.ts')`, luego llama la función.
import { leerLibroXlsx } from '@/lib/xlsxXmlReader';
import { resumirLibro } from './resumenLibroSpike';
import type { MensajeSpikeWorker } from './spikeExcelVivoWorker';

async function spikeExcelVivo(url: string) {
  console.log('[spike-excel-worker] arrancando contra', url);

  const t0 = performance.now();
  const libroPrincipal = await leerLibroXlsx(url);
  const resumenPrincipal = resumirLibro(libroPrincipal);
  const msPrincipal = performance.now() - t0;
  console.log('[spike-excel-worker] hilo principal OK en', msPrincipal.toFixed(1), 'ms', resumenPrincipal);

  const worker = new Worker(new URL('./spikeExcelVivoWorker.ts', import.meta.url), { type: 'module' });

  const resultadoWorker = await new Promise<MensajeSpikeWorker>((resolve, reject) => {
    worker.onmessage = (ev: MessageEvent<MensajeSpikeWorker>) => resolve(ev.data);
    worker.onerror = (ev) => reject(new Error(`Worker error: ${ev.message}`));
    worker.postMessage({ url });
  });

  worker.terminate();

  if (!resultadoWorker.ok) {
    console.error('[spike-excel-worker] el worker falló:', resultadoWorker.error);
    return { ok: false as const, error: resultadoWorker.error };
  }

  console.log('[spike-excel-worker] worker OK en', resultadoWorker.ms.toFixed(1), 'ms', resultadoWorker);

  const { ms: _ms, ok: _ok, ...resumenWorker } = resultadoWorker;
  const diff = JSON.stringify(resumenPrincipal) === JSON.stringify(resumenWorker);

  console.log(diff ? '[spike-excel-worker] ✅ PARIDAD EXACTA' : '[spike-excel-worker] ❌ DIFERENCIAS ENCONTRADAS');
  if (!diff) {
    console.log('[spike-excel-worker] hilo principal:', resumenPrincipal);
    console.log('[spike-excel-worker] worker:', resumenWorker);
  }

  return { ok: true as const, diff, msPrincipal, msWorker: resultadoWorker.ms, resumenPrincipal, resumenWorker };
}

if (import.meta.env.DEV) {
  (window as unknown as { spikeExcelVivo: typeof spikeExcelVivo }).spikeExcelVivo = spikeExcelVivo;
  console.log('[spike-excel-worker] listo — llama window.spikeExcelVivo("<url-del-xlsx>") desde la consola');
}
