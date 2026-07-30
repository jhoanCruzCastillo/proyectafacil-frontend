// Datos ficticios generados en el FRONTEND para "Mis X" del lado cliente — mismo patrón que
// ticketsDemoFake.ts del lado administrativo. La cuenta de demo no siempre tiene fichas reales con
// progreso variado, así que el avance/fecha que se muestra en la lista es aleatorio pero estable
// por ejemplo (mismo ejemplo = mismos valores mientras dure la sesión del navegador).

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

export interface ProgresoFalso {
  pct: number;
  completo: boolean;
}

export function progresoFalso(ejemploId: string): ProgresoFalso {
  const rnd = crearPseudoAleatorio(hashSeed(ejemploId));
  const completo = rnd() < 0.35;
  const pct = completo ? 100 : 15 + Math.floor(rnd() * 75);
  return { pct, completo };
}

export function fechaEdicionFalsa(ejemploId: string): string {
  const rnd = crearPseudoAleatorio(hashSeed(ejemploId) + 1);
  const diasAtras = 1 + Math.floor(rnd() * 45);
  const fecha = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);
  return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
