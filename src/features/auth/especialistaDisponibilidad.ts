// Lógica pura del calendario semanal del wizard de registro de especialistas — compartida entre
// RegistroEspecialistaPage.vue (validación de paso, resumen final, payload de envío) y
// PasoDisponibilidad.vue (grilla interactiva). `bloques` es el mismo objeto reactivo en ambos
// lados, por eso estas funciones lo reciben como parámetro en vez de guardar su propio estado.
export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const HORAS = Array.from({ length: 13 }, (_, i) => i + 8); // 8..20 (bloques de 1h, hasta 20-21h)

export function formatoHora(hora: number): string {
  const hh = ((hora + 11) % 12) + 1;
  return `${hh}${hora < 12 ? ' a. m.' : ' p. m.'}`;
}

export function claveBloque(dia: number, hora: number): string {
  return `${dia}-${hora}`;
}

export function bloqueMarcado(bloques: Record<string, boolean>, dia: number, hora: number): boolean {
  return !!bloques[claveBloque(dia, hora)];
}

export function bloqueBloqueado(dia: number, hora: number): boolean {
  return dia === 5 && hora >= 13;
}

export function bloquesDelDia(bloques: Record<string, boolean>, dia: number): number {
  return HORAS.filter((h) => bloqueMarcado(bloques, dia, h)).length;
}

export function totalBloques(bloques: Record<string, boolean>): number {
  return DIAS.reduce((total, _dia, d) => total + bloquesDelDia(bloques, d), 0);
}

export function resumenBloques(bloques: Record<string, boolean>): string[] {
  const chips: string[] = [];
  DIAS.forEach((nombreDia, d) => {
    HORAS.forEach((h) => {
      if (bloqueMarcado(bloques, d, h)) chips.push(`${nombreDia.slice(0, 3)} ${formatoHora(h)}`);
    });
  });
  return chips;
}

export function listaDisponibilidad(bloques: Record<string, boolean>): string {
  const lineas: string[] = [];
  DIAS.forEach((nombreDia, d) => {
    const horas = HORAS.filter((h) => bloqueMarcado(bloques, d, h));
    if (horas.length) lineas.push(`${nombreDia}: ${horas.map(formatoHora).join(', ')}`);
  });
  return lineas.join(' · ');
}
