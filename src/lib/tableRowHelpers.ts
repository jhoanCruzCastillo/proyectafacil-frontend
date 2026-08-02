import type { ColumnaTabla, ConfigTabla, SubtipoTabla } from '../types';

/** Valor de una celda de tabla:
 *  - `string`            → celda normal (o celda partida en modo FUSIONADO: un solo dato a lo ancho)
 *  - `string[]`          → columna dinámica (un valor por período)
 *  - `Record<...>`       → celda PARTIDA (convención 4.8): un valor por subcolumna */
export type ValorCelda = string | string[] | Record<string, string>;
export interface FilaDinamica { [colId: string]: ValorCelda }

/** ¿La celda de esta fila está partida? Es la única señal: objeto ⇒ partida, plano ⇒ fusionada. */
export function esCeldaPartida(valor: ValorCelda | undefined): valor is Record<string, string> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Valor de una subcolumna dentro de una celda partida (vacío si la celda no está partida). */
export function valorSubcolumna(valor: ValorCelda | undefined, subId: string): string {
  return esCeldaPartida(valor) ? (valor[subId] ?? '') : '';
}

/** Texto plano de una celda, sirva o no como partida — al fusionar una celda partida se concatena
 * lo que hubiera en sus partes para no perder lo ya escrito. */
export function valorPlano(valor: ValorCelda | undefined): string {
  if (valor == null) return '';
  if (typeof valor === 'string') return valor;
  if (Array.isArray(valor)) return '';
  return Object.values(valor).filter((v) => v !== '').join(' ');
}
export interface GrupoFilas {
  grupo: string;
  filas: FilaDinamica[];
  /** Valores propios de la fila de título del grupo, en las columnas que quedan a la derecha de
   * `agrupadorAbarcaColumnas` (ej. una fila-resumen como "Nivel de cobertura..." que no tiene filas
   * hijas propias, solo un valor por columna en su propia fila fusionada). */
  valoresGrupo?: FilaDinamica;
}

/** 'jerarquica' y 'jerarquica_dinamica' comparten el mismo árbol de niveles (la variante dinámica
 * solo agrega una columna que se repite por período) — este helper evita repetir el OR en cada
 * archivo que necesita distinguir "es alguna variante jerárquica" de las tablas planas. */
export function esJerarquica(subtipo: SubtipoTabla): boolean {
  return subtipo === 'jerarquica' || subtipo === 'jerarquica_dinamica';
}

export interface TreeNode {
  /** Array cuando este nivel de profundidad es `config.columnaDinamicaId` (un valor por período), string en cualquier otro nivel */
  value: string | string[];
  children: TreeNode[];
  /** Solo nodos del nivel de agrupador (4.5c): valores propios de la fila de título en las columnas
   * que quedan LIBRES a su derecha cuando el título no abarca toda la tabla — el equivalente de
   * `agrupador.valores` de las tablas planas. Ej. el total del grupo en la columna "Total". */
  valores?: FilaDinamica;
}

/** Lista editable de nombres de las columnas dinámicas generadas (ej. años, tareas, alternativas...) */
export function getPeriodos(config: ConfigTabla): string[] {
  return config.periodos ?? [];
}

function emptyRow(config: ConfigTabla): FilaDinamica {
  const row: FilaDinamica = {};
  if (config.columnaDinamicaId) row[config.columnaDinamicaId] = getPeriodos(config).map(() => '');
  return row;
}

export function newEmptyRow(config: ConfigTabla): FilaDinamica {
  return emptyRow(config);
}

export function parseDynamicRows(value: string, config: ConfigTabla): FilaDinamica[] {
  try {
    const p = JSON.parse(value);
    if (Array.isArray(p) && (p.length === 0 || (!('value' in p[0]) && !('filas' in p[0])))) return p;
  } catch { /* valor previo no es JSON (placeholder viejo) */ }
  return Array.from({ length: config.filasIniciales ?? 3 }, () => emptyRow(config));
}

export function parseGroupedRows(value: string, config: ConfigTabla): GrupoFilas[] {
  try {
    const p = JSON.parse(value);
    if (Array.isArray(p) && p.length > 0 && 'filas' in p[0]) return p;
  } catch { /* valor previo no es JSON (placeholder viejo) */ }
  return [{ grupo: 'Grupo 1', filas: Array.from({ length: config.filasIniciales ?? 3 }, () => emptyRow(config)) }];
}

function valorInicialNivel(columns: ColumnaTabla[], config: ConfigTabla, depth: number): string | string[] {
  return columns[depth]?.id === config.columnaDinamicaId ? getPeriodos(config).map(() => '') : '';
}

export function createNodeChain(columns: ColumnaTabla[], config: ConfigTabla, depth = 0): TreeNode {
  const value = valorInicialNivel(columns, config, depth);
  if (depth >= columns.length - 1) return { value, children: [] };
  return { value, children: [createNodeChain(columns, config, depth + 1)] };
}

/** Profundidad (índice en columns) del nivel que, con config.agrupador activo en una tabla
 * jerárquica, se renderiza como fila de título de grupo de ancho completo en vez de celda fusionada
 * a la izquierda (igual patrón visual que GroupedRowsEditor usa para tablas planas).
 *
 * La fuente de verdad es `config.agrupadorNivel`, que se elige con el botón "Agregar grupo" del
 * panel central. Cuando no está definido se deduce de los flags Padre/Hijo — el mecanismo anterior,
 * que obligaba a gastar una columna entera en el agrupador y se conserva solo para no romper las
 * plantillas que ya existían. */
export function agrupadorProfundidad(columns: ColumnaTabla[], config?: ConfigTabla): number {
  const explicito = config?.agrupadorNivel;
  if (typeof explicito === 'number' && explicito >= 0 && explicito < columns.length) return explicito;
  const idx = columns.findIndex((c) => c.nivel !== 'padre');
  return idx === -1 ? 0 : idx;
}

/** Índice de columna que le corresponde a una profundidad del árbol. Normalmente coinciden, pero un
 * nivel de agrupador NO consume columna (su fila de título es de ancho completo y sus hijos siguen
 * en la misma columna), así que a partir de él la profundidad va una por delante del índice. */
export function columnaParaProfundidad(config: ConfigTabla, profundidad: number): number {
  if (!config.agrupador || !esJerarquica(config.subtipo)) return profundidad;
  const nivel = agrupadorProfundidad(config.columnas, config);
  return profundidad <= nivel ? profundidad : profundidad - 1;
}

export function parseTree(value: string, columns: ColumnaTabla[], config: ConfigTabla): TreeNode[] {
  try {
    const p = JSON.parse(value);
    if (Array.isArray(p) && p.length > 0 && 'value' in p[0]) return p;
  } catch { /* valor previo no es JSON (placeholder viejo) */ }
  return [createNodeChain(columns, config)];
}
