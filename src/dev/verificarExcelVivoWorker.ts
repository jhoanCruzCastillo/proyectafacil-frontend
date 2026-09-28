// Fase 2 del plan "Motor de Excel vivo a un Web Worker" — harness de paridad. Carga el Excel real
// en el hilo principal (como siempre), construye un mapa de entradas con TODAS las celdas que ya
// tienen valor real en el archivo, calcula calculado()/opcionesDe() para cada una en el hilo
// principal (comportamiento actual) y en el worker real (excelVivoWorker.ts, vía snapshot), y
// compara resultado celda por celda. Cero diferencias = paridad confirmada. Se conserva en el repo
// como herramienta de verificación (mismo espíritu que backend/app/Commands/DiagnosticoExcelVivo.php)
// para re-correr si se vuelve a tocar el motor de cálculo — útil, por ejemplo, si se agrega una
// función nueva a excelFormulaEval.ts o se cambia algo de xlsxListas.ts. Ya no se auto-importa desde
// main.ts (la migración quedó verificada) — para reusarlo, pega en la consola del navegador en dev:
// `await import('/src/dev/verificarExcelVivoWorker.ts')`, luego `window.verificarExcelVivoWorker(url)`.
import { leerLibroXlsx } from '@/lib/xlsxXmlReader';
import { serializarLibro } from '@/lib/excelVivoSnapshot';
import { catalogoDeListas } from '@/lib/xlsxListas';
import { calcularCelda, crearMemoCompartido, type ResultadoCelda } from '@/lib/excelFormulaEval';
import type { CeldaResultado, MensajeAWorker, MensajeDeWorker } from '@/workers/excelVivoProtocolo';

async function verificarExcelVivoWorker(url: string) {
  console.log('[verificar-excel-worker] cargando', url);
  const libro = await leerLibroXlsx(url);

  // Entradas: toda celda con valor real en cualquier hoja del libro (mismo criterio que usaría
  // construirMapaValoresPorCelda si el ejemplo tuviera TODO lleno — el caso más exigente).
  const entradas: [string, string][] = [];
  for (const hoja of libro.hojas) {
    const parseada = libro.hojaCompleta(hoja);
    if (!parseada) continue;
    for (const [ref, celda] of parseada.celdas) entradas.push([`${hoja}!${ref}`, celda.valor]);
  }
  console.log('[verificar-excel-worker]', entradas.length, 'celdas con valor real en', libro.hojas.length, 'hojas');

  // --- Hilo principal (comportamiento actual) ---
  const t0 = performance.now();
  const valores = new Map(entradas);
  const memoFormulas = crearMemoCompartido();
  const catalogo = catalogoDeListas(libro, valores, memoFormulas, true);
  const memoCalculado = new Map<string, ResultadoCelda | undefined>();
  const esperadoPorCelda = new Map<string, CeldaResultado>();
  for (const [clave] of entradas) {
    const idx = clave.indexOf('!');
    const hoja = clave.slice(0, idx);
    const ref = clave.slice(idx + 1);
    if (!memoCalculado.has(clave)) memoCalculado.set(clave, calcularCelda(libro, valores, hoja, ref, memoFormulas));
    const calculado = memoCalculado.get(clave);
    const opciones = catalogo.opcionesDe(hoja, ref);
    if (calculado !== undefined || opciones !== undefined) {
      esperadoPorCelda.set(clave, { calculado, opciones });
    }
  }
  const msPrincipal = performance.now() - t0;
  console.log('[verificar-excel-worker] hilo principal:', esperadoPorCelda.size, 'celdas resueltas en', msPrincipal.toFixed(1), 'ms');

  // --- Worker real ---
  const worker = new Worker(new URL('../workers/excelVivoWorker.ts', import.meta.url), { type: 'module' });
  const snapshot = serializarLibro(libro);

  const resultadoWorker = await new Promise<Map<string, CeldaResultado>>((resolve, reject) => {
    worker.onerror = (ev) => reject(new Error(`Worker error: ${ev.message}`));
    worker.onmessage = (ev: MessageEvent<MensajeDeWorker>) => {
      const msg = ev.data;
      if (msg.tipo === 'libro-error') {
        reject(new Error(`libro-error: ${msg.mensaje}`));
        return;
      }
      if (msg.tipo === 'error') {
        reject(new Error(`error del worker: ${msg.mensaje}`));
        return;
      }
      if (msg.tipo === 'libro-ok') {
        const t1 = performance.now();
        const recalcular: MensajeAWorker = { tipo: 'recalcular', reqId: 2, version: 1, entradas, modo: 'cache' };
        worker.postMessage(recalcular);
        (worker as unknown as { __t1: number }).__t1 = t1;
        return;
      }
      if (msg.tipo === 'resultado') {
        const t1 = (worker as unknown as { __t1: number }).__t1;
        console.log('[verificar-excel-worker] worker:', msg.porCelda.length, 'celdas resueltas en', (performance.now() - t1).toFixed(1), 'ms');
        resolve(new Map(msg.porCelda));
      }
    };
    const cargar: MensajeAWorker = { tipo: 'cargar', reqId: 1, snapshot };
    worker.postMessage(cargar);
  });

  worker.terminate();

  // --- Comparación ---
  const diffs: string[] = [];
  const claves = new Set([...esperadoPorCelda.keys(), ...resultadoWorker.keys()]);
  for (const clave of claves) {
    const esperado = esperadoPorCelda.get(clave);
    const obtenido = resultadoWorker.get(clave);
    if (JSON.stringify(esperado) !== JSON.stringify(obtenido)) {
      diffs.push(`${clave}: esperado=${JSON.stringify(esperado)} obtenido=${JSON.stringify(obtenido)}`);
    }
  }

  if (diffs.length === 0) {
    console.log(`[verificar-excel-worker] ✅ PARIDAD EXACTA — ${claves.size} celdas comparadas, 0 diferencias`);
  } else {
    console.error(`[verificar-excel-worker] ❌ ${diffs.length} diferencias de ${claves.size} celdas`);
    console.log(diffs.slice(0, 20));
  }

  return { ok: diffs.length === 0, totalCeldas: claves.size, diffs, msPrincipal };
}

if (import.meta.env.DEV) {
  (window as unknown as { verificarExcelVivoWorker: typeof verificarExcelVivoWorker }).verificarExcelVivoWorker = verificarExcelVivoWorker;
  console.log('[verificar-excel-worker] listo — llama window.verificarExcelVivoWorker("<url-del-xlsx>") desde la consola');
}
