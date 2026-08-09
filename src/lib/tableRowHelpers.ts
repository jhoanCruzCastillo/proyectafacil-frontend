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

/**
 * Filas en blanco que se muestran cuando la tabla todavía no tiene datos: las que la plantilla
 * oficial reserva (`filas_base`).
 *
 * Antes esto era un campo aparte del editor (`filas_iniciales`) que había que llenar a mano. Se
 * quitó porque no describía nada del Excel y se confundía con `filas_base`: dejarlo en un número
 * distinto sembraba filas de cortesía que, al guardar, contaban como datos y hacían crecer la tabla
 * con filas vacías. Tomándolo de `filas_base` el editor muestra exactamente la forma del archivo y
 * las dos cosas no pueden desalinearse.
 */
function filasEnBlanco(config: ConfigTabla): number {
  return Math.max(config.captura?.filasBase ?? 1, 1);
}

export function parseDynamicRows(value: string, config: ConfigTabla): FilaDinamica[] {
  try {
    const p = JSON.parse(value);
    if (Array.isArray(p) && (p.length === 0 || (!('value' in p[0]) && !('filas' in p[0])))) return p;
  } catch { /* valor previo no es JSON (placeholder viejo) */ }
  return Array.from({ length: filasEnBlanco(config) }, () => emptyRow(config));
}

export function parseGroupedRows(value: string, config: ConfigTabla): GrupoFilas[] {
  try {
    const p = JSON.parse(value);
    if (Array.isArray(p) && p.length > 0 && 'filas' in p[0]) return p;
  } catch { /* valor previo no es JSON (placeholder viejo) */ }
  // La fila de título del grupo también ocupa una de las filas base.
  const filas = Math.max(filasEnBlanco(config) - 1, 1);
  return [{ grupo: 'Grupo 1', filas: Array.from({ length: filas }, () => emptyRow(config)) }];
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

/**
 * Altura en filas del bloque (posiblemente fusionado) anclado en esa celda del archivo destino.
 * Sin archivo o sin fusión declarada, una fila.
 */
export type AltoDeBloque = (hoja: string, columna: string | undefined, fila: number) => number | undefined;

/**
 * ¿La fila de título de este grupo ocupa una fila del Excel?
 *
 * Un bloque sin título y sin valores propios NO es "un grupo con el nombre en blanco": son filas
 * sueltas antes del primer grupo real y no consumen fila. Y un objeto de valores TODOS vacíos es el
 * molde de la estructura, no datos.
 *
 * ES LA ÚNICA DEFINICIÓN de la regla: la consultan el conteo de filas, la escritura al Excel y el
 * editor. Cuando estaban duplicadas se desfasaron —el escritor aceptaba cualquier objeto de valores
 * y el editor exigía contenido—, y ese desfase desalinea la tabla entera sin avisar.
 */
export function grupoOcupaFila(grupo: GrupoFilas): boolean {
  if (grupo.grupo !== '') return true;
  const propios = grupo.valoresGrupo;
  if (!propios) return false;
  return Object.values(propios).some((v) => (Array.isArray(v) ? v.some((x) => x !== '') : v !== '' && v != null));
}

/**
 * Cómo se reparte la FILA DE TÍTULO de un grupo a lo ancho de la tabla.
 *
 * `config.agrupadorAbarcaColumnas` cuenta **columnas reales de Excel**, no cabeceras. La fila de
 * título siempre cubre el ancho completo de la tabla; ese número solo decide dónde se corta el
 * título:
 *
 *   detalle = B:E (4 columnas), cantidad = F, costo = G, total = H
 *     4 -> [B:E título] [F] [G] [H]
 *     2 -> [B:C título] [D:E resto] [F] [G] [H]
 *     1 -> [B   título] [C:E resto] [F] [G] [H]
 *
 * Si el corte cae dentro de una cabecera, el sobrante NO queda suelto: se fusiona como una celda
 * propia. Las cabeceras posteriores aportan una celda completa cada una, y son las que pueden
 * llevar valores propios del grupo (`valoresGrupo`).
 *
 * ES LA ÚNICA DEFINICIÓN del reparto: la consultan el escritor (para fusionar), el lector (para
 * reconocer una fila de título por su fusión) y el editor (para pintarla).
 */
export interface RepartoAgrupador {
  /** Columnas físicas de Excel que ocupa el título */
  anchoTitulo: number;
  /** Columnas físicas del sobrante, o 0 si el corte cae justo en una frontera de cabecera */
  anchoResto: number;
  /** Índice de la primera cabecera libre — desde ahí empiezan las celdas completas de la derecha */
  primeraCabeceraLibre: number;
}

export function repartoAgrupador(
  config: ConfigTabla,
  periodos: string[],
  desde = 0,
): RepartoAgrupador {
  const anchoDe = (col: ColumnaTabla) =>
    col.id === config.columnaDinamicaId && periodos.length > 0
      ? periodos.length * (col.abarcaColumnasExcel ?? 1)
      : col.abarcaColumnasExcel ?? 1;

  let total = 0;
  for (let i = desde; i < config.columnas.length; i++) total += anchoDe(config.columnas[i]);
  // Sin valor declarado, el título abarca la tabla entera — el comportamiento de siempre.
  const anchoTitulo = Math.min(Math.max(config.agrupadorAbarcaColumnas ?? total, 1), Math.max(total, 1));

  let acumulado = 0;
  for (let i = desde; i < config.columnas.length; i++) {
    const ancho = anchoDe(config.columnas[i]);
    if (acumulado + ancho === anchoTitulo) {
      return { anchoTitulo, anchoResto: 0, primeraCabeceraLibre: i + 1 };
    }
    if (acumulado + ancho > anchoTitulo) {
      // El corte parte esta cabecera: lo que sobra de ella es una celda más, y las libres empiezan
      // en la siguiente.
      return { anchoTitulo, anchoResto: acumulado + ancho - anchoTitulo, primeraCabeceraLibre: i + 1 };
    }
    acumulado += ancho;
  }
  return { anchoTitulo, anchoResto: 0, primeraCabeceraLibre: config.columnas.length };
}

/** Filas de Excel que ocupa un grupo: la de su título (si la tiene) y una por cada fila de datos. */
export interface PosicionGrupo {
  /** Fila del título, o null si el bloque no consume una */
  filaTitulo: number | null;
  /** Fila de Excel de cada fila de datos, en orden */
  filas: number[];
}

/**
 * Fila de Excel de cada parte de una tabla plana con agrupador.
 *
 * Misma intención que `posicionesArbol` para las jerárquicas: una sola aritmética que consultan el
 * escritor (para saber dónde escribir) y el editor (para saber a qué celda pedirle sus opciones o
 * su fórmula). Con una sola definición, la celda que se le muestra al usuario y la celda donde
 * termina el dato no pueden desincronizarse.
 *
 * `altoDeFila` permite que una fila ocupe un bloque de varias filas ya fusionado en la plantilla;
 * sin él, una fila del Excel por cada fila de la tabla.
 */
export function posicionesGrupos(
  grupos: GrupoFilas[],
  filaInicial: number,
  altoDeFila?: (fila: number) => number,
): PosicionGrupo[] {
  const alto = (fila: number) => Math.max(altoDeFila?.(fila) ?? 1, 1);
  let row = filaInicial;
  return grupos.map((grupo) => {
    let filaTitulo: number | null = null;
    if (grupoOcupaFila(grupo)) {
      filaTitulo = row;
      row += alto(row);
    }
    const filas = grupo.filas.map(() => {
      const f = row;
      row += alto(f);
      return f;
    });
    return { filaTitulo, filas };
  });
}

/** Dónde cae un nodo del árbol dentro de la hoja de Excel. */
export interface PosicionNodo {
  /** Fila real de Excel donde arranca el nodo */
  fila: number;
  /** Cuántas filas del Excel ocupa él y todo lo que cuelga de él */
  filasConsumidas: number;
  /** Índice de la columna de `config.columnas` en la que se dibuja */
  colIdx: number;
}

function claveRuta(path: number[]): string {
  return path.join('.');
}

/**
 * Fila de Excel de cada nodo de una tabla jerárquica.
 *
 * ES LA ÚNICA DEFINICIÓN de esa aritmética: la consumen tanto el escritor (para saber dónde escribir)
 * como el editor de la UI (para saber a qué celda preguntarle sus opciones o su fórmula). Tenerla
 * duplicada era el riesgo real — dos copias que se desfasan hacen que la UI ofrezca el desplegable de
 * una celda mientras el archivo se escribe en otra, y eso falla en silencio.
 *
 * Dos sutilezas que no son obvias y que hay que respetar para que cuadre con el archivo oficial:
 *  - Una hoja del árbol NO ocupa siempre una fila: la plantilla suele reservarle un bloque ya
 *    fusionado de varias (`altoDeBloque`).
 *  - Un nivel de agrupador ocupa una fila propia de título y sus hijos siguen en la MISMA columna.
 */
export function posicionesArbol(
  roots: TreeNode[],
  config: ConfigTabla,
  hoja: string,
  filaInicial: number,
  agrupadorDepth: number,
  altoDeBloque?: AltoDeBloque,
): Map<string, PosicionNodo> {
  const mapa = new Map<string, PosicionNodo>();

  function walk(node: TreeNode, profundidad: number, filaInicio: number, colIdx: number, path: number[]): number {
    const col = config.columnas[colIdx];
    const esNivelAgrupador = profundidad === agrupadorDepth && node.children.length > 0;
    const colDeHijos = esNivelAgrupador ? colIdx : colIdx + 1;

    let filasConsumidas: number;
    if (node.children.length === 0) {
      filasConsumidas = Math.max(altoDeBloque?.(hoja, col?.columnaExcel, filaInicio) ?? 1, 1);
    } else {
      let fila = filaInicio + (esNivelAgrupador ? 1 : 0);
      filasConsumidas = esNivelAgrupador ? 1 : 0;
      node.children.forEach((hijo, ci) => {
        const consumidas = walk(hijo, profundidad + 1, fila, colDeHijos, [...path, ci]);
        fila += consumidas;
        filasConsumidas += consumidas;
      });
    }

    mapa.set(claveRuta(path), { fila: filaInicio, filasConsumidas, colIdx });
    return filasConsumidas;
  }

  let fila = filaInicial;
  roots.forEach((raiz, i) => {
    fila += walk(raiz, 0, fila, 0, [i]);
  });

  return mapa;
}

/** Posición de un nodo concreto dentro del mapa devuelto por `posicionesArbol`. */
export function posicionDe(mapa: Map<string, PosicionNodo>, path: number[]): PosicionNodo | undefined {
  return mapa.get(claveRuta(path));
}
