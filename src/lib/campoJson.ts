import type {
  Campo,
  CapturaCampo,
  CapturaTabla,
  CabeceraGrupo,
  ColumnaTabla,
  ConfigTabla,
  NivelColumna,
  SubcolumnaTabla,
  SubtipoTabla,
  TipoCampo,
  TipoColumna,
} from '../types';

const TIPOS_CAMPO: readonly TipoCampo[] = [
  'texto_corto',
  'texto_largo',
  'numero',
  'fecha',
  'decimal',
  'booleano',
  'catalogo_simple',
  'catalogo_encadenado',
  'seleccion',
  'tabla',
  'tabla_jerarquica',
  'calculado',
  'imagen',
  'firma',
  'mapa_coordenadas',
  'nota',
] as const;

const SUBTIPOS_TABLA: readonly SubtipoTabla[] = [
  'filas_dinamicas',
  'matriz_por_periodos',
  'jerarquica',
  'jerarquica_dinamica',
] as const;

const TIPOS_COLUMNA: readonly TipoColumna[] = [
  'texto_corto',
  'texto_largo',
  'numero',
  'decimal',
  'fecha',
  'booleano',
  'coordenadas',
  'calculado',
  'catalogo',
  'catalogo_encadenado',
  'auto_numerico',
] as const;

export type CampoJsonValidation =
  | { ok: true; campo: Campo }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, label: string): string | { error: string } {
  if (typeof value !== 'string') return { error: `"${label}" debe ser un string.` };
  return value;
}

function asBoolean(value: unknown, label: string): boolean | { error: string } {
  if (typeof value !== 'boolean') return { error: `"${label}" debe ser un boolean.` };
  return value;
}

function asOptionalNumber(value: unknown, label: string): number | undefined | { error: string } {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return { error: `"${label}" debe ser un número.` };
  }
  return value;
}

function isTipoCampo(value: unknown): value is TipoCampo {
  return typeof value === 'string' && (TIPOS_CAMPO as readonly string[]).includes(value);
}

function isSubtipoTabla(value: unknown): value is SubtipoTabla {
  return typeof value === 'string' && (SUBTIPOS_TABLA as readonly string[]).includes(value);
}

function isTipoColumna(value: unknown): value is TipoColumna {
  return typeof value === 'string' && (TIPOS_COLUMNA as readonly string[]).includes(value);
}

function parseCapturaCampo(raw: unknown): CapturaCampo | { error: string } {
  if (!isRecord(raw)) return { error: '"captura" debe ser un objeto.' };
  const columna = asString(raw.columna, 'captura.columna');
  if (typeof columna !== 'string') return columna;
  if (typeof raw.fila !== 'number' || Number.isNaN(raw.fila)) {
    return { error: '"captura.fila" debe ser un número.' };
  }
  const abarcaColumnas = asOptionalNumber(raw.abarcaColumnas, 'captura.abarcaColumnas');
  if (typeof abarcaColumnas === 'object') return abarcaColumnas;
  const abarcaFilas = asOptionalNumber(raw.abarcaFilas, 'captura.abarcaFilas');
  if (typeof abarcaFilas === 'object') return abarcaFilas;
  return {
    columna,
    fila: raw.fila,
    ...(abarcaColumnas !== undefined ? { abarcaColumnas } : {}),
    ...(abarcaFilas !== undefined ? { abarcaFilas } : {}),
  };
}

function parseSubcolumnas(raw: unknown, path: string): SubcolumnaTabla[] | { error: string } {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return { error: `"${path}" debe ser un array.` };
  const out: SubcolumnaTabla[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isRecord(item)) return { error: `"${path}[${i}]" debe ser un objeto.` };
    const id = asString(item.id, `${path}[${i}].id`);
    if (typeof id !== 'string') return id;
    const nombre = asString(item.nombre, `${path}[${i}].nombre`);
    if (typeof nombre !== 'string') return nombre;
    if (!isTipoColumna(item.tipo)) {
      return { error: `"${path}[${i}].tipo" no es un tipo de columna válido.` };
    }
    const abarcaColumnasExcel = asOptionalNumber(item.abarcaColumnasExcel, `${path}[${i}].abarcaColumnasExcel`);
    if (typeof abarcaColumnasExcel === 'object') return abarcaColumnasExcel;
    out.push({
      id,
      nombre,
      tipo: item.tipo,
      ...(typeof item.columnaExcel === 'string' ? { columnaExcel: item.columnaExcel } : {}),
      ...(abarcaColumnasExcel !== undefined ? { abarcaColumnasExcel } : {}),
    });
  }
  return out;
}

function parseColumna(raw: unknown, path: string): ColumnaTabla | { error: string } {
  if (!isRecord(raw)) return { error: `"${path}" debe ser un objeto.` };
  const id = asString(raw.id, `${path}.id`);
  if (typeof id !== 'string') return id;
  const nombre = asString(raw.nombre, `${path}.nombre`);
  if (typeof nombre !== 'string') return nombre;
  if (!isTipoColumna(raw.tipo)) {
    return { error: `"${path}.tipo" no es un tipo de columna válido.` };
  }
  const ancho = asOptionalNumber(raw.ancho, `${path}.ancho`);
  if (typeof ancho === 'object') return ancho;
  const abarcaColumnasExcel = asOptionalNumber(raw.abarcaColumnasExcel, `${path}.abarcaColumnasExcel`);
  if (typeof abarcaColumnasExcel === 'object') return abarcaColumnasExcel;
  const decimales = asOptionalNumber(raw.decimales, `${path}.decimales`);
  if (typeof decimales === 'object') return decimales;

  let nivel: NivelColumna | undefined;
  if (raw.nivel !== undefined) {
    if (raw.nivel !== 'padre' && raw.nivel !== 'hijo') {
      return { error: `"${path}.nivel" debe ser "padre" o "hijo".` };
    }
    nivel = raw.nivel;
  }

  let opciones: string[] | undefined;
  if (raw.opciones !== undefined) {
    if (!Array.isArray(raw.opciones) || raw.opciones.some((o) => typeof o !== 'string')) {
      return { error: `"${path}.opciones" debe ser un array de strings.` };
    }
    opciones = raw.opciones as string[];
  }

  let etiquetasBooleano: { true: string; false: string } | undefined;
  if (raw.etiquetasBooleano !== undefined) {
    if (!isRecord(raw.etiquetasBooleano)
      || typeof raw.etiquetasBooleano.true !== 'string'
      || typeof raw.etiquetasBooleano.false !== 'string') {
      return { error: `"${path}.etiquetasBooleano" debe ser { true: string, false: string }.` };
    }
    etiquetasBooleano = {
      true: raw.etiquetasBooleano.true,
      false: raw.etiquetasBooleano.false,
    };
  }

  const subcolumnas = parseSubcolumnas(raw.subcolumnas, `${path}.subcolumnas`);
  if (!Array.isArray(subcolumnas)) return subcolumnas;

  return {
    id,
    nombre,
    tipo: raw.tipo,
    ...(nivel ? { nivel } : {}),
    ...(ancho !== undefined ? { ancho } : {}),
    ...(typeof raw.requerido === 'boolean' ? { requerido: raw.requerido } : {}),
    ...(typeof raw.fuenteCatalogo === 'string' ? { fuenteCatalogo: raw.fuenteCatalogo } : {}),
    ...(typeof raw.encadenaA === 'string' ? { encadenaA: raw.encadenaA } : {}),
    ...(typeof raw.formula === 'string' ? { formula: raw.formula } : {}),
    ...(typeof raw.columnaExcel === 'string' ? { columnaExcel: raw.columnaExcel } : {}),
    ...(abarcaColumnasExcel !== undefined ? { abarcaColumnasExcel } : {}),
    ...(opciones ? { opciones } : {}),
    ...(etiquetasBooleano ? { etiquetasBooleano } : {}),
    ...(decimales !== undefined ? { decimales } : {}),
    ...(subcolumnas.length > 0 ? { subcolumnas } : {}),
  };
}

function parseCapturaTabla(raw: unknown): CapturaTabla | { error: string } {
  if (!isRecord(raw)) return { error: '"configTabla.captura" debe ser un objeto.' };
  const filaInicial = asOptionalNumber(raw.filaInicial, 'configTabla.captura.filaInicial');
  if (typeof filaInicial === 'object') return filaInicial;
  const filasBase = asOptionalNumber(raw.filasBase, 'configTabla.captura.filasBase');
  if (typeof filasBase === 'object') return filasBase;
  return {
    ...(typeof raw.columnaInicial === 'string' ? { columnaInicial: raw.columnaInicial } : {}),
    ...(filaInicial !== undefined ? { filaInicial } : {}),
    ...(filasBase !== undefined ? { filasBase } : {}),
  };
}

function parseCabeceras(raw: unknown): CabeceraGrupo[] | { error: string } {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return { error: '"configTabla.cabeceras" debe ser un array.' };
  const out: CabeceraGrupo[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isRecord(item)) return { error: `"configTabla.cabeceras[${i}]" debe ser un objeto.` };
    const titulo = asString(item.titulo, `configTabla.cabeceras[${i}].titulo`);
    if (typeof titulo !== 'string') return titulo;
    if (!Array.isArray(item.hijoIds) || item.hijoIds.some((id) => typeof id !== 'string')) {
      return { error: `"configTabla.cabeceras[${i}].hijoIds" debe ser un array de strings.` };
    }
    out.push({ titulo, hijoIds: item.hijoIds as string[] });
  }
  return out;
}

function parseConfigTabla(raw: unknown): ConfigTabla | { error: string } {
  if (!isRecord(raw)) return { error: '"configTabla" debe ser un objeto.' };
  if (!isSubtipoTabla(raw.subtipo)) {
    return { error: '"configTabla.subtipo" no es un subtipo de tabla válido.' };
  }
  if (!Array.isArray(raw.columnas)) {
    return { error: '"configTabla.columnas" debe ser un array.' };
  }
  const columnas: ColumnaTabla[] = [];
  for (let i = 0; i < raw.columnas.length; i++) {
    const col = parseColumna(raw.columnas[i], `configTabla.columnas[${i}]`);
    if ('error' in col) return col;
    columnas.push(col);
  }

  let periodos: string[] | undefined;
  if (raw.periodos !== undefined) {
    if (!Array.isArray(raw.periodos) || raw.periodos.some((p) => typeof p !== 'string')) {
      return { error: '"configTabla.periodos" debe ser un array de strings.' };
    }
    periodos = raw.periodos as string[];
  }

  const agrupadorAbarcaColumnas = asOptionalNumber(raw.agrupadorAbarcaColumnas, 'configTabla.agrupadorAbarcaColumnas');
  if (typeof agrupadorAbarcaColumnas === 'object') return agrupadorAbarcaColumnas;
  const agrupadorNivel = asOptionalNumber(raw.agrupadorNivel, 'configTabla.agrupadorNivel');
  if (typeof agrupadorNivel === 'object') return agrupadorNivel;
  const abarcaFilas = asOptionalNumber(raw.abarcaFilas, 'configTabla.abarcaFilas');
  if (typeof abarcaFilas === 'object') return abarcaFilas;

  let captura: CapturaTabla | undefined;
  if (raw.captura !== undefined) {
    const parsed = parseCapturaTabla(raw.captura);
    if ('error' in parsed) return parsed;
    captura = parsed;
  }

  const cabeceras = parseCabeceras(raw.cabeceras);
  if (!Array.isArray(cabeceras)) return cabeceras;

  return {
    subtipo: raw.subtipo,
    columnas,
    ...(periodos ? { periodos } : {}),
    ...(typeof raw.agrupador === 'boolean' ? { agrupador: raw.agrupador } : {}),
    ...(agrupadorAbarcaColumnas !== undefined ? { agrupadorAbarcaColumnas } : {}),
    ...(agrupadorNivel !== undefined ? { agrupadorNivel } : {}),
    ...(typeof raw.columnaDinamicaId === 'string' ? { columnaDinamicaId: raw.columnaDinamicaId } : {}),
    ...(cabeceras.length > 0 ? { cabeceras } : {}),
    ...(captura ? { captura } : {}),
    ...(abarcaFilas !== undefined ? { abarcaFilas } : {}),
  };
}

/**
 * Parsea y valida el JSON de un campo del editor (forma interna `Campo`).
 * No acepta el formato exportado del documento (`tipo_nodo`, etc.).
 */
export function parseCampoJson(text: string): CampoJsonValidation {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON inválido: revisa comas, comillas y llaves.' };
  }

  if (!isRecord(raw)) {
    return { ok: false, error: 'El campo debe ser un objeto JSON.' };
  }

  const id = asString(raw.id, 'id');
  if (typeof id !== 'string') return { ok: false, error: id.error };
  if (!id.trim()) return { ok: false, error: '"id" no puede estar vacío.' };

  const identificador = asString(raw.identificador, 'identificador');
  if (typeof identificador !== 'string') return { ok: false, error: identificador.error };

  const etiqueta = asString(raw.etiqueta, 'etiqueta');
  if (typeof etiqueta !== 'string') return { ok: false, error: etiqueta.error };

  if (!isTipoCampo(raw.tipo)) {
    return { ok: false, error: `"tipo" no es un tipo de campo válido.` };
  }

  const editable = asBoolean(raw.editable, 'editable');
  if (typeof editable !== 'boolean') return { ok: false, error: editable.error };

  const campo: Campo = {
    id,
    identificador,
    etiqueta,
    tipo: raw.tipo,
    editable,
  };

  if (raw.requerido !== undefined) {
    const requerido = asBoolean(raw.requerido, 'requerido');
    if (typeof requerido !== 'boolean') return { ok: false, error: requerido.error };
    campo.requerido = requerido;
  }

  if (raw.descripcion !== undefined) {
    const descripcion = asString(raw.descripcion, 'descripcion');
    if (typeof descripcion !== 'string') return { ok: false, error: descripcion.error };
    campo.descripcion = descripcion;
  }

  if (raw.fuenteCatalogo !== undefined) {
    const fuenteCatalogo = asString(raw.fuenteCatalogo, 'fuenteCatalogo');
    if (typeof fuenteCatalogo !== 'string') return { ok: false, error: fuenteCatalogo.error };
    campo.fuenteCatalogo = fuenteCatalogo;
  }

  if (raw.cadena !== undefined) {
    if (!Array.isArray(raw.cadena) || raw.cadena.some((c) => typeof c !== 'string')) {
      return { ok: false, error: '"cadena" debe ser un array de strings.' };
    }
    campo.cadena = raw.cadena as string[];
  }

  if (raw.valorEjemplo !== undefined) {
    const valorEjemplo = asString(raw.valorEjemplo, 'valorEjemplo');
    if (typeof valorEjemplo !== 'string') return { ok: false, error: valorEjemplo.error };
    campo.valorEjemplo = valorEjemplo;
  }

  if (raw.configTabla !== undefined) {
    const configTabla = parseConfigTabla(raw.configTabla);
    if ('error' in configTabla) return { ok: false, error: configTabla.error };
    campo.configTabla = configTabla;
  }

  if (raw.config !== undefined) {
    if (!isRecord(raw.config)) return { ok: false, error: '"config" debe ser un objeto.' };
    campo.config = raw.config;
  }

  if (raw.captura !== undefined) {
    const captura = parseCapturaCampo(raw.captura);
    if ('error' in captura) return { ok: false, error: captura.error };
    campo.captura = captura;
  }

  if (raw.opciones !== undefined) {
    if (!Array.isArray(raw.opciones) || raw.opciones.some((o) => typeof o !== 'string')) {
      return { ok: false, error: '"opciones" debe ser un array de strings.' };
    }
    campo.opciones = raw.opciones as string[];
  }

  if (raw.etiquetasBooleano !== undefined) {
    if (!isRecord(raw.etiquetasBooleano)
      || typeof raw.etiquetasBooleano.true !== 'string'
      || typeof raw.etiquetasBooleano.false !== 'string') {
      return { ok: false, error: '"etiquetasBooleano" debe ser { true: string, false: string }.' };
    }
    campo.etiquetasBooleano = {
      true: raw.etiquetasBooleano.true,
      false: raw.etiquetasBooleano.false,
    };
  }

  if (raw.decimales !== undefined) {
    const decimales = asOptionalNumber(raw.decimales, 'decimales');
    if (typeof decimales === 'object') return { ok: false, error: decimales.error };
    if (decimales !== undefined) campo.decimales = decimales;
  }

  const esTabla = campo.tipo === 'tabla' || campo.tipo === 'tabla_jerarquica';
  if (esTabla && !campo.configTabla) {
    return { ok: false, error: 'Un campo tabla requiere "configTabla".' };
  }
  if (!esTabla && campo.configTabla) {
    return { ok: false, error: '"configTabla" solo aplica a campos tipo tabla.' };
  }
  if (campo.tipo === 'nota' && campo.identificador.trim() !== '') {
    // Las notas pueden tener identificador vacío en el modelo; no bloqueamos si trae uno.
  }

  return { ok: true, campo };
}

export function stringifyCampoJson(campo: Campo): string {
  return JSON.stringify(campo, null, 2);
}
