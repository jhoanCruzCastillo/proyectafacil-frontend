export function formatoFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
