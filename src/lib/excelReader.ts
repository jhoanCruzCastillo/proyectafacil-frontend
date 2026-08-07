import { leerLibroXlsx, type CeldaLeida, type LibroLeido } from './xlsxXmlReader';
import { leerImagenesDeHoja, imagenParaFila, type ImagenIncrustada } from './xlsxImageReader';
import { aFechaISO, aAnio, aPorcentaje } from './conversionesExcel';
import { parseCoords, serializarCoords } from './coords';
import {
  esCeldaPartida, esJerarquica, getPeriodos, parseTree, posicionesArbol, posicionDe, agrupadorProfundidad,
  type FilaDinamica, type GrupoFilas, type TreeNode,
} from './tableRowHelpers';
import type { Plantilla, Campo, Seccion, ConfigTabla, ColumnaTabla, TipoCampo, TipoColumna } from '@/types';

// Volcado de datos Excel -> valores de un ejemplo: el inverso de excelWriter.ts. Recorre la
// plantilla igual que `insertarValoresEnExcel`, pero en vez de escribir cada campo en su celda de
// `captura`, lee esa misma celda y arma el Record<identificador, valor> del ejemplo.
//
// Alcance actual (por fases, pedido del usuario):
//  - Campos simples: mapeo 1:1 celda -> valor.
//  - Tablas SIMPLES (filas planas, columnas fijas, sin agrupador): se leen las `filas_base`
//    declaradas y, si el Excel tiene filas insertadas debajo, se siguen leyendo mientras el
//    FORMATO de la fila coincida con el de las filas base (ver esDeLaMismaTabla) — el estilo de
//    celda (bordes+relleno+fuente) delimita la tabla igual que a simple vista. Ese crecimiento
//    desplaza hacia abajo todo lo que sigue en la misma hoja, espejo de LibroEdits.desplazamientoPara.
//  - Tablas jerárquicas / con agrupador / con columnas dinámicas: fuera de alcance todavía.
//
// Regla de no-destrucción, simétrica a la del writer ("celda vacía no toca el Excel"): una celda
// vacía en el Excel NO borra el valor que el ejemplo ya tuviera — en tablas se aplica CELDA POR
// CELDA (el dato del Excel gana solo donde existe; el resto de la fila conserva lo actual), y en
// columnas con subcolumnas (4.8) PARTE POR PARTE.

// Convierte lo leído del Excel al formato que guarda el campo según su tipo. Devuelve null cuando
// el contenido no es utilizable para ese tipo (se omite el campo en vez de guardar algo inválido).
// Fechas y años NO se convierten aquí: pasan siempre por lib/conversionesExcel.ts, que es el punto
// único donde vive la aritmética de seriales de Excel.
/**
 * ¿La fórmula es aritmética sobre números escritos a mano, sin leer ninguna otra celda?
 *
 * `=1872+1927+1989` no es un valor derivado: es un dato que alguien tecleó como suma por comodidad,
 * y su resultado no depende de nada más del libro. `=+Brecha!B15` o `=I9/I8` sí lo son.
 *
 * La distinción se hace por la presencia de letras: una referencia, un nombre de hoja o una función
 * siempre traen alguna; una cuenta entre números no.
 */
function esCalculoLiteral(formula: string): boolean {
  const sinTexto = formula.replace(/"[^"]*"/g, '');
  return /\d/.test(sinTexto) && /^[=+\-\s\d.,*/^()%]+$/.test(sinTexto);
}

/**
 * Valor de una celda para el volcado, o undefined si no hay nada que traer.
 *
 * Una celda cuya fórmula LEE OTRAS CELDAS no se vuelca: su valor lo produce el Excel, no es un dato
 * que alguien haya escrito. Copiarlo al JSON lo ensucia con un número derivado que además nunca se
 * reescribe, porque la inserción respeta las fórmulas.
 *
 * La excepción es la cuenta entre números literales (ver `esCalculoLiteral`): ahí el resultado ES el
 * dato. Se vuelca su valor, pero al insertar la celda se sigue respetando — así no se pierde el
 * desglose que su autor dejó escrito.
 *
 * La regla la decide LA CELDA, no cómo esté declarado el campo o la columna. Antes el volcado
 * miraba el tipo declarado (`calculado`, `editable`) mientras la pantalla y la inserción miraban la
 * fórmula: un campo puesto como "Texto corto" sobre una celda calculada se colaba igual.
 */
function celdaVolcable(libro: LibroLeido, hoja: string, ref: string): CeldaLeida | undefined {
  const formula = libro.formulaDe(hoja, ref);
  if (formula && !esCalculoLiteral(formula)) return undefined;
  return libro.celda(hoja, ref);
}

function valorParaCampo(campo: Campo, celda: CeldaLeida): string | null {
  const texto = celda.valor.trim();
  if (texto === '') return null;

  // Celda con formato de solo año ("yyyy"): interesa el año, no la fecha completa que codifica el
  // serial. Aplica sin importar cómo esté tipado el campo — el formato de la celda manda.
  if (celda.soloAnio) return aAnio(celda.valor, true);
  if (celda.esFecha) return aFechaISO(celda.valor, true);
  // Porcentaje: la celda guarda la fracción (0.011) y muestra 1.10%. Se guarda lo que se ve, igual
  // que con las fechas, que tampoco se guardan como el serial que trae el archivo.
  if (celda.esPorcentaje) return aPorcentaje(celda.valor, celda.decimales) ?? texto;

  switch (campo.tipo) {
    // 'booleano' NO se convierte: se guarda la palabra que trae el Excel ("Sí"), que es la misma
    // que ofrece su desplegable. Convertirla a 'true'/'false' obligaba a traducir en cada punto de
    // la UI y hacía que el valor no coincidiera con ninguna opción de la lista.
    case 'fecha':
      return aFechaISO(celda.valor, false) ?? texto;
    case 'numero':
    case 'decimal': {
      const n = Number(texto.replace(/\s/g, '').replace(',', '.'));
      return Number.isFinite(n) ? String(n) : texto; // texto no numérico se conserva tal cual
    }
    // La celda del Excel trae las coordenadas como texto suelto ("-13.5407619,   -71.923069").
    // Se normalizan a la forma canónica {lat,lng} que declara la convención, porque es la que
    // entiende el editor para pintar el mapa. Si el texto no es un par de coordenadas válido se
    // conserva tal cual, para no perder lo que el usuario haya escrito.
    case 'mapa_coordenadas': {
      const c = parseCoords(texto);
      return c ? serializarCoords(c) : texto;
    }
    default:
      return celda.valor; // texto_corto / texto_largo / catálogos: sin recortar, el original manda
  }
}

// Variante para celdas de tabla — mismos criterios, pero el tipo viene de la columna.
function valorParaColumna(tipo: TipoColumna, celda: CeldaLeida): string {
  const texto = celda.valor.trim();
  if (texto === '') return '';

  if (celda.soloAnio) return aAnio(celda.valor, true) ?? '';
  if (celda.esFecha) return aFechaISO(celda.valor, true) ?? '';
  if (celda.esPorcentaje) return aPorcentaje(celda.valor, celda.decimales) ?? texto;

  switch (tipo) {
    // 'booleano': igual que en valorParaCampo, se conserva el texto del Excel.
    case 'fecha':
      return aFechaISO(celda.valor, false) ?? texto;
    case 'numero':
    case 'decimal': {
      const n = Number(texto.replace(/\s/g, '').replace(',', '.'));
      return Number.isFinite(n) ? String(n) : texto;
    }
    default:
      return celda.valor;
  }
}

// --- Tablas ---

// Una tabla es legible si la estructura declara DÓNDE está en el Excel: fila inicial, cuántas filas
// reservó la plantilla oficial (`filasBase`) y al menos una columna mapeada. Eso alcanza para todos
// los subtipos —planas, agrupadas, jerárquicas, con columnas dinámicas—: la estructura ya es el
// mapa. La contrapartida deliberada es que solo se leen las `filasBase` declaradas; si el Excel
// tiene la tabla crecida, las filas de más no se leen (decisión del usuario: una cantidad fija de
// datos ya es ayuda suficiente). La excepción es la tabla plana simple, donde la detección de
// crecimiento por formato ya estaba hecha y probada, así que se conserva.
export function esTablaLegible(campo: Campo): boolean {
  if (campo.tipo !== 'tabla' && campo.tipo !== 'tabla_jerarquica') return false;
  const c = campo.configTabla;
  if (!c) return false;
  return (
    typeof c.captura?.filaInicial === 'number' &&
    typeof c.captura?.filasBase === 'number' &&
    c.captura.filasBase > 0 &&
    c.columnas.some((col) => columnasExcelDe(col).length > 0)
  );
}

// Tabla plana sin agrupador ni columnas dinámicas: la única que además detecta filas insertadas.
function esTablaPlanaSimple(config: ConfigTabla): boolean {
  return config.subtipo === 'filas_dinamicas' && !config.agrupador && !config.columnaDinamicaId;
}

// Tope de seguridad para la detección de filas insertadas: si el formato "no termina nunca"
// (plantillas con miles de filas pre-formateadas), no leemos el libro entero.
const MAX_FILAS_EXTRA = 300;

interface FilaLeida {
  valores: FilaDinamica;
  tieneDatos: boolean;
}

// Aritmética de letras de columna (A, B, ..., Z, AA...) — misma que en excelWriter.addCols.
function sumarColumnas(letra: string, delta: number): string {
  let n = 0;
  for (const ch of letra.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  n += delta;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out || letra;
}

// Letras de columna Excel que ocupa una columna lógica. Con subcolumnas (4.8) son varias — leer
// solo la del padre perdería las otras partes y las machacaría al fusionar.
function columnasExcelDe(col: ColumnaTabla): string[] {
  if (col.subcolumnas?.length) {
    return col.subcolumnas.map((s) => s.columnaExcel).filter((c): c is string => Boolean(c));
  }
  return col.columnaExcel ? [col.columnaExcel] : [];
}

// Lee una columna partida (4.8): cada parte desde su propia celda. La FORMA del resultado la decide
// el dato, igual que en el documento — si solo la primera parte trae algo, el Excel tenía la celda
// fusionada y devolvemos texto plano; si hay dato en otra parte, estaba partida y devolvemos objeto.
function leerCeldaPartida(libro: LibroLeido, hoja: string, col: ColumnaTabla, filaFisica: number): string | Record<string, string> {
  const partes: Record<string, string> = {};
  let algunaExtra = false;
  col.subcolumnas!.forEach((sub, i) => {
    const celda = sub.columnaExcel ? celdaVolcable(libro, hoja, `${sub.columnaExcel}${filaFisica}`) : undefined;
    const v = celda ? valorParaColumna(sub.tipo, celda) : '';
    partes[sub.id] = v;
    if (i > 0 && v !== '') algunaExtra = true;
  });
  if (algunaExtra) return partes;
  return partes[col.subcolumnas![0].id] ?? '';
}

// Columna que se repite por período: N celdas horizontales desde `columnaExcel`, cada una del ancho
// declarado — espejo exacto del bucle de writeFilaColumnas.
function leerCeldasPeriodos(
  libro: LibroLeido,
  hoja: string,
  col: ColumnaTabla,
  filaFisica: number,
  periodos: string[],
): string[] {
  const ancho = col.abarcaColumnasExcel ?? 1;
  return periodos.map((_, i) => {
    const letra = sumarColumnas(col.columnaExcel!, i * ancho);
    const celda = celdaVolcable(libro, hoja, `${letra}${filaFisica}`);
    return celda ? valorParaColumna(col.tipo, celda) : '';
  });
}

function leerFilaTabla(
  libro: LibroLeido,
  hoja: string,
  config: ConfigTabla,
  filaFisica: number,
  periodos: string[] = [],
): FilaLeida {
  const valores: FilaDinamica = {};
  let tieneDatos = false;
  for (const col of config.columnas) {
    // Columna calculada: se protege igual que un campo suelto calculado (ver el bucle de campos
    // simples). Su valor lo produce nuestra propia fórmula, así que traerse el número que Excel
    // dejó cacheado la convertiría en un dato muerto. Simétrico a la regla de escritura, donde
    // tampoco pisamos una celda que ya trae fórmula del libro.
    if (col.tipo === 'calculado' || col.formula) { valores[col.id] = ''; continue; }
    if (col.id === config.columnaDinamicaId && col.columnaExcel && periodos.length > 0) {
      const arr = leerCeldasPeriodos(libro, hoja, col, filaFisica, periodos);
      valores[col.id] = arr;
      if (arr.some((v) => v !== '')) tieneDatos = true;
      continue;
    }
    if (col.subcolumnas?.length) {
      const v = leerCeldaPartida(libro, hoja, col, filaFisica);
      valores[col.id] = v;
      if (typeof v === 'string' ? v !== '' : Object.values(v).some((p) => p !== '')) tieneDatos = true;
      continue;
    }
    if (!col.columnaExcel) { valores[col.id] = ''; continue; }
    const celda = celdaVolcable(libro, hoja, `${col.columnaExcel}${filaFisica}`);
    const v = celda ? valorParaColumna(col.tipo, celda) : '';
    valores[col.id] = v;
    if (v !== '') tieneDatos = true;
  }
  return { valores, tieneDatos };
}

// ¿La fila física pertenece a la misma tabla que las filas base? La respuesta la da el FORMATO:
// cada celda con dato debe usar un estilo ya visto en su columna dentro de las filas base (el
// índice de estilo encapsula bordes/relleno/fuente). La fila que sigue a la tabla (una "Nota:", el
// título de la siguiente subsección) rompe el patrón y corta la lectura. Verificado contra el
// Excel real: las filas de datos comparten estilos por columna; la Nota usa otros.
function esDeLaMismaTabla(
  libro: LibroLeido,
  hoja: string,
  cols: ColumnaTabla[],
  filaFisica: number,
  estilosBase: Map<string, Set<number>>,
): boolean {
  let coincidencias = 0;
  for (const col of cols) {
    // Una columna partida aporta el estilo de su PRIMERA parte: las demás pueden estar fusionadas
    // en unas filas y separadas en otras, así que su estilo no es un patrón estable.
    const letra = columnasExcelDe(col)[0];
    if (!letra) continue;
    const estilo = libro.estilo(hoja, `${letra}${filaFisica}`);
    const base = estilosBase.get(col.id);
    if (estilo === undefined || !base || base.size === 0) return false;
    if (!base.has(estilo)) return false;
    coincidencias++;
  }
  return coincidencias > 0;
}

interface TablaLeida {
  filas: FilaDinamica[];
  filasConDatos: number;
  filasExtra: number;
}

function leerTablaSimple(
  libro: LibroLeido,
  hoja: string,
  config: ConfigTabla,
  filaFisicaInicial: number,
  periodos: string[] = [],
  detectarCrecimiento = true,
): TablaLeida {
  const filasBase = config.captura!.filasBase!;
  const filas: FilaDinamica[] = [];
  let filasConDatos = 0;

  // Estilos por columna de las filas base — el "patrón visual" contra el que se comparan las
  // filas siguientes para decidir si son parte de la tabla.
  const estilosBase = new Map<string, Set<number>>();
  for (const col of config.columnas) {
    const letra = columnasExcelDe(col)[0];
    if (!letra) continue;
    const set = new Set<number>();
    for (let i = 0; i < filasBase; i++) {
      const estilo = libro.estilo(hoja, `${letra}${filaFisicaInicial + i}`);
      if (estilo !== undefined) set.add(estilo);
    }
    estilosBase.set(col.id, set);
  }

  for (let i = 0; i < filasBase; i++) {
    const fila = leerFilaTabla(libro, hoja, config, filaFisicaInicial + i, periodos);
    filas.push(fila.valores);
    if (fila.tieneDatos) filasConDatos++;
  }

  // Filas insertadas más allá de la base: siguen el mismo formato Y traen algún dato. Una fila
  // vacía con el formato correcto también corta — no hay forma de distinguirla del relleno
  // pre-formateado de la plantilla, y una tabla real llenada no deja huecos intermedios.
  let filasExtra = 0;
  while (detectarCrecimiento && filasExtra < MAX_FILAS_EXTRA) {
    const filaFisica = filaFisicaInicial + filasBase + filasExtra;
    if (!esDeLaMismaTabla(libro, hoja, config.columnas, filaFisica, estilosBase)) break;
    const fila = leerFilaTabla(libro, hoja, config, filaFisica, periodos);
    if (!fila.tieneDatos) break;
    filas.push(fila.valores);
    filasConDatos++;
    filasExtra++;
  }

  return { filas, filasConDatos, filasExtra };
}

// --- Tablas agrupadas (config.agrupador) ---

// Ancho físico en columnas de Excel que ocupan las primeras `n` columnas lógicas — espejo de
// anchoFisicoPrimerasColumnas en excelWriter, y con eso sabemos cuánto abarca la fila de título.
function anchoFisico(config: ConfigTabla, n: number, periodos: string[]): number {
  let total = 0;
  for (let i = 0; i < n && i < config.columnas.length; i++) {
    const col = config.columnas[i];
    const ancho = col.abarcaColumnasExcel ?? 1;
    total += col.id === config.columnaDinamicaId && periodos.length > 0 ? periodos.length * ancho : ancho;
  }
  return total;
}

interface TablaAgrupadaLeida {
  grupos: GrupoFilas[];
  filasConDatos: number;
}

// La fila de TÍTULO de un grupo se reconoce por su fusión horizontal: el escritor la fusiona sobre
// las primeras `agrupadorAbarcaColumnas` columnas, así que en el Excel esa celda arranca un rango
// de varias columnas. Una fila de datos normal no lo hace. Leer la fusión real (y no adivinar por
// "las demás celdas están vacías") es lo que hace determinista la separación grupo/dato.
function leerTablaAgrupada(
  libro: LibroLeido,
  hoja: string,
  config: ConfigTabla,
  filaFisicaInicial: number,
  periodos: string[],
): TablaAgrupadaLeida {
  const filasBase = config.captura!.filasBase!;
  const columnaInicial = config.captura?.columnaInicial ?? config.columnas[0]?.columnaExcel;
  const abarcaCabeceras = Math.min(config.agrupadorAbarcaColumnas ?? config.columnas.length, config.columnas.length);
  const minAncho = Math.max(anchoFisico(config, abarcaCabeceras, periodos), 2);

  const grupos: GrupoFilas[] = [];
  let filasConDatos = 0;

  for (let i = 0; i < filasBase; i++) {
    const row = filaFisicaInicial + i;
    const fusion = columnaInicial ? libro.fusion(hoja, `${columnaInicial}${row}`) : undefined;
    const esTitulo = Boolean(fusion && fusion.columnas >= minAncho);

    if (esTitulo) {
      const celda = celdaVolcable(libro, hoja, `${columnaInicial}${row}`);
      const titulo = celda ? celda.valor : '';
      // La fila de título también puede traer valores propios a la derecha de la fusión (grupos
      // "resumen" sin filas hijas) — se leen igual que una fila de datos y se guardan aparte.
      const propios = leerFilaTabla(libro, hoja, config, row, periodos);
      grupos.push({ grupo: titulo, filas: [], ...(propios.tieneDatos ? { valoresGrupo: propios.valores } : {}) });
      if (titulo !== '' || propios.tieneDatos) filasConDatos++;
      continue;
    }

    const fila = leerFilaTabla(libro, hoja, config, row, periodos);
    // Filas de datos antes de cualquier título: van a un grupo sin nombre, para no perderlas.
    if (grupos.length === 0) grupos.push({ grupo: '', filas: [] });
    grupos[grupos.length - 1].filas.push(fila.valores);
    if (fila.tieneDatos) filasConDatos++;
  }

  return { grupos, filasConDatos };
}

// --- Tablas jerárquicas ---

interface ArbolLeido {
  nodos: TreeNode[];
  filasConDatos: number;
}

/**
 * Rellena con los datos del Excel el árbol que la estructura YA declara, sin tocar su forma.
 *
 * Antes se reconstruía el árbol a partir de las fusiones verticales del Excel. Eso solo funciona
 * cuando la jerarquía está dibujada con celdas fusionadas; en una tabla con agrupador no lo está —
 * el título del grupo y sus ítems viven todos en la misma columna, como celdas sueltas, y quien
 * marca la jerarquía es la estructura, no el archivo. Ahí la lectura devolvía una lista plana de
 * hermanos y la fusión posicional posterior descolocaba grupos, ítems y datos.
 *
 * Ahora se recorre el árbol actual y, para cada nodo, se lee la celda que le toca según
 * `posicionesArbol` — la misma aritmética que usan el escritor y el editor, así que la celda que se
 * lee es exactamente la que se escribiría. El volcado solo rellena valores: nunca añade, quita ni
 * reordena filas ni grupos.
 */
function rellenarArbol(
  libro: LibroLeido,
  hoja: string,
  config: ConfigTabla,
  actuales: TreeNode[],
  filaInicial: number,
  periodos: string[],
): ArbolLeido {
  const agrupadorDepth = config.agrupador ? agrupadorProfundidad(config.columnas, config) : -1;
  const posiciones = posicionesArbol(actuales, config, hoja, filaInicial, agrupadorDepth, (h, columna, fila) =>
    (columna ? libro.fusion(h, `${columna}${fila}`)?.filas : undefined));
  let filasConDatos = 0;

  // Nivel calculado: su valor lo produce nuestra fórmula, no el número que Excel dejó cacheado.
  function leerColumna(col: ColumnaTabla | undefined, fila: number): string | string[] {
    if (!col || col.tipo === 'calculado' || col.formula) return '';
    if (col.id === config.columnaDinamicaId && col.columnaExcel && periodos.length > 0) {
      return leerCeldasPeriodos(libro, hoja, col, fila, periodos);
    }
    const letra = columnasExcelDe(col)[0];
    const celda = letra ? celdaVolcable(libro, hoja, `${letra}${fila}`) : undefined;
    return celda ? valorParaColumna(col.tipo ?? 'texto_corto', celda) : '';
  }

  // Una celda vacía del Excel conserva lo que el ejemplo ya tenía (los nombres de ítem que vienen
  // de la estructura base, o lo que el usuario haya tipeado en el editor).
  function conservando(leido: string | string[], previo: string | string[] | undefined): string | string[] | null {
    if (Array.isArray(leido)) {
      if (!leido.some((v) => v !== '')) return null;
      const antes = Array.isArray(previo) ? previo : [];
      return leido.map((v, k) => (v !== '' ? v : (antes[k] ?? '')));
    }
    return leido !== '' ? leido : null;
  }

  function recorrer(nodos: TreeNode[], path: number[]): TreeNode[] {
    return nodos.map((nodo, i) => {
      const ruta = [...path, i];
      const pos = posicionDe(posiciones, ruta);
      let value = nodo.value;
      const valores: FilaDinamica = { ...(nodo.valores ?? {}) };

      if (pos) {
        const col = config.columnas[pos.colIdx];
        const leido = conservando(leerColumna(col, pos.fila), nodo.value);
        if (leido !== null) {
          value = leido;
          filasConDatos++;
        }
        // Fila de título de grupo: las columnas libres a su derecha son celdas de datos de esa
        // misma fila, no de sus hijos.
        const esGrupo = agrupadorDepth >= 0 && ruta.length - 1 === agrupadorDepth && nodo.children.length > 0;
        if (esGrupo) {
          for (const otra of config.columnas) {
            if (otra.id === col?.id) continue;
            // Una celda partida (Record) no aplica a una fila de título: solo texto o períodos.
            const anterior = valores[otra.id];
            const previo = typeof anterior === 'string' || Array.isArray(anterior) ? anterior : undefined;
            const l = conservando(leerColumna(otra, pos.fila), previo);
            if (l !== null) {
              valores[otra.id] = l;
              filasConDatos++;
            }
          }
        }
      }

      return {
        value,
        children: recorrer(nodo.children, ruta),
        ...(Object.keys(valores).length > 0 ? { valores } : {}),
      };
    });
  }

  return { nodos: recorrer(actuales, []), filasConDatos };
}

// Fusión celda por celda con las filas que el ejemplo ya tenía: el dato del Excel gana solo donde
// existe; una celda vacía del Excel conserva el valor actual (ej. los N° 1..5 que vienen de la
// estructura base, o texto que el usuario ya había tipeado en el editor).
function fusionarFilas(actuales: FilaDinamica[], leidas: FilaDinamica[], config: ConfigTabla): FilaDinamica[] {
  const total = Math.max(actuales.length, leidas.length);
  const out: FilaDinamica[] = [];
  for (let i = 0; i < total; i++) {
    const actual = actuales[i] ?? {};
    const leida = leidas[i];
    if (!leida) { out.push(actual); continue; }
    const fila: FilaDinamica = {};
    for (const col of config.columnas) {
      const nuevo = leida[col.id];
      // Celda partida (4.8): la no-destrucción se aplica PARTE POR PARTE, no a la celda entera.
      if (esCeldaPartida(nuevo)) {
        const previo = esCeldaPartida(actual[col.id]) ? (actual[col.id] as Record<string, string>) : {};
        const partes: Record<string, string> = {};
        for (const sub of col.subcolumnas ?? []) {
          partes[sub.id] = nuevo[sub.id] !== '' && nuevo[sub.id] != null ? nuevo[sub.id] : (previo[sub.id] ?? '');
        }
        fila[col.id] = partes;
        continue;
      }
      // Columna dinámica: array de un valor por período — se fusiona período a período.
      if (Array.isArray(nuevo)) {
        const previo = Array.isArray(actual[col.id]) ? (actual[col.id] as string[]) : [];
        fila[col.id] = nuevo.map((v, k) => (v !== '' ? v : (previo[k] ?? '')));
        continue;
      }
      fila[col.id] = typeof nuevo === 'string' && nuevo !== '' ? nuevo : (actual[col.id] ?? '');
    }
    out.push(fila);
  }
  return out;
}

// Misma regla, grupo a grupo: el nombre del grupo y cada fila hija se fusionan por separado.
function fusionarGrupos(actuales: GrupoFilas[], leidos: GrupoFilas[], config: ConfigTabla): GrupoFilas[] {
  const total = Math.max(actuales.length, leidos.length);
  const out: GrupoFilas[] = [];
  for (let i = 0; i < total; i++) {
    const actual = actuales[i];
    const leido = leidos[i];
    if (!leido) { if (actual) out.push(actual); continue; }
    const propiosLeidos = leido.valoresGrupo;
    const propiosActuales = actual?.valoresGrupo;
    out.push({
      grupo: leido.grupo !== '' ? leido.grupo : (actual?.grupo ?? ''),
      filas: fusionarFilas(actual?.filas ?? [], leido.filas, config),
      ...(propiosLeidos || propiosActuales
        ? { valoresGrupo: fusionarFilas(propiosActuales ? [propiosActuales] : [], propiosLeidos ? [propiosLeidos] : [], config)[0] ?? {} }
        : {}),
    });
  }
  return out;
}

function parseFilasActuales(raw: string | undefined): FilaDinamica[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) && (p.length === 0 || (!('value' in p[0]) && !('filas' in p[0])))) return p as FilaDinamica[];
  } catch { /* el valor actual no era JSON de filas — se ignora */ }
  return [];
}

function parseGruposActuales(raw: string | undefined): GrupoFilas[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) && p.length > 0 && 'filas' in p[0]) return p as GrupoFilas[];
  } catch { /* no era JSON de grupos */ }
  return [];
}

// --- Recorrido del documento ---

export interface OpcionesVolcado {
  /** Leer campos simples (texto, número, fecha, booleano…) */
  camposSimples: boolean;
  /** Leer tablas — todos los subtipos, siempre acotado a las `filasBase` declaradas */
  tablas: boolean;
  /** Leer las imágenes incrustadas de los campos tipo `imagen`. Requiere `subirImagen`: el valor
   * que se guarda en el JSON es una URL, nunca el binario. */
  imagenes: boolean;
  /** Sube la imagen y devuelve su URL, o null si no se pudo (formato no convertible, red, etc.).
   * Se inyecta desde fuera para que esta librería no dependa de la capa de API. */
  subirImagen?: (img: ImagenIncrustada, nombre: string) => Promise<string | null>;
  /** Ids de las secciones a incluir — las demás no se tocan */
  seccionesIds: Set<string>;
  /** Valores actuales del ejemplo — base de la fusión celda a celda en tablas */
  valoresActuales: Record<string, string>;
}

export interface ResultadoVolcado {
  /** Valores listos para fusionar con los del ejemplo, por identificador de campo */
  valores: Record<string, string>;
  /** Campos simples que sí traían dato en el Excel */
  camposLeidos: number;
  /** Campos simples cuya celda estaba vacía — no se tocan */
  camposVacios: number;
  /** Tablas leídas (con al menos una celda con dato) */
  tablasLeidas: number;
  /** Filas con datos encontradas entre todas las tablas leídas */
  filasTablaLeidas: number;
  /** Filas insertadas detectadas más allá de las filas base (crecimiento) */
  filasExtraDetectadas: number;
  /** Campos tabla sin posición declarada en la estructura — no hay dónde leer */
  tablasOmitidas: number;
  /** Hojas que la plantilla declara pero el Excel no tiene (nombres cambiados, otro archivo) */
  hojasFaltantes: string[];
  /** Imágenes extraídas del Excel y subidas, cuya URL quedó en `valores` */
  imagenesLeidas: number;
  /** Imágenes encontradas que no se pudieron traer, con el motivo (ej. "2.03.01 (emf)") */
  imagenesOmitidas: string[];
}

const TIPOS_TABLA: TipoCampo[] = ['tabla', 'tabla_jerarquica'];

interface Tarea { seccion: Seccion; campo: Campo }

export async function leerValoresDeExcel(
  dataUrl: string,
  plantilla: Plantilla,
  opciones?: Partial<OpcionesVolcado>,
): Promise<ResultadoVolcado> {
  const ops: OpcionesVolcado = {
    camposSimples: opciones?.camposSimples ?? true,
    tablas: opciones?.tablas ?? false,
    imagenes: opciones?.imagenes ?? false,
    subirImagen: opciones?.subirImagen,
    seccionesIds: opciones?.seccionesIds ?? new Set(plantilla.secciones.map((s) => s.id)),
    valoresActuales: opciones?.valoresActuales ?? {},
  };

  const libro = await leerLibroXlsx(dataUrl);
  const hojasDelLibro = new Set(libro.hojas);

  const resultado: ResultadoVolcado = {
    valores: {},
    camposLeidos: 0,
    camposVacios: 0,
    tablasLeidas: 0,
    filasTablaLeidas: 0,
    filasExtraDetectadas: 0,
    tablasOmitidas: 0,
    hojasFaltantes: [],
    imagenesLeidas: 0,
    imagenesOmitidas: [],
  };

  // Tareas de las secciones seleccionadas, agrupadas por hoja: las tablas de una hoja se procesan
  // primero y en orden (para conocer los crecimientos), después los campos simples con su
  // desplazamiento aplicado — espejo de las dos pasadas de insertarValoresEnExcel.
  const tareasPorHoja = new Map<string, Tarea[]>();
  const hojasFaltantes = new Set<string>();
  for (const seccion of plantilla.secciones) {
    if (!ops.seccionesIds.has(seccion.id)) continue;
    if (!seccion.hoja) continue;
    if (!hojasDelLibro.has(seccion.hoja)) { hojasFaltantes.add(seccion.hoja); continue; }
    const lista = tareasPorHoja.get(seccion.hoja) ?? [];
    for (const sub of seccion.subsecciones) for (const campo of sub.campos) lista.push({ seccion, campo });
    tareasPorHoja.set(seccion.hoja, lista);
  }
  resultado.hojasFaltantes = Array.from(hojasFaltantes);

  for (const [hoja, tareas] of tareasPorHoja) {
    // Crecimientos detectados en esta hoja, en coordenadas de la plantilla original:
    // todo lo que esté debajo de una tabla crecida se lee más abajo de donde la estructura dice.
    const crecimientos: { despuesDeFila: number; cantidad: number }[] = [];
    const shift = (filaOriginal: number) =>
      crecimientos.reduce((total, c) => (c.despuesDeFila < filaOriginal ? total + c.cantidad : total), 0);

    // 1) Tablas, en orden de aparición en la hoja
    const tablas = tareas
      .filter((t) => TIPOS_TABLA.includes(t.campo.tipo))
      .sort((a, b) => (a.campo.configTabla?.captura?.filaInicial ?? 0) - (b.campo.configTabla?.captura?.filaInicial ?? 0));

    for (const { campo } of tablas) {
      if (!ops.tablas || !esTablaLegible(campo)) { resultado.tablasOmitidas++; continue; }
      const config = campo.configTabla!;
      const filaOriginal = config.captura!.filaInicial!;
      const filaFisica = filaOriginal + shift(filaOriginal);
      const periodos = getPeriodos(config);
      const raw = ops.valoresActuales[campo.identificador] ?? campo.valorEjemplo;

      // Jerárquica: la forma la dicta la estructura, no el Excel. Solo se rellenan los valores.
      if (esJerarquica(config.subtipo)) {
        const actuales = parseTree(raw ?? '', config.columnas, config);
        const lectura = rellenarArbol(libro, hoja, config, actuales, filaFisica, periodos);
        if (lectura.filasConDatos === 0) continue;
        resultado.valores[campo.identificador] = JSON.stringify(lectura.nodos);
        resultado.tablasLeidas++;
        resultado.filasTablaLeidas += lectura.filasConDatos;
        continue;
      }

      // Agrupada: las filas de título se reconocen por su fusión horizontal.
      if (config.agrupador) {
        const lectura = leerTablaAgrupada(libro, hoja, config, filaFisica, periodos);
        if (lectura.filasConDatos === 0) continue;
        resultado.valores[campo.identificador] = JSON.stringify(fusionarGrupos(parseGruposActuales(raw), lectura.grupos, config));
        resultado.tablasLeidas++;
        resultado.filasTablaLeidas += lectura.filasConDatos;
        continue;
      }

      // Plana (con o sin columnas dinámicas). Solo la variante simple detecta filas insertadas.
      const lectura = leerTablaSimple(libro, hoja, config, filaFisica, periodos, esTablaPlanaSimple(config));
      if (lectura.filasExtra > 0) {
        crecimientos.push({ despuesDeFila: filaOriginal + config.captura!.filasBase! - 1, cantidad: lectura.filasExtra });
        resultado.filasExtraDetectadas += lectura.filasExtra;
      }
      if (lectura.filasConDatos === 0) continue; // tabla vacía en el Excel: no tocar nada

      resultado.valores[campo.identificador] = JSON.stringify(fusionarFilas(parseFilasActuales(raw), lectura.filas, config));
      resultado.tablasLeidas++;
      resultado.filasTablaLeidas += lectura.filasConDatos;
    }

    // 2) Imágenes incrustadas. No se resuelven por celda: el binario vive en xl/media y su
    // posición se declara en xl/drawings, así que se busca el anclaje que cubre la FILA del campo.
    if (ops.imagenes && ops.subirImagen) {
      const conImagen = tareas.filter((t) => t.campo.tipo === 'imagen' && t.campo.editable && t.campo.captura?.fila);
      if (conImagen.length > 0) {
        const incrustadas = await leerImagenesDeHoja(libro.zip, hoja);
        for (const { campo } of conImagen) {
          const fila = campo.captura!.fila! + shift(campo.captura!.fila!);
          const img = imagenParaFila(incrustadas, fila);
          if (!img) continue; // sin imagen en esa fila: no se toca el valor actual

          const url = await ops.subirImagen(img, `${campo.identificador}.${img.formato}`);
          if (url === null) {
            resultado.imagenesOmitidas.push(`${campo.identificador} (${img.formato})`);
            continue;
          }
          resultado.valores[campo.identificador] = url;
          resultado.imagenesLeidas++;
        }
      }
    }

    // 3) Campos simples, con el desplazamiento acumulado de las tablas crecidas de arriba
    if (!ops.camposSimples) continue;
    for (const { campo } of tareas) {
      if (TIPOS_TABLA.includes(campo.tipo)) continue;
      // Las imágenes ya se resolvieron arriba, por anclaje y no por celda.
      if (campo.tipo === 'imagen') continue;
      // Un campo calculado guarda su fórmula (ej. "=6.01.10-6.01.01"), no un dato tecleado:
      // sobrescribirlo con el número que Excel dejó cacheado rompería el cálculo.
      if (campo.tipo === 'calculado' || !campo.editable) continue;
      if (!campo.captura?.columna || !campo.captura.fila) continue;

      const fila = campo.captura.fila + shift(campo.captura.fila);
      const celda = celdaVolcable(libro, hoja, `${campo.captura.columna}${fila}`);
      if (!celda) { resultado.camposVacios++; continue; }

      const valor = valorParaCampo(campo, celda);
      if (valor === null) { resultado.camposVacios++; continue; }

      resultado.valores[campo.identificador] = valor;
      resultado.camposLeidos++;
    }
  }

  return resultado;
}
