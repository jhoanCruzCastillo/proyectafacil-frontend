import type { EstadoCandidato } from '@/types';

// Compartido entre CandidatosPage.vue (tabla) y CandidatoDetalleModal.vue (encabezado/timeline).
export const ESTADO_CANDIDATO_LABEL: Record<EstadoCandidato, string> = {
  registrado: 'Registrado',
  en_evaluacion: 'En evaluación',
  para_entrevista: 'Para entrevista',
  aprobado: 'Aprobado',
  desaprobado: 'Desaprobado',
};

export const ESTADO_CANDIDATO_CLASE: Record<EstadoCandidato, string> = {
  registrado: 'bg-blue-50 text-blue-700',
  en_evaluacion: 'bg-amber-50 text-amber-700',
  para_entrevista: 'bg-purple-50 text-purple-700',
  aprobado: 'bg-emerald-50 text-emerald-700',
  desaprobado: 'bg-red-50 text-red-700',
};
