// Datos ficticios generados en el FRONTEND para que la tabla de Tickets de asesoría se vea poblada
// en la demo — pedido explícito del usuario, no viene del backend ni se guarda en ningún lado.
// Todo es determinístico por el id del ticket (mismo ticket = mismos valores mientras dure la
// sesión del navegador), salvo el conteo regresivo del SLA que sí avanza de verdad con el reloj.

function hashSeed(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (Math.imul(31, h) + texto.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// PRNG determinístico (mulberry32): mismo seed numérico → misma secuencia de valores siempre.
function crearPseudoAleatorio(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ETIQUETAS_DOCENTE = [
  'Invitado hace 1h',
  'Invitado hace 3h',
  'Invitado hace 8h',
  'Invitado hace 24h',
  'Agendado',
  'Completado hace 2h',
  'Completado hace 5h',
  'Cancelado por alumno',
];

export function etiquetaDocenteFalsa(ticketId: string): string {
  const rnd = crearPseudoAleatorio(hashSeed(ticketId));
  return ETIQUETAS_DOCENTE[Math.floor(rnd() * ETIQUETAS_DOCENTE.length)];
}

const PALETA_BADGE = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700',
];

export function claseCategoria(nombre: string): string {
  return PALETA_BADGE[hashSeed(nombre) % PALETA_BADGE.length];
}

interface SlaFalsoConfig {
  totalMs: number;
  inicioMs: number;
}

// Cada ticket arranca con una duración total y un punto de partida ficticios pero estables — el
// tiempo restante se recalcula en vivo contra Date.now() en el componente, para que la barra avance
// de verdad segundo a segundo en vez de quedar estática.
export function slaFalsoConfig(ticketId: string): SlaFalsoConfig {
  const rnd = crearPseudoAleatorio(hashSeed(ticketId) + 1);
  const totalMinutos = 15 + Math.floor(rnd() * (24 * 60 - 15));
  const totalMs = totalMinutos * 60_000;
  // Arranca en un punto aleatorio de su propio recorrido (0%–95% transcurrido) para que, al cargar
  // la página, las barras ya se vean en distintos estados en vez de todas llenas al 100%.
  const fraccionTranscurrida = rnd() * 0.95;
  const inicioMs = Date.now() - fraccionTranscurrida * totalMs;
  return { totalMs, inicioMs };
}

export interface SlaFalsoEstado {
  pct: number;
  vencido: boolean;
  barraClase: string;
  textoClase: string;
  texto: string;
}

export function slaFalsoEstado(cfg: SlaFalsoConfig, ahoraMs: number): SlaFalsoEstado {
  const restanteMs = Math.max(0, cfg.totalMs - (ahoraMs - cfg.inicioMs));
  const pct = Math.max(0, Math.min(100, (restanteMs / cfg.totalMs) * 100));
  const vencido = restanteMs <= 0;

  return {
    pct,
    vencido,
    barraClase: vencido || pct < 20 ? 'bg-red-500' : pct < 50 ? 'bg-amber-500' : 'bg-emerald-500',
    textoClase: vencido ? 'text-red-600 font-semibold' : pct < 50 ? 'text-amber-600' : 'text-muted',
    texto: formatearRestante(restanteMs, vencido),
  };
}

function formatearRestante(ms: number, vencido: boolean): string {
  if (vencido) return 'Vencido';
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m restantes`;
  const s = Math.floor((ms % 60_000) / 1000);
  return m > 0 ? `${m}m ${s}s restantes` : `${s}s restantes`;
}
