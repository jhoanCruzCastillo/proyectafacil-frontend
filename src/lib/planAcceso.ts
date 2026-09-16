import { planes } from '@/data/planes';
import type { FacturacionMock } from '@/types';

const SEMANAS_ENTRENAMIENTO = 4;
const DIAS_ENTRENAMIENTO = SEMANAS_ENTRENAMIENTO * 7;

export function numeroNivelDe(planId: string): number {
  return planes.find((p) => p.id === planId)?.numeroNivel ?? 1;
}

export function esPlanEntrenamiento(_planId: string): boolean {
  // Ya no hay plan pedagógico: los 3 niveles son membresías mensuales (Profesional /
  // Consultora-Empresa / Gobierno). Se deja la función para no romper las pantallas que
  // todavía mencionan el modo entrenamiento; nunca aplica.
  return false;
}

// Cupo de fichas simultáneas del plan + add-on "Plantilla adicional".
export function limiteFichasSimultaneas(facturacion: FacturacionMock): number {
  const plan = planes.find((p) => p.id === facturacion.planId);
  const base = plan?.limiteFichasBase ?? 3;
  const extra = facturacion.addons?.['plantilla-adicional'] ?? 0;
  return base + extra;
}

// Cupo de consultas de asesoría 1:1 con un docente — cada solicitud creada (sin importar su
// estado) consume una, sin importar cuántas plantillas simultáneas tenga el cliente. El add-on
// "Consultoría 1 a 1" no tiene nivelesDisponibles (se vende desde cualquier nivel, incluido el 0).
export function limiteConsultas(facturacion: FacturacionMock): number {
  const plan = planes.find((p) => p.id === facturacion.planId);
  const base = plan?.limiteConsultasBase ?? 3;
  const extra = facturacion.addons?.['consultoria-1a1'] ?? 0;
  return base + extra;
}

function fechaVencimiento(fechaInicioPlan: string): Date {
  const venc = new Date(fechaInicioPlan);
  venc.setDate(venc.getDate() + DIAS_ENTRENAMIENTO);
  return venc;
}

export function entrenamientoVencido(facturacion: FacturacionMock): boolean {
  if (!esPlanEntrenamiento(facturacion.planId) || !facturacion.fechaInicioPlan) return false;
  return Date.now() > fechaVencimiento(facturacion.fechaInicioPlan).getTime();
}

export function diasRestantesEntrenamiento(facturacion: FacturacionMock): number {
  if (!facturacion.fechaInicioPlan) return DIAS_ENTRENAMIENTO;
  const restante = fechaVencimiento(facturacion.fechaInicioPlan).getTime() - Date.now();
  return Math.max(0, Math.ceil(restante / (1000 * 60 * 60 * 24)));
}

// Histórico de cambios en fichas llenadas: ventaja del Nivel 2 (Gobierno Regional / Local).
export const NIVEL_HISTORIAL = 2;
export function puedeVerHistorial(numeroNivel: number): boolean {
  return numeroNivel >= NIVEL_HISTORIAL;
}
