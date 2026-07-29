import type { SolicitudAsesoria } from '@/types';

// Helpers de presentación compartidos entre las pantallas del lado asesor (DocenteHomePage —
// dashboard — y MisConsultasPage — listado completo) para no duplicar la misma lógica dos veces.

// Paleta hasheada por categoría — mismo criterio que Avatar.vue (sin mapa fijo por sector, así
// cualquier categoría nueva del catálogo recibe un color consistente entre renders).
const PALETA_CATEGORIA = [
  'bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700', 'bg-indigo-100 text-indigo-700',
];
export function colorCategoria(nombre: string | null | undefined): string {
  const texto = nombre ?? '';
  let hash = 0;
  for (let i = 0; i < texto.length; i++) hash = texto.charCodeAt(i) + ((hash << 5) - hash);
  return PALETA_CATEGORIA[Math.abs(hash) % PALETA_CATEGORIA.length];
}

export function horaAmPm(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const periodo = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${periodo}`;
}

export function formatFechaHoraVideo(s: SolicitudAsesoria): string {
  if (!s.horarioFecha) return '';
  const fecha = new Date(`${s.horarioFecha}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  const rango = s.horarioHoraInicio && s.horarioHoraFin ? `${horaAmPm(s.horarioHoraInicio)} - ${horaAmPm(s.horarioHoraFin)}` : '';
  return rango ? `${fecha} · ${rango}` : fecha;
}

// La llamada se habilita desde 15 min antes de la hora agendada hasta que termina el bloque —
// mismo margen que `tiempo_extra_conexion_minutos` en configuracion_sla (15 min por defecto).
const MARGEN_CONEXION_MIN = 15;
export function ventanaDeLlamada(s: SolicitudAsesoria): { disponible: boolean; texto: string } {
  if (!s.horarioFecha || !s.horarioHoraInicio) return { disponible: !!s.linkReunion, texto: '' };

  const inicio = new Date(`${s.horarioFecha}T${s.horarioHoraInicio}:00`);
  const fin = s.horarioHoraFin ? new Date(`${s.horarioFecha}T${s.horarioHoraFin}:00`) : new Date(inicio.getTime() + 30 * 60_000);
  const ventanaInicio = new Date(inicio.getTime() - MARGEN_CONEXION_MIN * 60_000);
  const ahora = new Date();

  if (ahora >= ventanaInicio && ahora <= fin) return { disponible: true, texto: 'Disponible ahora' };
  if (ahora > fin) return { disponible: false, texto: 'La videollamada ya finalizó' };

  const minFaltantes = Math.ceil((ventanaInicio.getTime() - ahora.getTime()) / 60_000);
  if (minFaltantes < 60) return { disponible: false, texto: `Disponible en ${String(Math.floor(minFaltantes / 60)).padStart(2, '0')}:${String(minFaltantes % 60).padStart(2, '0')} min` };
  const horas = Math.floor(minFaltantes / 60);
  if (horas < 24) return { disponible: false, texto: `Disponible en ${String(horas).padStart(2, '0')}:${String(minFaltantes % 60).padStart(2, '0')} min` };
  const dias = Math.ceil(horas / 24);
  return { disponible: false, texto: `Disponible en ${dias} día${dias === 1 ? '' : 's'}` };
}

export function unirseALlamada(s: SolicitudAsesoria): void {
  if (s.linkReunion) window.open(s.linkReunion, '_blank', 'noopener,noreferrer');
}
