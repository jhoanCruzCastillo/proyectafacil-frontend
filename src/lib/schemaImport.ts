import { generateId } from '@/api/mock/_shared';
import { columnaParaProfundidad } from './tableRowHelpers';
import type { FilaDinamica, GrupoFilas, TreeNode } from './tableRowHelpers';
import type { CabeceraGrupo, Campo, CapturaCampo, ColumnaTabla, ConfigTabla, Seccion, Subseccion, SubcolumnaTabla, SubtipoTabla, TipoCampo, TipoColumna } from '../types';

const ID_COLUMNA_DINAMICA = 'columnas_dinamicas';

// --- Mapeo de tipos documentados en el esquema oficial -> tipos internos ---

const tipoCampoReverseMap: Record<string, TipoCampo> = {
  texto_corto: 'texto_corto',
  texto_largo: 'texto_largo',
  numero: 'numero',
  decimal: 'decimal',
  fecha: 'fecha',
  booleano: 'booleano',
  coordenadas: 'mapa_coordenadas',
  calculado: 'calculado',
  tabla: 'tabla',
  imagen: 'imagen',
  firma: 'firma',
};

function mapTipoCampoReverse(tipo: unknown): TipoCampo {
  return tipoCampoReverseMap[String(tipo)] ?? 'texto_corto';
}

const tipoColumnaReverseMap: Record<string, TipoColumna> = {
  texto_corto: 'texto_corto',
  texto_largo: 'texto_largo',
  numero: 'numero',
  decimal: 'decimal',
  fecha: 'fecha',
  booleano: 'booleano',
  coordenadas: 'coordenadas',
  calculado: 'calculado',
};

function mapTipoColumnaReverse(tipo: unknown): TipoColumna {
  return tipoColumnaReverseMap[String(tipo)] ?? 'texto_corto';
}

function valorToString(tipo: TipoCampo, valor: unknown): string {
  if (valor == null || valor === '') return '';
  if (tipo === 'mapa_coordenadas') return typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  // Un booleano solo se normaliza si el JSON trae un booleano de verdad; un texto ("Sí") se
  // conserva, que es como se guardan ahora estos valores.
  if (tipo === 'booleano' && typeof valor === 'boolean') return String(valor);
  return String(valor);
}

function parseCapturaCampo(raw: unknown): CapturaCampo | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (!r.columna && !r.fila) return undefined;
  return {
    columna: typeof r.columna === 'string' ? r.columna : '',
    fila: typeof r.fila === 'number' ? r.fila : 0,
    abarcaColumnas: typeof r.abarca_columnas === 'number' ? r.abarca_columnas : undefined,
    abarcaFilas: typeof r.abarca_filas === 'number' ? r.abarca_filas : undefined,
  };
}

// --- Columnas de tabla ---

function subcolumnasFromDoc(rawSubs: unknown, rawCapturaSubs: unknown): SubcolumnaTabla[] | undefined {
  if (!Array.isArray(rawSubs) || rawSubs.length === 0) return undefined;
  const capturaSubs = Array.isArray(rawCapturaSubs) ? rawCapturaSubs : [];

  const subs = rawSubs.map((rs) => {
    const raw = rs as Record<string, unknown>;
    const id = String(raw.id ?? '');
    const capturaSub = capturaSubs.find((c) => (c as Record<string, unknown>).id === id) as Record<string, unknown> | undefined;
    return {
      id: id || generateId(),
      nombre: String(raw.nombre ?? ''),
      tipo: mapTipoColumnaReverse(raw.tipo),
      columnaExcel: typeof capturaSub?.columna === 'string' && capturaSub.columna ? capturaSub.columna : undefined,
      abarcaColumnasExcel: typeof capturaSub?.abarca_columnas === 'number' ? capturaSub.abarca_columnas : undefined,
    } satisfies SubcolumnaTabla;
  });

  // Una sola parte no es una partición — se ignora y la columna queda como celda única.
  return subs.length > 1 ? subs : undefined;
}

function buildColumnas(rawCols: unknown, rawCapturaCols: unknown, esJerarquica: boolean): { columnas: ColumnaTabla[]; columnaDinamicaId?: string } {
  const cols = Array.isArray(rawCols) ? rawCols : [];
  const capturaCols = Array.isArray(rawCapturaCols) ? rawCapturaCols : [];
  let columnaDinamicaId: string | undefined;

  const columnas: ColumnaTabla[] = cols.map((rc) => {
    const raw = rc as Record<string, unknown>;
    const rawId = String(raw.id ?? '');
    const esDinamica = rawId === ID_COLUMNA_DINAMICA;
    const internalId = esDinamica ? generateId() : rawId || generateId();
    if (esDinamica) columnaDinamicaId = internalId;
    const capturaCol = capturaCols.find((c) => (c as Record<string, unknown>).id === rawId) as Record<string, unknown> | undefined;
    const col: ColumnaTabla = {
      id: internalId,
      nombre: String(raw.nombre ?? ''),
      tipo: mapTipoColumnaReverse(raw.tipo),
      columnaExcel: typeof capturaCol?.columna === 'string' && capturaCol.columna ? capturaCol.columna : undefined,
      abarcaColumnasExcel: typeof capturaCol?.abarca_columnas === 'number' ? capturaCol.abarca_columnas : undefined,
    };
    if (esJerarquica) col.nivel = raw.combina_vertical ? 'padre' : 'hijo';
    if (Array.isArray(raw.opciones) && raw.opciones.length > 0) col.opciones = raw.opciones.map(String);
    if (typeof raw.formula === 'string' && raw.formula) col.formula = raw.formula;
    if (typeof raw.decimales === 'number') col.decimales = raw.decimales;

    // `etiquetas` a nivel de columna/nivel: mismo desdoblamiento que en los campos sueltos — array
    // = lista fija de opciones, objeto {true,false} = cómo se escribe un booleano en el Excel.
    const et = parseEtiquetas(raw.etiquetas);
    if (et.opciones) col.opciones = et.opciones;
    if (et.etiquetasBooleano) col.etiquetasBooleano = et.etiquetasBooleano;

    // Celdas partidas (convención 4.8): la definición lógica vive en `columnas[].subcolumnas` y la
    // posición física en `captura.columnas[].subcolumnas` — se cruzan por id, igual que las columnas.
    const subs = subcolumnasFromDoc(raw.subcolumnas, capturaCol?.subcolumnas);
    if (subs) col.subcolumnas = subs;
    return col;
  });

  return { columnas, columnaDinamicaId };
}

function cabecerasFromDoc(rawCabecera: unknown, columnaDinamicaId?: string): CabeceraGrupo[] | undefined {
  if (!Array.isArray(rawCabecera) || rawCabecera.length === 0) return undefined;
  const grupos = rawCabecera
    .map((g) => {
      const raw = g as Record<string, unknown>;
      const hijosRaw = Array.isArray(raw.hijos) ? raw.hijos : [];
      const hijoIds = hijosRaw
        .map((h) => (h === ID_COLUMNA_DINAMICA ? columnaDinamicaId : String(h)))
        .filter((h): h is string => Boolean(h));
      return { titulo: typeof raw.titulo === 'string' ? raw.titulo : '', hijoIds };
    })
    .filter((g) => g.hijoIds.length > 0);
  return grupos.length > 0 ? grupos : undefined;
}

function periodosDesdeColumnasBase(rawCapturaCols: unknown): string[] | undefined {
  const capturaCols = Array.isArray(rawCapturaCols) ? rawCapturaCols : [];
  const dinCol = capturaCols.find((c) => (c as Record<string, unknown>).id === ID_COLUMNA_DINAMICA) as Record<string, unknown> | undefined;
  const base = dinCol?.columnas_base;
  if (!Array.isArray(base) || base.length === 0) return undefined;
  return base.map((p) => String(p));
}

// --- Valor de tabla ---

function rowFromDoc(rawRow: Record<string, unknown>, columnaDinamicaId?: string): FilaDinamica {
  const fila: FilaDinamica = {};
  for (const [key, val] of Object.entries(rawRow)) {
    if (key === ID_COLUMNA_DINAMICA && columnaDinamicaId) {
      fila[columnaDinamicaId] = Array.isArray(val) ? val.map((v) => String(v)) : [];
    } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      // Celda partida (4.8): objeto {subId: valor}. Se conserva como objeto — aplanarlo con
      // String() lo convertiría en "[object Object]" y perdería ambas partes.
      const partes: Record<string, string> = {};
      for (const [subId, subVal] of Object.entries(val as Record<string, unknown>)) {
        partes[subId] = subVal == null ? '' : String(subVal);
      }
      fila[key] = partes;
    } else {
      fila[key] = val == null ? '' : String(val);
    }
  }
  return fila;
}

function gruposFromDoc(rawGrupos: unknown[], columnaDinamicaId?: string): GrupoFilas[] {
  return rawGrupos.map((g) => {
    const raw = g as Record<string, unknown>;
    const agrupador = raw.agrupador as Record<string, unknown> | undefined;
    const valores = Array.isArray(raw.valores) ? raw.valores : [];
    const valoresGrupoRaw = agrupador?.valores as Record<string, unknown> | undefined;
    // Un objeto de celdas todas vacías NO son "valores propios del grupo": es el molde de la
    // estructura. Distinguirlo importa porque un bloque sin título ni valores propios no ocupa
    // ninguna fila del Excel (ver writeCampoTabla).
    const tieneValoresPropios = valoresGrupoRaw
      && Object.values(valoresGrupoRaw).some((v) => v !== '' && v != null && !(Array.isArray(v) && v.every((x) => x === '')));
    return {
      grupo: typeof agrupador?.nombre === 'string' ? agrupador.nombre : '',
      filas: valores.map((r) => rowFromDoc(r as Record<string, unknown>, columnaDinamicaId)),
      valoresGrupo: tieneValoresPropios ? rowFromDoc(valoresGrupoRaw, columnaDinamicaId) : undefined,
    };
  });
}

function nodeFromDoc(rawNode: unknown, depth: number, config: ConfigTabla): TreeNode {
  const raw = rawNode as Record<string, unknown>;
  const col = config.columnas[columnaParaProfundidad(config, depth)];
  const esDinamico = Boolean(col && col.id === config.columnaDinamicaId);
  const rawKey = esDinamico ? ID_COLUMNA_DINAMICA : col?.id;
  const rawValue = rawKey ? raw[rawKey] : undefined;
  const hijos = Array.isArray(raw.hijos) ? raw.hijos.map((h) => nodeFromDoc(h, depth + 1, config)) : [];
  const value: string | string[] = esDinamico
    ? (Array.isArray(rawValue) ? rawValue.map((v) => String(v)) : [])
    : (rawValue == null ? '' : String(rawValue));

  // Claves hermanas que corresponden a OTRAS columnas: son los valores propios de una fila de título
  // de grupo (4.5c) en las columnas libres a su derecha. Cualquier otra clave (`hijos`, o basura) se
  // ignora.
  const valores: FilaDinamica = {};
  for (const otra of config.columnas) {
    if (otra.id === col?.id) continue;
    const clave = otra.id === config.columnaDinamicaId ? ID_COLUMNA_DINAMICA : otra.id;
    const bruto = raw[clave];
    if (bruto == null) continue;
    valores[otra.id] = Array.isArray(bruto) ? bruto.map((v) => String(v)) : String(bruto);
  }

  return { value, children: hijos, ...(Object.keys(valores).length > 0 ? { valores } : {}) };
}

function valorEjemploTabla(config: ConfigTabla, rawValor: unknown): string {
  const items = Array.isArray(rawValor) ? rawValor : [];
  if (config.subtipo === 'jerarquica' || config.subtipo === 'jerarquica_dinamica') {
    return JSON.stringify(items.map((r) => nodeFromDoc(r, 0, config)));
  }
  if (config.agrupador) {
    return JSON.stringify(gruposFromDoc(items, config.columnaDinamicaId));
  }
  return JSON.stringify(items.map((r) => rowFromDoc(r as Record<string, unknown>, config.columnaDinamicaId)));
}

// --- Campo ---

function campoFromDoc(rawCampo: unknown): Campo {
  const raw = rawCampo as Record<string, unknown>;
  const tipo = mapTipoCampoReverse(raw.tipo);
  const esTabla = tipo === 'tabla';

  const campo: Campo = {
    id: generateId(),
    identificador: String(raw.id ?? ''),
    etiqueta: String(raw.nombre ?? ''),
    tipo,
    editable: Boolean(raw.editable),
  };

  if (esTabla) {
    const rawConfig = (raw.config as Record<string, unknown>) ?? {};
    const filasJerarquicas = rawConfig.filas === 'jerarquicas';
    const columnasDinamicas = rawConfig.columnas === 'dinamicas';
    const subtipo: SubtipoTabla = filasJerarquicas
      ? (columnasDinamicas ? 'jerarquica_dinamica' : 'jerarquica')
      : (columnasDinamicas ? 'matriz_por_periodos' : 'filas_dinamicas');
    const esJerarquica = filasJerarquicas;
    const rawCaptura = (raw.captura as Record<string, unknown>) ?? {};
    const rawCols = raw[esJerarquica ? 'niveles' : 'columnas'];
    const { columnas, columnaDinamicaId } = buildColumnas(rawCols, rawCaptura.columnas, esJerarquica);
    const periodos = periodosDesdeColumnasBase(rawCaptura.columnas);

    const config: ConfigTabla = {
      subtipo,
      columnas,
      agrupador: Boolean(rawConfig.agrupador),
      agrupadorAbarcaColumnas: typeof rawConfig.agrupador_abarca_columnas === 'number' ? rawConfig.agrupador_abarca_columnas : undefined,
      agrupadorNivel: typeof rawConfig.agrupador_nivel === 'number' ? rawConfig.agrupador_nivel : undefined,
      columnaDinamicaId,
      periodos,
      cabeceras: cabecerasFromDoc(raw.cabecera, columnaDinamicaId),
      captura: {
        columnaInicial: typeof rawCaptura.columna_inicial === 'string' && rawCaptura.columna_inicial ? rawCaptura.columna_inicial : undefined,
        filaInicial: typeof rawCaptura.fila_inicial === 'number' ? rawCaptura.fila_inicial : undefined,
        filasBase: typeof rawCaptura.filas_base === 'number' ? rawCaptura.filas_base : undefined,
      },
    };

    campo.configTabla = config;
    campo.valorEjemplo = valorEjemploTabla(config, raw.valor);
    return campo;
  }

  campo.captura = parseCapturaCampo(raw.captura);
  campo.valorEjemplo = valorToString(tipo, raw.valor);

  // `etiquetas` cubre dos casos según el tipo del campo, por eso se desdobla en dos propiedades:
  // un array es la lista fija de opciones de un campo de texto; un objeto {true,false} es cómo
  // se escriben Sí/No en el Excel de un campo booleano.
  const { opciones, etiquetasBooleano } = parseEtiquetas(raw.etiquetas);
  if (opciones) campo.opciones = opciones;
  if (etiquetasBooleano) campo.etiquetasBooleano = etiquetasBooleano;
  if (typeof raw.decimales === 'number') campo.decimales = raw.decimales;

  return campo;
}

function parseEtiquetas(raw: unknown): { opciones?: string[]; etiquetasBooleano?: { true: string; false: string } } {
  if (Array.isArray(raw)) {
    const opciones = raw.map(String).filter((o) => o !== '');
    return opciones.length > 0 ? { opciones } : {};
  }
  if (typeof raw === 'object' && raw !== null) {
    const r = raw as Record<string, unknown>;
    if (typeof r.true === 'string' && typeof r.false === 'string') {
      return { etiquetasBooleano: { true: r.true, false: r.false } };
    }
  }
  return {};
}

// --- Sección / grupo ---

function seccionFromDoc(rawSeccion: unknown, index: number): Seccion {
  const raw = rawSeccion as Record<string, unknown>;
  const items = Array.isArray(raw.campos) ? raw.campos : [];
  const subsecciones: Subseccion[] = [];
  const camposSueltos: Campo[] = [];

  for (const item of items) {
    const it = item as Record<string, unknown>;
    if (it.tipo_nodo === 'grupo') {
      const campos = Array.isArray(it.campos) ? it.campos.map(campoFromDoc) : [];
      subsecciones.push({ id: generateId(), codigo: String(it.id ?? ''), nombre: String(it.nombre ?? ''), campos });
    } else if (it.tipo_nodo === 'campo') {
      camposSueltos.push(campoFromDoc(it));
    }
  }

  if (camposSueltos.length > 0) {
    subsecciones.push({ id: generateId(), codigo: `${raw.id ?? index + 1}.00`, nombre: 'GENERAL', campos: camposSueltos });
  }
  if (subsecciones.length === 0) {
    subsecciones.push({ id: generateId(), codigo: `${raw.id ?? index + 1}.01`, nombre: 'GENERAL', campos: [] });
  }

  return {
    id: generateId(),
    numero: String(raw.id ?? String(index + 1).padStart(2, '0')),
    nombre: String(raw.nombre ?? ''),
    hoja: typeof raw.hoja === 'string' && raw.hoja ? raw.hoja : undefined,
    cantidadCampos: subsecciones.reduce((sum, s) => sum + s.campos.length, 0),
    subsecciones,
  };
}

// --- Documento completo ---

export interface DocumentoParseResult {
  codigo: string;
  nombre: string;
  secciones: Seccion[];
}

export function parseDocumento(raw: unknown): DocumentoParseResult {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('El archivo no contiene un JSON válido.');
  }
  const doc = raw as Record<string, unknown>;
  const formato = doc.formato as Record<string, unknown> | undefined;
  if (!formato || typeof formato.codigo !== 'string' || typeof formato.nombre !== 'string') {
    throw new Error('El JSON no tiene la forma esperada — falta "formato.codigo" o "formato.nombre".');
  }
  if (formato.tipo_version !== 'estructura') {
    throw new Error('Por ahora solo se pueden importar documentos con tipo_version "estructura".');
  }
  if (!Array.isArray(doc.secciones)) {
    throw new Error('El JSON no tiene la forma esperada — falta el array "secciones".');
  }

  return {
    codigo: formato.codigo,
    nombre: formato.nombre,
    secciones: doc.secciones.map((s, i) => seccionFromDoc(s, i)),
  };
}
