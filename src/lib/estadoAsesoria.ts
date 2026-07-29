import type { EstadoSolicitudAsesoria } from '@/types';

// Etiquetas/colores del vocabulario final (docs/proyectafacil-asesorias.md §3.2) — compartido entre
// la vista del alumno (AsesoriasPage) y la del Administrativo de Asesorías (Módulo 4).
export const ESTADO_ASESORIA_LABEL: Record<EstadoSolicitudAsesoria, string> = {
  pendiente: 'Pendiente',
  asignado: 'Asignado',
  agendado: 'Agendado',
  completado: 'Completado',
  cancelado: 'Cancelado',
  en_espera: 'En espera',
};

export const ESTADO_ASESORIA_CLASE: Record<EstadoSolicitudAsesoria, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  asignado: 'bg-blue-100 text-blue-700',
  agendado: 'bg-blue-100 text-blue-700',
  completado: 'bg-green-100 text-green-700',
  cancelado: 'bg-gray-100 text-gray-500',
  en_espera: 'bg-orange-100 text-orange-700',
};
