import { parseDynamicRows, parseGroupedRows, parseTree, getPeriodos, esJerarquica, esCeldaPartida, columnaParaProfundidad, type FilaDinamica, type TreeNode, type ValorCelda } from './tableRowHelpers';
import type { Campo, ColumnaTabla, ConfigTabla, Ejemplo, Plantilla, Seccion, TipoCampo, TipoColumna } from '@/types';

export type TipoVersionDocumento = 'estructura' | 'ejemplo';

// Id reservado que usa el esquema oficial para la columna que se repite por período
const ID_COLUMNA_DINAMICA = 'columnas_dinamicas';

// --- Mapeo de tipos internos -> tipos documentados en el esquema oficial ---

const tipoCampoMap: Partial<Record<TipoCampo, string>> = {
  texto_corto: 'texto_corto',
  texto_largo: 'texto_largo',
  numero: 'numero',
  decimal: 'decimal',
  fecha: 'fecha',
  booleano: 'booleano',
  mapa_coordenadas: 'coordenadas',
  calculado: 'calculado',
  imagen: 'imagen',
  firma: 'firma',
};

function mapTipoCampo(tipo: TipoCampo): string {
  return tipoCampoMap[tipo] ?? 'texto_corto';
}

const tipoColumnaMap: Partial<Record<TipoColumna, string>> = {
  texto_corto: 'texto_corto',
  texto_largo: 'texto_largo',
  numero: 'numero',
  decimal: 'decimal',
  fecha: 'fecha',
  booleano: 'booleano',
  coordenadas: 'coordenadas',
  calculado: 'calculado',
  auto_numerico: 'numero',
  // catalogo/catalogo_encadenado: sin equivalente documentado todavía — caen a texto_corto
};

function mapTipoColumna(tipo: TipoColumna): string {
  return tipoColumnaMap[tipo] ?? 'texto_corto';
}

// "Sin dato" se escribe SIEMPRE como cadena vacía, nunca como null — es la forma que usan los
// documentos de entrada y la que espera el importador, así que exportar null rompería el ciclo.
// Aplica también al booleano: un campo sin responder NO es `false`. Emitir `false` inventaría un
// "No" que nadie eligió, y es además lo que ya hace el escritor de Excel (ver su propio
// coerceValor, que corta en vacío antes de traducir el booleano a las etiquetas de la plantilla).
function coerceValor(tipo: TipoCampo, raw: string | undefined): unknown {
  if (raw == null || raw === '') return '';
  switch (tipo) {
    case 'numero':
    case 'decimal': {
      const n = Number(raw);
      return Number.isNaN(n) ? raw : n; // texto no numérico se conserva tal cual, no se descarta
    }
    case 'booleano':
      return raw === 'true';
    case 'mapa_coordenadas':
      try { return JSON.parse(raw); } catch { return raw; }
    default:
      return raw;
  }
}

// --- Captura ---

// `hoja` NO se escribe acá, por la misma razón que en capturaTabla: la convención la declara
// únicamente en el nodo `seccion` y todo lo que cuelga de ella la hereda.
function capturaCampo(campo: Campo) {
  return {
    columna: campo.captura?.columna ?? '',
    fila: campo.captura?.fila ?? 0,
    abarca_columnas: campo.captura?.abarcaColumnas ?? 1,
    abarca_filas: campo.captura?.abarcaFilas ?? 1,
  };
}

function idColumna(col: ColumnaTabla, config: ConfigTabla): string {
  return col.id === config.columnaDinamicaId ? ID_COLUMNA_DINAMICA : col.id;
}

// `hoja` NO se escribe acá: la convención declara la hoja únicamente en el nodo `seccion` y todo
// lo que cuelga de ella la hereda (ver punto 1 de la documentación). Repetirla dentro de `captura`
// abría la puerta a que ambas se desincronizaran.
function capturaTabla(_seccion: Seccion, config: ConfigTabla) {
  const periodos = getPeriodos(config);
  return {
    // `columna_inicial` solo aplica a tablas con agrupador (marca dónde arranca la fila de título);
    // emitirla vacía en el resto era ruido que ensuciaba cualquier diff del documento.
    ...(config.captura?.columnaInicial ? { columna_inicial: config.captura.columnaInicial } : {}),
    fila_inicial: config.captura?.filaInicial ?? 0,
    filas_base: config.captura?.filasBase ?? 0,
    columnas: config.columnas.map((col) => ({
      id: idColumna(col, config),
      columna: col.columnaExcel ?? '',
      abarca_columnas: col.abarcaColumnasExcel ?? 1,
      ...(col.id === config.columnaDinamicaId ? { columnas_base: periodos } : {}),
      ...(col.subcolumnas?.length
        ? {
            subcolumnas: col.subcolumnas.map((s) => ({
              id: s.id,
              columna: s.columnaExcel ?? '',
              abarca_columnas: s.abarcaColumnasExcel ?? 1,
            })),
          }
        : {}),
    })),
  };
}

// --- Columnas / niveles lógicos ---

function columnasLogicas(config: ConfigTabla) {
  return config.columnas.map((col) => {
    // `etiquetas` vuelve en la misma forma en que se leyó (ver parseEtiquetas): objeto {true,false}
    // para un booleano, array para la lista de opciones.
    const etiquetas = col.etiquetasBooleano ?? (col.opciones?.length ? col.opciones : undefined);
    return {
      id: idColumna(col, config),
      nombre: col.nombre,
      tipo: mapTipoColumna(col.tipo),
      ...(esJerarquica(config.subtipo) && col.nivel === 'padre' ? { combina_vertical: true } : {}),
      ...(etiquetas ? { etiquetas } : {}),
      ...(col.formula ? { formula: col.formula } : {}),
      ...(col.decimales != null ? { decimales: col.decimales } : {}),
      ...(col.subcolumnas?.length
        ? { subcolumnas: col.subcolumnas.map((s) => ({ id: s.id, nombre: s.nombre, tipo: mapTipoColumna(s.tipo) })) }
        : {}),
    };
  });
}

// --- Valor de tabla ---

// Una celda partida (4.8) se exporta como objeto {subId: valor} y una fusionada como valor plano —
// esa diferencia de forma ES la señal que distingue ambos casos en el documento (ver punto 4.8).
function coerceCelda(config: ConfigTabla, col: ColumnaTabla, raw: ValorCelda | undefined): unknown {
  if (col.id === config.columnaDinamicaId) {
    return Array.isArray(raw) ? raw : [];
  }
  if (col.subcolumnas?.length && esCeldaPartida(raw)) {
    const out: Record<string, string> = {};
    for (const sub of col.subcolumnas) out[sub.id] = raw[sub.id] ?? '';
    return out;
  }
  if (typeof raw !== 'string') return '';
  // El modelo interno guarda TODA celda como string; el documento distingue tipos, así que una
  // columna numérica vuelve como número (igual que coerceValor hace con los campos sueltos).
  if ((col.tipo === 'numero' || col.tipo === 'decimal' || col.tipo === 'auto_numerico') && raw !== '') {
    const n = Number(raw);
    if (!Number.isNaN(n)) return n;
  }
  if (col.tipo === 'booleano' && (raw === 'true' || raw === 'false')) return raw === 'true';
  return raw;
}

function mapFila(config: ConfigTabla, fila: FilaDinamica): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of config.columnas) {
    out[idColumna(col, config)] = coerceCelda(config, col, fila[col.id]);
  }
  return out;
}

function mapTreeNode(node: TreeNode, depth: number, config: ConfigTabla): Record<string, unknown> {
  const col = config.columnas[columnaParaProfundidad(config, depth)];
  const key = col ? idColumna(col, config) : `nivel_${depth}`;
  const out: Record<string, unknown> = { [key]: node.value };
  // Fila de título de grupo (4.5c) con valores propios en las columnas libres a su derecha: se
  // emiten como claves hermanas del título, igual que las de una fila normal.
  for (const [colId, valor] of Object.entries(node.valores ?? {})) {
    if (colId === key || valor === '' || valor == null) continue;
    const colValor = config.columnas.find((c) => c.id === colId);
    out[colValor ? idColumna(colValor, config) : colId] = colValor ? coerceCelda(config, colValor, valor) : valor;
  }
  if (node.children.length > 0) {
    out.hijos = node.children.map((child) => mapTreeNode(child, depth + 1, config));
  }
  return out;
}

function valorTabla(config: ConfigTabla, raw: string | undefined): unknown {
  const value = raw ?? '';
  if (esJerarquica(config.subtipo)) {
    const roots = parseTree(value, config.columnas, config);
    return roots.map((r) => mapTreeNode(r, 0, config));
  }
  if (config.agrupador) {
    const grupos = parseGroupedRows(value, config);
    return grupos.map((g) => ({
      agrupador: {
        inicia: config.columnas[0] ? idColumna(config.columnas[0], config) : '',
        abarca_columnas: config.columnas[0]?.abarcaColumnasExcel ?? 1,
        nombre: g.grupo,
        valores: g.valoresGrupo ? mapFila(config, g.valoresGrupo) : {},
      },
      valores: g.filas.map((f) => mapFila(config, f)),
    }));
  }
  const filas = parseDynamicRows(value, config);
  return filas.map((f) => mapFila(config, f));
}

// --- Campo ---

function buildCampo(seccion: Seccion, campo: Campo, valorRaw: string | undefined): Record<string, unknown> {
  // Nota (4.11): sin id, sin captura, sin nada más — es texto fijo que el admin deja entre los
  // campos, no un dato de la ficha. Su contenido siempre sale de `valorEjemplo` (autorado una sola
  // vez en Estructura), nunca de `valorRaw`/`ejemplo.valores` — ver Notion 4.11.
  if (campo.tipo === 'nota') return { tipo_nodo: 'nota', nota: campo.valorEjemplo ?? '' };

  const esTabla = campo.tipo === 'tabla' || campo.tipo === 'tabla_jerarquica';

  if (esTabla) {
    const config = campo.configTabla ?? { subtipo: 'filas_dinamicas', columnas: [] };
    return {
      id: campo.identificador,
      nombre: campo.etiqueta,
      tipo_nodo: 'campo',
      tipo: 'tabla',
      editable: campo.editable,
      config: {
        filas: esJerarquica(config.subtipo) ? 'jerarquicas' : 'planas',
        columnas: config.columnaDinamicaId ? 'dinamicas' : 'fijas',
        agrupador: Boolean(config.agrupador),
        abarca_filas: config.abarcaFilas ?? 1,
        ...(config.agrupadorAbarcaColumnas != null ? { agrupador_abarca_columnas: config.agrupadorAbarcaColumnas } : {}),
        ...(config.agrupadorNivel != null ? { agrupador_nivel: config.agrupadorNivel } : {}),
      },
      captura: capturaTabla(seccion, config),
      cabecera: (config.cabeceras ?? []).map((g) => ({ titulo: g.titulo, hijos: g.hijoIds })),
      [esJerarquica(config.subtipo) ? 'niveles' : 'columnas']: columnasLogicas(config),
      valor: valorTabla(config, valorRaw),
    };
  }

  // `etiquetas` vuelve al documento en la misma forma en que se leyó (ver parseEtiquetas en
  // schemaImport.ts): array para la lista de opciones, objeto {true,false} para un booleano.
  const etiquetas = campo.etiquetasBooleano ?? (campo.opciones?.length ? campo.opciones : undefined);

  return {
    id: campo.identificador,
    nombre: campo.etiqueta,
    tipo_nodo: 'campo',
    tipo: mapTipoCampo(campo.tipo),
    editable: campo.editable,
    ...(etiquetas ? { etiquetas } : {}),
    ...(campo.decimales != null ? { decimales: campo.decimales } : {}),
    captura: capturaCampo(campo),
    valor: coerceValor(campo.tipo, valorRaw),
  };
}

// --- Sección / grupo ---

function buildSeccion(seccion: Seccion, ejemplo?: Ejemplo): Record<string, unknown> {
  return {
    id: seccion.numero,
    nombre: seccion.nombre,
    tipo_nodo: 'seccion',
    hoja: seccion.hoja ?? '',
    campos: seccion.subsecciones.map((sub) => ({
      id: sub.codigo,
      nombre: sub.nombre,
      tipo_nodo: 'grupo',
      campos: sub.campos.map((campo) => {
        const valorRaw = ejemplo ? ejemplo.valores[campo.identificador] : campo.valorEjemplo;
        return buildCampo(seccion, campo, valorRaw);
      }),
    })),
  };
}

// --- Documento completo ---

export interface DocumentoJSON {
  schema_version: string;
  formato: {
    codigo: string;
    nombre: string;
    tipo_version: TipoVersionDocumento;
  };
  secciones: Record<string, unknown>[];
}

export function buildDocumento(plantilla: Plantilla, tipoVersion: TipoVersionDocumento, ejemplo?: Ejemplo): DocumentoJSON {
  return {
    schema_version: '1.0',
    formato: {
      codigo: plantilla.codigo,
      nombre: plantilla.nombre,
      tipo_version: tipoVersion,
    },
    secciones: plantilla.secciones.map((seccion) => buildSeccion(seccion, tipoVersion === 'ejemplo' ? ejemplo : undefined)),
  };
}
