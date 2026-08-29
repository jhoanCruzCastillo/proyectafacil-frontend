// Countdown hacia un plazo futuro (ej. sla_vence_en) — usado por el asesor para ver cuánto le
// queda para aceptar y por el dashboard del Módulo 4 para resaltar SLA vencidos.
export function tiempoHastaVencer(fechaISO: string): { texto: string; vencido: boolean } {
  const diffMs = new Date(fechaISO).getTime() - Date.now();
  if (diffMs <= 0) return { texto: 'Vencido', vencido: true };

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return { texto: `Vence en ${diffMin} min`, vencido: false };

  const diffHoras = Math.floor(diffMin / 60);
  const minRestantes = diffMin % 60;
  if (diffHoras < 24) return { texto: `Vence en ${diffHoras}h ${minRestantes}min`, vencido: false };

  const diffDias = Math.floor(diffHoras / 24);
  return { texto: `Vence en ${diffDias} día${diffDias === 1 ? '' : 's'}`, vencido: false };
}

export interface ProgresoSla {
  pct: number;
  vencido: boolean;
  /** false cuando no hay slaVenceEn o la solicitud ya salió del estado en que el SLA cuenta —
   * mismo criterio que el KPI "SLA por vencer" de TicketsAsesoriaController::dashboard()
   * (solo estado='pendiente'). El bloque de tiempo no debería mostrarse como vencido/por vencer
   * para una solicitud ya asignada, agendada, completada o cancelada. */
  aplica: boolean;
  barraClase: string;
  textoClase: string;
  texto: string;
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

/** Progreso real de SLA de una solicitud: porcentaje transcurrido entre `creadoEn` y
 * `slaVenceEn` (ambos ISO, calculados por calcularSlaVenceEn() en
 * SolicitudAsesoriaHelpersTrait a partir de configuracion_sla), evaluado contra `ahoraMs`. */
export function progresoSla(creadoEn: string, slaVenceEn: string | null | undefined, aplicaEstado: boolean, ahoraMs: number): ProgresoSla {
  if (!slaVenceEn || !aplicaEstado) {
    return { pct: 100, vencido: false, aplica: false, barraClase: 'bg-gray-200', textoClase: 'text-muted', texto: 'No aplica' };
  }

  const inicioMs = new Date(creadoEn).getTime();
  const finMs = new Date(slaVenceEn).getTime();
  const totalMs = Math.max(1, finMs - inicioMs);
  const restanteMs = Math.max(0, finMs - ahoraMs);
  const pct = Math.max(0, Math.min(100, (restanteMs / totalMs) * 100));
  const vencido = restanteMs <= 0;

  return {
    pct,
    vencido,
    aplica: true,
    barraClase: vencido || pct < 20 ? 'bg-red-500' : pct < 50 ? 'bg-amber-500' : 'bg-emerald-500',
    textoClase: vencido ? 'text-red-600 font-semibold' : pct < 50 ? 'text-amber-600' : 'text-muted',
    texto: formatearRestante(restanteMs, vencido),
  };
}

// Hora corta de un mensaje de chat, ej. "10:24 a. m." — a diferencia de tiempoRelativo(), siempre
// la hora exacta (no "hace X min"), como en cualquier chat real.
export function formatHora(fechaISO: string): string {
  return new Date(fechaISO).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
}

export function tiempoRelativo(fechaISO: string): string {
  const diffMs = Date.now() - new Date(fechaISO).getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;

  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `hace ${diffHoras} h`;

  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias === 1) return 'hace 1 día';
  if (diffDias < 30) return `hace ${diffDias} días`;

  return new Date(fechaISO).toLocaleDateString('es-PE');
}
