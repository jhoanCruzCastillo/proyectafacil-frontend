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
