import type { Plan, AddOn } from '@/types';

export const planes: Plan[] = [
  {
    id: 'nivel-0',
    numeroNivel: 0,
    nombre: 'Profesional',
    precio: 400,
    periodicidad: 'Mensual',
    limiteFichasBase: 3,
    limiteConsultasBase: 2,
    limiteUsuariosBase: 1,
    features: [
      '2 sesiones de 1 hora',
      'Chat ilimitado',
      'Acceso a plantillas ILPIIE',
      'Descuento 15% en sesiones adicionales',
    ],
  },
  {
    id: 'nivel-1',
    numeroNivel: 1,
    nombre: 'Consultora / Empresa',
    precio: 1200,
    periodicidad: 'Mensual',
    limiteFichasBase: 10,
    limiteConsultasBase: 4,
    limiteUsuariosBase: 3,
    features: [
      '4 sesiones de 1 hora',
      '1 sesión grupal (hasta 5 personas)',
      'Chat prioritario',
      'Acceso a IA asistente avanzada',
      'Reporte mensual de consultas',
    ],
  },
  {
    id: 'nivel-2',
    numeroNivel: 2,
    nombre: 'Gobierno Regional / Local',
    precio: 3500,
    periodicidad: 'Mensual',
    limiteFichasBase: 20,
    limiteConsultasBase: 10,
    limiteUsuariosBase: 5,
    features: [
      '10 sesiones de 1 hora',
      'Acompañamiento en trámite específico',
      'Reporte mensual ejecutivo',
      'Facturación a entidad con orden de servicio',
    ],
  },
];

export const addOns: AddOn[] = [
  {
    id: 'consultoria-1a1',
    nombre: 'Consultoría 1 a 1',
    descripcion: 'Una consulta adicional de asesoría 1:1 con un docente, para cuando ya usaste las que incluye tu plan — disponible desde cualquier nivel.',
    precio: 550,
    recurrente: false,
  },
  {
    id: 'usuario-adicional',
    nombre: 'Usuario adicional',
    descripcion: 'Usuarios adicionales para cualquier nivel de membresía',
    precio: 45,
    recurrente: true,
    nivelesDisponibles: [0, 1, 2],
  },
  {
    id: 'plantilla-adicional',
    nombre: 'Plantilla adicional',
    descripcion: 'Plantillas simultáneas adicionales para cualquier nivel de membresía',
    precio: 15,
    recurrente: true,
    nivelesDisponibles: [0, 1, 2],
  },
];

// Costo mensual total = precio base del plan + add-ons recurrentes contratados (los de cargo
// único, como la consultoría 1 a 1, no suman aquí — ya se cobraron en su propia factura).
export function calcularTotalMensual(plan: Plan, addons: Record<string, number>): number {
  const recurrentes = addOns.reduce((sum, a) => {
    if (!a.recurrente) return sum;
    const cantidad = addons[a.id] ?? 0;
    return sum + cantidad * a.precio;
  }, 0);
  return plan.precio + recurrentes;
}
