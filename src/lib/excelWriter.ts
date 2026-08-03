import { parseDynamicRows, parseGroupedRows, parseTree, getPeriodos, esJerarquica, esCeldaPartida, agrupadorProfundidad, type FilaDinamica, type ValorCelda } from './tableRowHelpers';
import { LibroEdits, aplicarEdicionesXlsx } from './xlsxXmlPatcher';
import { crearResolver, esFormula, evaluarFormula, traducirFormulaAExcel, type ResolucionToken, type ResolucionCelda } from './formula';
import { booleanoATexto, type EtiquetasBooleano } from './conversionesExcel';
import { parseCoords, coordsATexto } from './coords';
import { leerLibroXlsx } from './xlsxXmlReader';
import type { Plantilla, Campo, ColumnaTabla, ConfigTabla, TipoCampo } from '@/types';

// --- Aritmética de columnas Excel (A, B, ..., Z, AA, AB, ...) ---

function colLetterToIndex(letter: string): number {
  let n = 0;
  for (const ch of letter.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function colIndexToLetter(n: number): string {
  let s = '';
  let i = n;
  while (i > 0) {
    const rem = (i - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function addCols(letter: string, delta: number): string {
  return colIndexToLetter(colLetterToIndex(letter) + delta);
}

// `etiquetasBooleano` son las palabras con que la plantilla oficial escribe un booleano en el Excel
// ("Sí"/"No"). Sin ellas se escribe un booleano nativo (TRUE/FALSE), que es el comportamiento
// previo — pero una plantilla que las declara debe recuperar su propio texto, no el genérico.
function coerceValor(tipo: TipoCampo, raw: string | undefined, etiquetasBooleano?: EtiquetasBooleano): string | number | boolean {
  if (raw == null || raw === '') return '';
  if (tipo === 'numero' || tipo === 'decimal') {
    const n = Number(raw);
    return Number.isNaN(n) ? '' : n;
  }
  if (tipo === 'booleano') return booleanoATexto(raw, etiquetasBooleano);
  // Coordenadas: en el JSON viajan como objeto {lat,lng}, pero la celda del Excel lleva el par en
  // texto plano. Volcarlas como el JSON crudo dejaría `{"lat":…}` a la vista en la hoja.
  if (tipo === 'mapa_coordenadas') {
    const c = parseCoords(raw);
    return c ? coordsATexto(c) : raw;
  }
  return raw;
}

// Escribe un valor y, si abarca más de una columna o fila, fusiona la celda combinada
// correspondiente — así los datos quedan alineados con el ancho configurado de la columna
// (o del campo), igual que la cabecera. Las fusiones ya presentes en la plantilla oficial
// (celdas de captura predefinidas) no se duplican — aplicarEdicionesXlsx las deduplica por rango.
// Guarda de seguridad: un valor vacío ('') nunca se escribe ni se fusiona, sin importar el
// llamador — así una celda del Excel original nunca se ve afectada por un campo sin dato
// (0 numérico y `false` booleano sí son datos reales y se escriben igual).
function writeCellSpan(
  ediciones: LibroEdits,
  hoja: string | undefined,
  columna: string | undefined,
  fila: number | undefined,
  value: string | number | boolean,
  abarcaColumnas = 1,
  abarcaFilas = 1,
  formula?: string,
) {
  if (!hoja || !columna || !fila) return;
  if (value === '' && !formula) return;
  if (formula) {
    ediciones.escribirFormula(hoja, columna, fila, formula, typeof value === 'number' ? value : Number(value) || 0);
  } else {
    ediciones.escribirCelda(hoja, columna, fila, value);
  }
  if (abarcaColumnas > 1 || abarcaFilas > 1) {
    const endCol = abarcaColumnas > 1 ? addCols(columna, abarcaColumnas - 1) : columna;
    const endRow = fila + Math.max(abarcaFilas, 1) - 1;
    ediciones.fusionar(hoja, `${columna}${fila}:${endCol}${endRow}`);
  }
}

// Cantidad de columnas físicas de Excel que ocupan las primeras `n` cabeceras/columnas lógicas de
// la tabla — cada una puede abarcar más de una columna física (`abarcaColumnasExcel`), y la columna
// dinámica cuenta una vez por período. Así, "abarca 2 columnas" en el agrupador significa "las
// primeras 2 cabeceras", no "2 columnas físicas": si la primera cabecera ya abarca 2 columnas y la
// segunda 1, el resultado físico real es 3.
function anchoFisicoPrimerasColumnas(config: ConfigTabla, n: number, periodos: string[], desde = 0): number {
  let total = 0;
  for (let i = desde; i < desde + n && i < config.columnas.length; i++) {
    const col = config.columnas[i];
    if (col.id === config.columnaDinamicaId && periodos.length > 0) {
      total += periodos.length * (col.abarcaColumnasExcel ?? 1);
    } else {
      total += col.abarcaColumnasExcel ?? 1;
    }
  }
  return total;
}

// Escribe una columna con subcolumnas (4.8). La FORMA del valor manda, igual que al leer:
//  - objeto con alguna parte con dato  -> celda PARTIDA: se rompe la fusión J:K de esa fila y cada
//    parte va a su propia columna de Excel.
//  - texto plano                        -> celda FUSIONADA: se escribe en la columna padre con su
//    ancho completo, y las columnas de las otras partes se vacían para no dejar restos ocultos
//    debajo de la fusión (que al releer se interpretarían como una celda partida).
// Si el objeto no tiene ninguna parte con dato, no se toca nada: rige la regla de celda vacía.
function writeCeldaPartida(
  ediciones: LibroEdits,
  hoja: string | undefined,
  col: ColumnaTabla,
  valor: ValorCelda | undefined,
  row: number,
) {
  const subs = col.subcolumnas!;
  const rangoPadre = col.columnaExcel
    ? `${col.columnaExcel}${row}:${addCols(col.columnaExcel, (col.abarcaColumnasExcel ?? subs.length) - 1)}${row}`
    : undefined;

  if (esCeldaPartida(valor)) {
    if (!subs.some((s) => (valor[s.id] ?? '') !== '')) return;
    if (hoja && rangoPadre) ediciones.desfusionar(hoja, rangoPadre);
    for (const sub of subs) {
      const v = valor[sub.id] ?? '';
      if (v === '') continue;
      writeCellSpan(ediciones, hoja, sub.columnaExcel, row, v, sub.abarcaColumnasExcel ?? 1);
    }
    return;
  }

  if (typeof valor !== 'string' || valor === '') return;
  for (const sub of subs.slice(1)) {
    if (hoja && sub.columnaExcel) ediciones.escribirCelda(hoja, sub.columnaExcel, row, '');
  }
  writeCellSpan(ediciones, hoja, col.columnaExcel, row, valor, col.abarcaColumnasExcel ?? subs.length);
}

// Celdas sin dato (vacías) se omiten por completo — no se escribe ni se fusiona nada sobre ellas,
// así el contenido que ya tuviera esa celda en el Excel original queda intacto.
function writeFilaColumnas(ediciones: LibroEdits, hoja: string | undefined, config: ConfigTabla, fila: FilaDinamica, row: number, periodos: string[], altoDeBloque?: AltoDeBloque) {
  // La altura del bloque NO es uniforme en la fila: en 4.02.01 la columna B fusiona 3 filas por
  // registro mientras que la E tiene tres celdas sueltas de una fila. Por eso cada celda reutiliza
  // exactamente la geometría que la plantilla declara para ella; imponer una altura común destruía
  // las fusiones de las columnas que no la compartían.
  const alto = (col: ColumnaTabla) => (hoja ? Math.max(altoDeBloque?.(hoja, col.columnaExcel, row) ?? 1, 1) : 1);
  for (const col of config.columnas) {
    if (col.subcolumnas?.length) {
      writeCeldaPartida(ediciones, hoja, col, fila[col.id], row);
      continue;
    }
    if (!col.columnaExcel) continue;
    if (col.id === config.columnaDinamicaId) {
      const arr = Array.isArray(fila[col.id]) ? (fila[col.id] as string[]) : [];
      periodos.forEach((_, i) => {
        const v = arr[i];
        if (v == null || v === '') return;
        const colLetter = addCols(col.columnaExcel!, i * (col.abarcaColumnasExcel ?? 1));
        writeCellSpan(ediciones, hoja, colLetter, row, v, col.abarcaColumnasExcel ?? 1, alto(col));
      });
    } else {
      const v = fila[col.id];
      if (typeof v !== 'string' || v === '') continue;
      writeCellSpan(ediciones, hoja, col.columnaExcel, row, v, col.abarcaColumnasExcel ?? 1, alto(col));
    }
  }
}

// Cuántas filas físicas ocupará la tabla con los datos actuales — usado tanto para registrar el
// crecimiento (antes de escribir nada) como, indirectamente, al escribir (mismo recorrido).
function filasNecesariasTabla(config: ConfigTabla, raw: string): number {
  if (esJerarquica(config.subtipo)) {
    const roots = parseTree(raw, config.columnas, config);
    let total = 0;
    const contar = (node: { children: unknown[] }) => {
      if (node.children.length === 0) total++;
      else (node.children as typeof node[]).forEach(contar);
    };
    roots.forEach(contar);
    return total;
  }
  if (config.agrupador) {
    const grupos = parseGroupedRows(raw, config);
    return grupos.reduce((sum, g) => sum + 1 + g.filas.length, 0);
  }
  return parseDynamicRows(raw, config).length;
}

// Si la tabla necesita más filas que las reservadas en la plantilla oficial (`filasBase`), registra
// cuántas filas nuevas hay que insertar físicamente en el Excel — para que excelWriter no sobre-
// escriba el contenido que originalmente venía justo debajo de la tabla (notas, siguientes tablas,
// etc.), sino que ese contenido se desplace hacia abajo.
function registrarCrecimientoTabla(ediciones: LibroEdits, hoja: string | undefined, config: ConfigTabla, raw: string) {
  const filaInicial = config.captura?.filaInicial;
  const filasBase = config.captura?.filasBase;
  if (!hoja || !filaInicial || !filasBase) return;
  // Una tabla sin datos no crece. Sin esta guarda, `parseDynamicRows('')` devuelve las filas en
  // blanco que la UI muestra por cortesía (`filasIniciales`, 3 por defecto) y se contaban como si
  // fueran datos: una tabla vacía con filas_base 1 "crecía" 2 filas e insertaba dos filas físicas,
  // desplazando hacia abajo TODO lo que venía después en la hoja. Nada se escribe en ellas, así que
  // el desplazamiento era puro daño.
  if (!raw || raw.trim() === '') return;
  const necesarias = filasNecesariasTabla(config, raw);
  const excedente = necesarias - filasBase;
  if (excedente > 0) ediciones.registrarCrecimiento(hoja, filaInicial + filasBase - 1, excedente);
}

// Escribe un nodo del árbol UNA sola vez — en la primera fila que ocupa su subárbol — y, si ese
// subárbol abarca más de una fila, fusiona la celda de esa columna sobre todo el rango. Antes, el
/** Altura en filas del bloque que la plantilla ya tiene reservado para una celda, o undefined si
 * ahí no hay ninguna fusión. Se resuelve leyendo el propio Excel de destino: así la estructura no
 * tiene que declarar cuántas filas mide cada ítem, y funciona igual en cualquier plantilla. */
type AltoDeBloque = (hoja: string, columna: string | undefined, fila: number) => number | undefined;

// valor de cada ancestro (columnas "padre") se escribía repetido en la fila de cada hoja, confiando
// en que la fusión ya existente en la plantilla oficial ocultara las copias — pero el visor no
// siempre respeta fusiones cuyas celdas no-ancla tienen contenido propio, así que se ven repetidas.
// Devuelve cuántas filas físicas consume el subárbol de `node`.
function writeArbol(
  ediciones: LibroEdits,
  hoja: string,
  config: ConfigTabla,
  periodos: string[],
  node: { value: string | string[]; children: unknown[] },
  profundidad: number,
  filaInicio: number,
  colIdx = profundidad,
  agrupadorDepth = -1,
  altoDeBloque?: AltoDeBloque,
): number {
  const col = config.columnas[colIdx];
  // Nivel de agrupador: el nodo ocupa una FILA propia (fila de título) y sus hijos siguen en la
  // MISMA columna, debajo — igual que en el Excel oficial, donde "Actores comunales:" y
  // "o Madre cuidadora" comparten la columna B en filas consecutivas.
  const esNivelAgrupador = profundidad === agrupadorDepth && node.children.length > 0;
  const colDeHijos = esNivelAgrupador ? colIdx : colIdx + 1;

  let filasConsumidas: number;
  if (node.children.length === 0) {
    // Una hoja NO ocupa necesariamente una fila: la plantilla oficial suele reservarle un bloque de
    // varias filas ya fusionadas (en 5.01.03, B19:E21 son 3 filas por cada "Efecto directo"). Se
    // toma esa altura del propio archivo — suponer 1 desalineaba la tabla y, peor, las fusiones que
    // escribíamos se solapaban con las del bloque y la deduplicación borraba las originales,
    // dejando las celdas sueltas. Sin bloque declarado en el Excel, sigue siendo 1.
    filasConsumidas = Math.max(altoDeBloque?.(hoja, col?.columnaExcel, filaInicio) ?? 1, 1);
  } else {
    let fila = filaInicio + (esNivelAgrupador ? 1 : 0);
    filasConsumidas = esNivelAgrupador ? 1 : 0;
    for (const hijo of node.children as typeof node[]) {
      const consumidas = writeArbol(ediciones, hoja, config, periodos, hijo, profundidad + 1, fila, colDeHijos, agrupadorDepth, altoDeBloque);
      fila += consumidas;
      filasConsumidas += consumidas;
    }
  }

  // El título de grupo no se fusiona verticalmente: vive en su propia fila, y se extiende a lo ancho
  // de las cabeceras configuradas en el engranaje del agrupador (por defecto, hasta la última).
  if (esNivelAgrupador) {
    const disponibles = config.columnas.length - colIdx;
    const cabeceras = Math.min(Math.max(config.agrupadorAbarcaColumnas ?? disponibles, 1), disponibles);
    if (col?.columnaExcel && typeof node.value === 'string' && node.value !== '') {
      const ancho = anchoFisicoPrimerasColumnas(config, cabeceras, periodos, colIdx);
      writeCellSpan(ediciones, hoja, col.columnaExcel, filaInicio, node.value, Math.max(ancho, 1));
    }
    // Valores propios del grupo en las columnas libres a la derecha del título (fila-resumen).
    const valores = (node as { valores?: FilaDinamica }).valores;
    if (valores) {
      for (let i = colIdx + cabeceras; i < config.columnas.length; i++) {
        const libre = config.columnas[i];
        if (!libre?.columnaExcel) continue;
        const v = valores[libre.id];
        if (libre.id === config.columnaDinamicaId && Array.isArray(v)) {
          const ancho = libre.abarcaColumnasExcel ?? 1;
          periodos.forEach((_, pi) => {
            const celda = v[pi];
            if (celda == null || celda === '') return;
            writeCellSpan(ediciones, hoja, addCols(libre.columnaExcel!, pi * ancho), filaInicio, celda, ancho);
          });
          continue;
        }
        if (typeof v !== 'string' || v === '') continue;
        writeCellSpan(ediciones, hoja, libre.columnaExcel, filaInicio, v, libre.abarcaColumnasExcel ?? 1);
      }
    }
    return filasConsumidas;
  }
  if (col?.columnaExcel) {
    if (col.id === config.columnaDinamicaId) {
      // Nivel dinámico del árbol: un valor por período, alineado horizontalmente igual que en las
      // tablas planas — nunca coexiste con una etiqueta de texto en el mismo nodo.
      const arr = Array.isArray(node.value) ? node.value : [];
      periodos.forEach((_, i) => {
        const v = arr[i];
        if (v == null || v === '') return;
        const colLetter = addCols(col.columnaExcel!, i * (col.abarcaColumnasExcel ?? 1));
        writeCellSpan(ediciones, hoja, colLetter, filaInicio, v, col.abarcaColumnasExcel ?? 1, filasConsumidas);
      });
    } else if (typeof node.value === 'string' && node.value !== '') {
      writeCellSpan(ediciones, hoja, col.columnaExcel, filaInicio, node.value, col.abarcaColumnasExcel ?? 1, filasConsumidas);
    }
  }
  return filasConsumidas;
}

// Alto del bloque que la plantilla reserva para UNA fila de datos, mirando la primera columna con
// posición declarada. Las plantillas oficiales suelen fusionar varias filas por registro (4.02.01
// reserva 3), y avanzar de una en una partía esos bloques y desalineaba la tabla entera.
function altoDeFila(config: ConfigTabla, hoja: string, fila: number, altoDeBloque?: AltoDeBloque): number {
  if (!altoDeBloque) return 1;
  const primera = config.columnas.find((c) => c.columnaExcel)?.columnaExcel;
  return Math.max(altoDeBloque(hoja, primera, fila) ?? 1, 1);
}

function writeCampoTabla(ediciones: LibroEdits, hoja: string | undefined, config: ConfigTabla, raw: string, altoDeBloque?: AltoDeBloque) {
  const filaInicial = config.captura?.filaInicial;
  if (!hoja || !filaInicial) return;
  // Desplazamiento uniforme por el crecimiento de tablas ANTERIORES en la misma hoja — no incluye
  // el crecimiento de esta propia tabla (su punto de inserción es filaInicial+filasBase-1, que
  // nunca es < filaInicial, así que desplazamientoPara lo excluye automáticamente).
  const shift = ediciones.desplazamientoPara(hoja, filaInicial);

  const periodos = getPeriodos(config);

  if (esJerarquica(config.subtipo)) {
    const roots = parseTree(raw, config.columnas, config);
    const agrupadorDepth = config.agrupador ? agrupadorProfundidad(config.columnas, config) : -1;
    let row = filaInicial + shift;
    for (const r of roots) {
      row += writeArbol(ediciones, hoja, config, periodos, r, 0, row, 0, agrupadorDepth, altoDeBloque);
    }
    return;
  }

  if (config.agrupador) {
    const grupos = parseGroupedRows(raw, config);
    const columnaInicial = config.captura?.columnaInicial ?? config.columnas[0]?.columnaExcel;
    const abarcaCabeceras = Math.min(config.agrupadorAbarcaColumnas ?? config.columnas.length, config.columnas.length);
    const abarcaFisico = anchoFisicoPrimerasColumnas(config, abarcaCabeceras, periodos);

    let row = filaInicial + shift;
    for (const grupo of grupos) {
      // Un bloque sin título ni valores propios NO son "un grupo con el nombre en blanco": son
      // filas sueltas antes del primer grupo real, y no ocupan ninguna fila del Excel. Reservarles
      // una desalineaba toda la tabla y, peor, rompía la simetría con el lector — que nunca produce
      // una fila de título vacía, porque las reconoce por su fusión horizontal.
      const tieneTitulo = grupo.grupo !== '';
      const ocupaFila = tieneTitulo || Boolean(grupo.valoresGrupo);

      if (columnaInicial && tieneTitulo) {
        ediciones.escribirCelda(hoja, columnaInicial, row, grupo.grupo);
        if (abarcaFisico > 1) ediciones.fusionar(hoja, `${columnaInicial}${row}:${addCols(columnaInicial, abarcaFisico - 1)}${row}`);
      }
      // Valores propios de la fila de título (`agrupador.valores`, punto 4.2): las columnas a la
      // derecha del título son celdas de datos como cualquier otra — ej. la fila "Nivel de
      // cobertura…" de 7.03, con un porcentaje por año. El lector ya las leía; sin esto, el viaje
      // de vuelta a Excel las perdía.
      if (grupo.valoresGrupo) {
        writeFilaColumnas(ediciones, hoja, config, grupo.valoresGrupo, row, periodos, altoDeBloque);
      }
      if (ocupaFila) row += altoDeFila(config, hoja, row, altoDeBloque);
      for (const fila of grupo.filas) {
        writeFilaColumnas(ediciones, hoja, config, fila, row, periodos, altoDeBloque);
        row += altoDeFila(config, hoja, row, altoDeBloque);
      }
    }
    return;
  }

  const filas = parseDynamicRows(raw, config);
  let row = filaInicial + shift;
  for (const fila of filas) {
    writeFilaColumnas(ediciones, hoja, config, fila, row, periodos, altoDeBloque);
    row += altoDeFila(config, hoja, row, altoDeBloque);
  }
}

// Traduce la fórmula a sintaxis nativa de Excel, sustituyendo cada campo referenciado por su celda
// real (columna+fila, con el nombre de hoja delante si vive en otra hoja) — incluyendo el
// desplazamiento por crecimiento de filas de tablas anteriores. Si algún operando no tiene una
// celda real a la que apuntar (sin captura, tipo inválido, no existe), devuelve null.
function construirFormulaExcel(
  ediciones: LibroEdits,
  raw: string,
  hojaActual: string,
  tareasPorId: Map<string, { hoja: string | undefined; campo: Campo }>,
): string | null {
  const resolver = (token: string): ResolucionCelda => {
    const ref = tareasPorId.get(token);
    if (!ref?.hoja || !ref.campo.captura?.columna || !ref.campo.captura?.fila) return { tipo: 'no-disponible' };
    if (ref.campo.tipo !== 'numero' && ref.campo.tipo !== 'decimal' && ref.campo.tipo !== 'fecha') return { tipo: 'no-disponible' };
    const filaReal = ref.campo.captura.fila + ediciones.desplazamientoPara(ref.hoja, ref.campo.captura.fila);
    const celda = `${ref.campo.captura.columna}${filaReal}`;
    return { tipo: 'celda', referencia: ref.hoja !== hojaActual ? `'${ref.hoja}'!${celda}` : celda };
  };
  return traducirFormulaAExcel(raw, resolver);
}

function writeCampo(
  ediciones: LibroEdits,
  hoja: string | undefined,
  campo: Campo,
  valores: Record<string, string>,
  resolverFormula: (token: string) => ResolucionToken,
  tareasPorId: Map<string, { hoja: string | undefined; campo: Campo }>,
  altoDeBloque?: AltoDeBloque,
) {
  const esTabla = campo.tipo === 'tabla' || campo.tipo === 'tabla_jerarquica';
  if (esTabla) {
    if (campo.configTabla) writeCampoTabla(ediciones, hoja, campo.configTabla, valores[campo.identificador] ?? '', altoDeBloque);
    return;
  }
  if (!campo.captura?.columna || !campo.captura.fila || !hoja) return;
  // Campo imagen: su URL se escribe como texto y además se marca la celda como hipervínculo, para
  // abrirla de un clic en el navegador. Incrustar el binario como dibujo está implementado (ver
  // lib/xlsxImageWriter.ts) pero desactivado: Excel seguía marcando el archivo como reparado.
  // Para reactivarlo: saltar este campo aquí y reponer el bloque de descarga en
  // insertarValoresEnExcel, que registra la imagen con ediciones.insertarImagen().
  const raw = valores[campo.identificador];
  if (campo.tipo === 'imagen' && typeof raw === 'string' && /^https?:\/\//i.test(raw.trim())) {
    ediciones.enlazar(hoja, campo.captura.columna, campo.captura.fila + ediciones.desplazamientoPara(hoja, campo.captura.fila), raw.trim());
  }
  if (raw == null || raw === '') return; // campo vacío: no tocar la celda
  const shift = ediciones.desplazamientoPara(hoja, campo.captura.fila);

  let formulaExcel: string | undefined;
  let valorParaEscribir = raw;
  if (esFormula(raw)) {
    const resultado = evaluarFormula(raw!, resolverFormula);
    if (resultado.error || resultado.valor == null) return; // fórmula inválida: no se escribe nada
    valorParaEscribir = String(resultado.valor);
    formulaExcel = construirFormulaExcel(ediciones, raw!, hoja, tareasPorId) ?? undefined;
  }

  writeCellSpan(
    ediciones, hoja, campo.captura.columna, campo.captura.fila + shift,
    coerceValor(campo.tipo, valorParaEscribir, campo.etiquetasBooleano),
    campo.captura.abarcaColumnas ?? 1, campo.captura.abarcaFilas ?? 1,
    formulaExcel,
  );
}

// Inserta los valores de un ejemplo en el Excel asignado, ubicando cada campo según su
// `captura` (columna/fila) — o, para campos tabla, según `configTabla.captura` + `columnaExcel`
// por columna. Devuelve una nueva data URL con el archivo modificado (siempre en el mismo
// formato del original: .xlsx o .xlsm). A diferencia de una reescritura completa del libro con
// SheetJS (que descarta todo el formato visual), aquí solo se editan quirúrgicamente los nodos de
// celda que cambian — el resto del archivo (estilos, colores, macros) queda intacto.
// `onProgress` (0 a 1) se reporta a medida que se acumulan los cambios de cada campo, cediendo el
// hilo principal entre lotes para que la barra de carga se repinte con progreso real.
export async function insertarValoresEnExcel(
  dataUrl: string,
  plantilla: Plantilla,
  valores: Record<string, string>,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const ediciones = new LibroEdits();

  const tareas: { hoja: string | undefined; campo: Campo }[] = [];
  for (const seccion of plantilla.secciones) {
    for (const sub of seccion.subsecciones) {
      for (const campo of sub.campos) {
        tareas.push({ hoja: seccion.hoja, campo });
      }
    }
  }

  // Primera pasada: registrar cuánto crece cada tabla (si excede sus filas base) ANTES de escribir
  // ningún valor — así, al escribir, ya se conoce el desplazamiento acumulado de cada fila.
  for (const { hoja, campo } of tareas) {
    const esTabla = campo.tipo === 'tabla' || campo.tipo === 'tabla_jerarquica';
    if (esTabla && campo.configTabla) {
      registrarCrecimientoTabla(ediciones, hoja, campo.configTabla, valores[campo.identificador] ?? '');
    }
  }

  // Las plantillas oficiales reservan bloques de varias filas ya fusionadas por cada ítem de una
  // tabla jerárquica. Se leen del propio archivo de destino para no tener que declararlos en la
  // estructura: así funciona igual en cualquier plantilla, y una tabla sin bloques se comporta
  // como antes (1 fila por ítem).
  const libroOrigen = await leerLibroXlsx(dataUrl);
  const altoDeBloque = (hoja: string, columna: string | undefined, fila: number): number | undefined =>
    (columna ? libroOrigen.fusion(hoja, `${columna}${fila}`)?.filas : undefined);

  const resolverFormula = crearResolver(tareas.map((t) => t.campo), (id) => valores[id]);
  const tareasPorId = new Map(tareas.map((t) => [t.campo.identificador, t]));

  const total = tareas.length || 1;
  const loteSize = Math.max(1, Math.ceil(total / 30)); // ~30 repintados como máximo durante la acumulación
  for (let i = 0; i < tareas.length; i++) {
    const { hoja, campo } = tareas[i];
    writeCampo(ediciones, hoja, campo, valores, resolverFormula, tareasPorId, altoDeBloque);
    if ((i + 1) % loteSize === 0 || i === tareas.length - 1) {
      onProgress?.(((i + 1) / total) * 0.9); // el 10% restante es el parcheo del ZIP
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const { dataUrl: salida, omitidasPorFormula } = await aplicarEdicionesXlsx(dataUrl, ediciones);
  onProgress?.(1);
  // Se informa por consola en vez de fallar: omitir una celda con fórmula es el comportamiento
  // correcto, no un error — pero conviene poder ver cuáles al depurar una plantilla nueva.
  if (omitidasPorFormula.length > 0) {
    console.info(
      `[excelWriter] ${omitidasPorFormula.length} celda(s) no se escribieron por tener fórmula propia en el Excel:`,
      omitidasPorFormula,
    );
  }
  return salida;
}
