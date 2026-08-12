import type {
  Campo,
  CampoResultadoLlenadoIA,
  CategoriaResultadoCampoIA,
  EstadoCampoIA,
  Plantilla,
  ResultadoLlenadoIA,
  ResumenResultadoLlenadoIA,
  TipoCampo,
} from '@/types';

/** Mismos tipos que excluye el backend en LlenadoIAController. */
const TIPOS_EXCLUIDOS: TipoCampo[] = [
  'calculado', 'tabla', 'tabla_jerarquica', 'imagen', 'firma', 'mapa_coordenadas', 'nota',
];

interface CampoIndexado {
  campo: Campo;
  seccionId: string;
}

function camposLlenablesDe(plantilla: Plantilla): CampoIndexado[] {
  const out: CampoIndexado[] = [];
  for (const seccion of plantilla.secciones) {
    for (const sub of seccion.subsecciones) {
      for (const campo of sub.campos) {
        if (!campo.identificador) continue;
        if (TIPOS_EXCLUIDOS.includes(campo.tipo)) continue;
        if (campo.editable === false) continue;
        out.push({ campo, seccionId: seccion.id });
      }
    }
  }
  return out;
}

/** Etiquetas de campos con valor propuesto, agrupadas por id de sección (para el modal de progreso). */
export function nombresCamposLlenadosPorSeccion(
  plantilla: Plantilla,
  valores: Record<string, string>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const seccion of plantilla.secciones) {
    out[seccion.id] = [];
  }
  for (const { campo, seccionId } of camposLlenablesDe(plantilla)) {
    const crudo = valores[campo.identificador];
    const valor = typeof crudo === 'string' ? crudo.trim() : crudo != null ? String(crudo).trim() : '';
    if (valor === '') continue;
    if (!out[seccionId]) out[seccionId] = [];
    out[seccionId].push(campo.etiqueta || campo.identificador);
  }
  return out;
}

function truncar(valor: string, max = 80): string {
  const t = valor.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Puente temporal categoría de informe → estado del editor (hasta que el backend envíe `estado`). */
export function estadoDesdeCategoria(categoria: CategoriaResultadoCampoIA): EstadoCampoIA {
  switch (categoria) {
    case 'alta_confianza':
      return 'extraido';
    case 'revision':
      return 'requiere_confirmacion';
    case 'ya_existian':
      return 'extraido';
    case 'sin_informacion':
      return 'no_encontrado';
  }
}

export function mapaEstadosDesdeResumen(
  resumen: ResumenResultadoLlenadoIA,
): Record<string, EstadoCampoIA> {
  const out: Record<string, EstadoCampoIA> = {};
  for (const c of resumen.campos) {
    out[c.id] = c.estado;
  }
  return out;
}

/**
 * Arma el resumen del informe de resultados a partir de la respuesta actual del backend
 * (mapa plano de valores) y el catálogo de campos de la plantilla.
 *
 * Cuando el backend empiece a devolver confianza/estado por campo, este mapper
 * podrá clasificar en alta_confianza / revision / ya_existian con umbrales reales.
 * Hoy: todo valor propuesto va a alta_confianza; el resto a sin_informacion.
 */
export function construirResumenResultadoLlenado(
  plantilla: Plantilla,
  resultado: ResultadoLlenadoIA,
  documentosAnalizados: number,
  seccionIds?: string[] | null,
): ResumenResultadoLlenadoIA {
  const valores = resultado.valores ?? {};
  const campos: CampoResultadoLlenadoIA[] = [];
  const filtro = seccionIds && seccionIds.length > 0 ? new Set(seccionIds) : null;

  for (const { campo, seccionId } of camposLlenablesDe(plantilla)) {
    if (filtro && !filtro.has(seccionId)) continue;
    const crudo = valores[campo.identificador];
    const valor = typeof crudo === 'string' ? crudo.trim() : crudo != null ? String(crudo).trim() : '';
    if (valor !== '') {
      const categoria = 'alta_confianza' as const;
      campos.push({
        id: campo.identificador,
        etiqueta: campo.etiqueta,
        seccionId,
        tipo: campo.tipo,
        valorPropuesto: truncar(valor),
        confianza: null,
        categoria,
        estado: estadoDesdeCategoria(categoria),
      });
    } else {
      const categoria = 'sin_informacion' as const;
      campos.push({
        id: campo.identificador,
        etiqueta: campo.etiqueta,
        seccionId,
        tipo: campo.tipo,
        valorPropuesto: null,
        confianza: null,
        categoria,
        estado: estadoDesdeCategoria(categoria),
        motivo: 'No se encontró información en los documentos',
      });
    }
  }

  const altaConfianza = campos.filter((c) => c.categoria === 'alta_confianza').length;
  const requierenRevision = campos.filter((c) => c.categoria === 'revision').length;
  const yaExistian = campos.filter((c) => c.categoria === 'ya_existian').length;
  const sinInformacion = campos.filter((c) => c.categoria === 'sin_informacion').length;

  return {
    documentosAnalizados,
    camposCompletados: altaConfianza + requierenRevision,
    altaConfianza,
    requierenRevision,
    yaExistian,
    sinInformacion,
    campos,
  };
}

export function formatoConfianza(confianza: number | null): string {
  if (confianza == null) return '—';
  return `${Math.round(confianza * 100)}%`;
}

export function etiquetaTipoCorta(tipo: TipoCampo): string {
  const map: Partial<Record<TipoCampo, string>> = {
    texto_corto: 'Texto',
    texto_largo: 'Texto',
    numero: 'Número',
    decimal: 'Decimal',
    fecha: 'Fecha',
    booleano: 'Booleano',
    catalogo_simple: 'Catálogo',
    catalogo_encadenado: 'Catálogo',
    seleccion: 'Selección',
    calculado: 'Calculado',
  };
  return map[tipo] ?? 'Campo';
}
