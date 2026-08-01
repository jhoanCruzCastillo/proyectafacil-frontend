// Formatos compartidos por las tres pestañas de "Mi Liquidación".

const MILES = new Intl.NumberFormat('es-PE');

/** 26400 → "S/ 26,400". Sin decimales: los honorarios son montos redondos por consulta. */
export function soles(monto: number): string {
  return `S/ ${MILES.format(Math.round(monto))}`;
}

const MESES_CORTOS = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'set.', 'oct.', 'nov.', 'dic.'];

/** ISO → "14 ago. 2026 · 10:00 am" */
export function fechaHora(iso: string): string {
  const d = new Date(iso);
  const h24 = d.getHours();
  const ampm = h24 < 12 ? 'am' : 'pm';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()} · ${h12}:${min} ${ampm}`;
}

/** ISO → "14 ago. 2026" */
export function fechaCorta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Días transcurridos desde una fecha ISO hasta hoy. */
export function diasDesde(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/** "hace 22 días" / "hace 1 día" / "hoy" */
export function antiguedad(iso: string): string {
  const d = diasDesde(iso);
  if (d === 0) return 'hoy';
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}
