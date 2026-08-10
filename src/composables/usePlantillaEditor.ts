import { type Ref, computed, provide, ref, watch } from 'vue';
import { usePlantillaQuery, useActualizarPlantilla } from '@/composables/usePlantillas';
import { useEjemplosByPlantillaQuery, useCrearEjemplo, useActualizarEjemplo, useEliminarEjemplo } from '@/composables/useEjemplos';
import { useCatalogoExcelQuery } from '@/composables/useArchivosExcel';
import { useExcelEjemploQuery, useSetExcelEjemplo } from '@/composables/useExcelEjemplos';
import { generateId } from '@/api/mock/_shared';
import { excelEjemplosApi } from '@/api/excelEjemplos';
import { contarCamposSinCaptura } from '@/lib/campoValidation';
import { buildDocumento } from '@/lib/schemaExport';
import { insertarValoresEnExcel, type AvisoLista } from '@/lib/excelWriter';
import { usePushActividad } from '@/composables/useActividad';
import { useExcelVivo, useAltoDeBloqueExcel, EXCEL_VIVO } from '@/composables/useListasExcel';
import { mensajeAvisoListas } from '@/lib/xlsxListas';
import { parseDynamicRows, parseGroupedRows, parseTree, esJerarquica, esCeldaPartida, valorSubcolumna, agrupadorProfundidad, posicionesArbol, posicionesGrupos, posicionDe, type AltoDeBloque, type FilaDinamica, type TreeNode } from '@/lib/tableRowHelpers';
import { useAutoguardado } from '@/composables/useAutoguardado';
import { useUiStore } from '@/stores/ui';
import type { VersionTab, Campo, ConfigTabla, Plantilla, Ejemplo, Seccion, TipologiaIoarr } from '@/types';

const MIN_LEFT = 180;
const MIN_RIGHT = 300;
const MIN_EXAMPLES = 220;
const DEFAULT_LEFT = 260;
const DEFAULT_RIGHT = 420;
const DEFAULT_EXAMPLES = 300;

// `structuredClone` no puede clonar los Proxies reactivos de Vue — `toRaw()` solo desenvuelve el
// nivel superior, no los objetos anidados (secciones[].campos[].configTabla, etc). Como todo el
// dato de Plantilla es JSON-seguro (es justo lo que se persiste), un round-trip JSON clona
// profundamente sin toparse con Proxies.
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// Celdas de las tablas, para que el cálculo en vivo pueda usarlas como entrada: la Localización de
// la sección 1 se construye a partir del UBIGEO, que vive en una columna de la tabla 3.03.01, y el
// "%" de la 4.01.02 divide dos celdas de su propia columna Cantidad.
//
// La fila de Excel de cada dato SIEMPRE sale de la misma función que usan el editor y el escritor
// (`posicionesArbol`, `posicionesGrupos`, o la cuenta directa en las planas). Si se calculara aquí
// aparte, la celda que alimenta la fórmula y la celda donde acaba el dato podrían no ser la misma.

/**
 * Una fila de datos -> celdas del Excel.
 *
 * Una columna partida (convención 4.8) aporta UNA CELDA POR PARTE, cada una con su propia letra:
 * en la 4.01.02 la columna "%" ocupa J y K, y sin desdoblarla el texto de la derecha se indexaba
 * sobre J —la celda que el Excel calcula— o no se indexaba en absoluto.
 */
function indexarFila(
  mapa: Map<string, string>,
  hoja: string,
  config: ConfigTabla,
  fila: FilaDinamica,
  filaExcel: number,
): void {
  for (const col of config.columnas) {
    const valor = fila[col.id];
    if (col.subcolumnas?.length && esCeldaPartida(valor)) {
      for (const sub of col.subcolumnas) {
        const texto = valorSubcolumna(valor, sub.id);
        if (sub.columnaExcel && texto !== '') mapa.set(`${hoja}!${sub.columnaExcel}${filaExcel}`, texto);
      }
      continue;
    }
    if (col.columnaExcel && typeof valor === 'string' && valor !== '') {
      mapa.set(`${hoja}!${col.columnaExcel}${filaExcel}`, valor);
    }
  }
}

/**
 * Celdas de una tabla AGRUPADA. La fila de título de un grupo es una fila del Excel más y puede
 * llevar datos propios; un bloque sin título no consume ninguna. Antes estas tablas se saltaban
 * enteras —se daba por hecho que ninguna fórmula dependía de ellas— y por eso las celdas calculadas
 * de la 4.01.02 salían siempre en blanco: la fórmula se detectaba, pero sus operandos nunca llegaban.
 */
function indexarCeldasAgrupadas(
  mapa: Map<string, string>,
  hoja: string,
  campo: Campo,
  valorCrudo: string,
  altoDeBloque: AltoDeBloque,
): void {
  const config = campo.configTabla;
  const filaInicial = config?.captura?.filaInicial;
  if (!config || !filaInicial) return;

  const grupos = parseGroupedRows(valorCrudo, config);
  const primera = config.columnas.find((c) => c.columnaExcel)?.columnaExcel;
  const posiciones = posicionesGrupos(grupos, filaInicial, (fila) =>
    Math.max(altoDeBloque(hoja, primera, fila) ?? 1, 1),
  );

  grupos.forEach((grupo, gi) => {
    const pos = posiciones[gi];
    if (!pos) return;
    if (pos.filaTitulo !== null && grupo.valoresGrupo) {
      indexarFila(mapa, hoja, config, grupo.valoresGrupo as FilaDinamica, pos.filaTitulo);
    }
    grupo.filas.forEach((fila, ri) => {
      const filaExcel = pos.filas[ri];
      if (filaExcel) indexarFila(mapa, hoja, config, fila, filaExcel);
    });
  });
}

// Celdas de una tabla JERÁRQUICA. La fila de cada nodo sale de `posicionesArbol` — la misma función
// que usan el escritor y el editor — para que el valor que se teclea alimente exactamente la celda
// que el Excel va a leer en su fórmula. Sin esto, una columna calculada como "Total = Cantidad ×
// Costo" siempre daba 0: la fórmula se detectaba, pero sus operandos nunca llegaban.
function indexarCeldasJerarquicas(
  mapa: Map<string, string>,
  hoja: string,
  campo: Campo,
  valorCrudo: string,
  altoDeBloque: AltoDeBloque,
): void {
  const config = campo.configTabla;
  const filaInicial = config?.captura?.filaInicial;
  if (!config || !filaInicial) return;

  const roots = parseTree(valorCrudo, config.columnas, config);
  const agrupadorDepth = config.agrupador ? agrupadorProfundidad(config.columnas, config) : -1;
  const posiciones = posicionesArbol(roots, config, hoja, filaInicial, agrupadorDepth, altoDeBloque);

  function recorrer(node: TreeNode, path: number[]): void {
    const pos = posicionDe(posiciones, path);
    if (pos) {
      const col = config!.columnas[pos.colIdx];
      if (col?.columnaExcel && typeof node.value === 'string' && node.value !== '') {
        mapa.set(`${hoja}!${col.columnaExcel}${pos.fila}`, node.value);
      }
      // Fila de título de un grupo: sus columnas libres a la derecha también son celdas de datos.
      for (const [colId, valor] of Object.entries(node.valores ?? {})) {
        const libre = config!.columnas.find((c) => c.id === colId);
        if (libre?.columnaExcel && typeof valor === 'string' && valor !== '') {
          mapa.set(`${hoja}!${libre.columnaExcel}${pos.fila}`, valor);
        }
      }
    }
    node.children.forEach((hijo, i) => recorrer(hijo, [...path, i]));
  }

  roots.forEach((raiz, i) => recorrer(raiz, [i]));
}

function indexarCeldasDeTabla(mapa: Map<string, string>, hoja: string, campo: Campo, valorCrudo: string, altoDeBloque: AltoDeBloque): void {
  const config = campo.configTabla;
  const filaInicial = config?.captura?.filaInicial;
  if (!config || !filaInicial) return;

  if (esJerarquica(config.subtipo)) {
    indexarCeldasJerarquicas(mapa, hoja, campo, valorCrudo, altoDeBloque);
    return;
  }
  // El agrupador se comprueba antes que el subtipo: una tabla agrupada sigue siendo `filas_dinamicas`
  // pero su valor es una lista de grupos, no de filas.
  if (config.agrupador) {
    indexarCeldasAgrupadas(mapa, hoja, campo, valorCrudo, altoDeBloque);
    return;
  }
  if (config.subtipo !== 'filas_dinamicas') return;

  const filas = parseDynamicRows(valorCrudo, config);
  filas.forEach((fila, i) => indexarFila(mapa, hoja, config, fila, filaInicial + i));
}

// Toda la lógica de edición de estructura y de autoría de ejemplos (tab Ejemplos) de
// PlantillaEditPage.vue — separada del componente para mantenerlo bajo el límite de 200 líneas
// (ver CLAUDE.md).
export function usePlantillaEditor(plantillaId: Ref<string>) {
  const { data: plantillaOriginal } = usePlantillaQuery(plantillaId);
  const actualizarPlantilla = useActualizarPlantilla();
  const { data: ejemplosData } = useEjemplosByPlantillaQuery(plantillaId);
  const crearEjemplo = useCrearEjemplo();
  const actualizarEjemplo = useActualizarEjemplo();
  const eliminarEjemplo = useEliminarEjemplo();
  const { data: catalogoExcel } = useCatalogoExcelQuery(plantillaId);
  const setExcelEjemplo = useSetExcelEjemplo();
  const pushActividad = usePushActividad();
  const ui = useUiStore();

  const editData = ref<Plantilla | null>(null) as Ref<Plantilla | null>;
  // Solo se hidrata al cargar por primera vez o al cambiar de plantilla. Un refetch de la MISMA
  // plantilla NO puede pisar lo que se está editando: guardar invalida la consulta, así que con
  // autoguardado la respuesta llegaría a media escritura y borraría lo tecleado entretanto.
  watch(plantillaOriginal, (p) => {
    if (!p || (editData.value && editData.value.id === p.id)) return;
    editData.value = deepClone(p);
  }, { immediate: true });

  const activeTab = ref<VersionTab>('estructura');
  const activeSectionIndex = ref(0);
  const selectedCampo = ref<Campo | null>(null) as Ref<Campo | null>;
  const isNewCampo = ref(false);
  const editingHojaSeccionId = ref<string | null>(null);
  const leftWidth = ref(DEFAULT_LEFT);
  const rightWidth = ref(DEFAULT_RIGHT);
  const examplesWidth = ref(DEFAULT_EXAMPLES);
  const highlightMissingCaptura = ref(false);
  const jsonPreview = ref<{ title: string; json: string } | null>(null);
  const showImportEstructura = ref(false);

  const ejemplos = computed(() => ejemplosData.value ?? []);
  const ejemplosCount = computed(() => ejemplos.value.length);
  const activeEjemplo = ref<Ejemplo | null>(null) as Ref<Ejemplo | null>;
  const editedValores = ref<Record<string, string>>({});
  const showNuevoEjemplo = ref(false);
  const deleteTarget = ref<Ejemplo | null>(null) as Ref<Ejemplo | null>;
  const volcarTarget = ref<Ejemplo | null>(null) as Ref<Ejemplo | null>;
  /** Volcado en la versión Estructura: el origen es el Excel asignado y el destino son los valores
   * por defecto de la plantilla, no los de un ejemplo. */
  const volcarEstructura = ref(false);
  const showExcelCatalogModal = ref(false);
  const showPreview = ref(false);
  const showInsertConfirm = ref(false);
  const isInserting = ref(false);
  const insertProgress = ref(0);
  /** Valores que no coincidieron con las opciones del desplegable de su celda en la última inserción */
  const avisosListas = ref<AvisoLista[]>([]);

  const archivoExcelAsignado = computed(() => {
    const catalogo = catalogoExcel.value;
    return catalogo?.archivos.find((a) => a.id === catalogo.asignadoId) ?? null;
  });
  const { data: excelEjemploActivo } = useExcelEjemploQuery(computed(() => activeEjemplo.value?.id ?? null));

  const fuenteExcel = computed(() => archivoExcelAsignado.value?.dataUrl ?? null);
  // Se pide antes que el servicio de cálculo porque ubicar las filas de una tabla jerárquica ya
  // necesita saber cuánto mide cada bloque fusionado. Comparte caché con `useExcelVivo`: mismo
  // archivo, una sola descarga.
  const altoDeBloque = useAltoDeBloqueExcel(fuenteExcel);

  // Entradas del cálculo en vivo, indexadas por la celda a la que apunta cada campo. En Estructura
  // son los valores por defecto de la plantilla; en Ejemplos son los del ejemplo activo tal como se
  // están editando, para que las fórmulas del Excel se recalculen mientras se escribe.
  const valoresPorCelda = computed(() => {
    if (!editData.value) return null;
    const enEjemplos = activeTab.value === 'ejemplos';
    const valores = editedValores.value;
    const mapa = new Map<string, string>();
    for (const sec of editData.value.secciones) {
      if (!sec.hoja) continue;
      for (const sub of sec.subsecciones) {
        for (const campo of sub.campos) {
          // Mismo criterio que FieldCard.displayValue: manda lo tecleado en el ejemplo y, si ahí no
          // hay nada, se cae al valor por defecto de la estructura.
          const crudo = (enEjemplos ? valores[campo.identificador] : undefined) ?? campo.valorEjemplo ?? '';
          const cap = campo.captura;
          if (cap?.columna && cap.fila) {
            mapa.set(`${sec.hoja}!${cap.columna}${cap.fila}`, crudo);
            continue;
          }
          indexarCeldasDeTabla(mapa, sec.hoja, campo, crudo, altoDeBloque.value);
        }
      }
    }
    return mapa;
  });

  // Se lee el Excel del catálogo (no la copia del ejemplo): es el mismo archivo en cuanto a opciones
  // y fórmulas, pero no cambia al insertar valores, así que la caché sigue válida toda la sesión.
  // Se comparte con las tarjetas de campo por inject.
  provide(EXCEL_VIVO, useExcelVivo(fuenteExcel, valoresPorCelda));
  const previewFileUrl = computed(
    () => (showExamples.value && activeEjemplo.value ? excelEjemploActivo.value?.dataUrl : undefined) ?? archivoExcelAsignado.value?.dataUrl ?? null,
  );
  const previewFileName = computed(
    () => (showExamples.value && activeEjemplo.value ? excelEjemploActivo.value?.nombre : undefined) ?? archivoExcelAsignado.value?.nombre,
  );

  function getDefaultValores(): Record<string, string> {
    if (!editData.value) return {};
    const defaults: Record<string, string> = {};
    for (const sec of editData.value.secciones) {
      for (const sub of sec.subsecciones) {
        for (const campo of sub.campos) {
          if (campo.valorEjemplo) defaults[campo.identificador] = campo.valorEjemplo;
        }
      }
    }
    return defaults;
  }

  // Igual que con la plantilla: recargar los valores solo al CAMBIAR de ejemplo. Guardar reemplaza
  // `activeEjemplo` por un objeto nuevo con los valores ya persistidos, y sin esta guarda ese
  // reemplazo devolvería el editor a lo guardado, perdiendo lo escrito durante la petición.
  let ejemploCargadoId: string | null = null;
  watch(activeEjemplo, (ej) => {
    if (ej && ej.id === ejemploCargadoId) return;
    ejemploCargadoId = ej?.id ?? null;
    editedValores.value = ej?.valores && Object.keys(ej.valores).length > 0 ? { ...ej.valores } : getDefaultValores();
  });
  watch(ejemplos, (list) => {
    if (!activeEjemplo.value && list.length > 0) activeEjemplo.value = list[0];
  });

  function handleExampleValueChange(identificador: string, value: string) {
    editedValores.value = { ...editedValores.value, [identificador]: value };
  }

  async function handleCreateExample(nombre: string, subtitulo: string, detalle: string, tipologiasIoarr?: TipologiaIoarr[]) {
    if (!archivoExcelAsignado.value) return; // NuevoEjemploModal ya bloquea la creación sin Excel asignado
    const nuevo: Ejemplo = { id: generateId(), nombre, subtitulo, detalle, plantillaId: plantillaId.value, activo: false, valores: {}, tipologiasIoarr, estado: 'archivado' };
    // El id que se manda es solo un provisional: el backend asigna el suyo (autoincremental) y
    // devuelve el ejemplo ya creado. Hay que quedarse con ESE — usar el provisional hacía que la
    // copia del Excel se pidiera contra un id inexistente (404) y que el ejemplo activo apuntara a
    // algo que no existe, así que ni se copiaba el archivo ni se guardaban después sus valores.
    const creado = await crearEjemplo.mutateAsync(nuevo);
    activeEjemplo.value = creado;
    editedValores.value = {};

    // Copia propia del Excel asignado a la plantilla
    await setExcelEjemplo.mutateAsync({
      ejemploId: creado.id,
      archivo: { id: generateId(), nombre: archivoExcelAsignado.value.nombre, dataUrl: archivoExcelAsignado.value.dataUrl, fechaSubida: new Date().toLocaleDateString('es-PE') },
    });

    await pushActividad.mutateAsync({ mensaje: `Nuevo ejemplo "${nombre}" creado`, color: 'green' });
    ui.toast(`Ejemplo "${nombre}" creado — completa los valores`);
  }

  function handleToggleEjemploEstado(ejemplo: Ejemplo) {
    const nuevoEstado = ejemplo.estado === 'publicado' ? 'archivado' : 'publicado';
    actualizarEjemplo.mutate({ id: ejemplo.id, data: { estado: nuevoEstado } });
    if (activeEjemplo.value?.id === ejemplo.id) activeEjemplo.value = { ...ejemplo, estado: nuevoEstado };
    ui.toast(nuevoEstado === 'publicado' ? `Ejemplo "${ejemplo.nombre}" publicado` : `Ejemplo "${ejemplo.nombre}" movido a borrador`);
  }

  async function handleDownloadExcel(ejemplo: Ejemplo) {
    const archivo = await excelEjemplosApi.get(ejemplo.id);
    if (!archivo) { ui.toast('Este ejemplo no tiene una copia de Excel asociada', 'error'); return; }
    const a = document.createElement('a');
    a.href = archivo.dataUrl;
    a.download = archivo.nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handlePreviewExample(ejemplo: Ejemplo) {
    activeEjemplo.value = ejemplo;
    showPreview.value = true;
  }

  function handleVolcarExcel(ejemplo: Ejemplo) {
    activeEjemplo.value = ejemplo;
    volcarTarget.value = ejemplo;
  }

  // Volcado de la versión Estructura: no hay archivo que elegir — se lee el Excel que la ficha tiene
  // asignado desde el principio, que es el mismo que define qué celdas son de teclear. Al leerse a sí
  // mismo, toda celda con fórmula queda fuera por la regla de siempre: el molde no debe guardar
  // números que el Excel calcula.
  function handleVolcarEstructura() {
    if (!archivoExcelAsignado.value) return;
    volcarEstructura.value = true;
  }

  // Los valores leídos del Excel se fusionan sobre los actuales, no los reemplazan: lo que el Excel
  // no trae (celdas vacías, y todas las tablas) conserva lo que el ejemplo ya tenía. Queda como
  // edición pendiente igual que cualquier cambio manual — se persiste al guardar.
  function handleConfirmarVolcado(valores: Record<string, string>) {
    const aEstructura = volcarEstructura.value;
    volcarTarget.value = null;
    volcarEstructura.value = false;
    const n = Object.keys(valores).length;

    // En Estructura el destino es el VALOR POR DEFECTO de cada campo (`valorEjemplo`), que es el
    // molde de la plantilla; en Ejemplos, los valores del ejemplo activo. La lectura del Excel es la
    // misma en ambos casos: solo cambia dónde aterriza.
    if (aEstructura) {
      mutate((p) => {
        for (const sec of p.secciones) {
          for (const sub of sec.subsecciones) {
            for (const campo of sub.campos) {
              const valor = valores[campo.identificador];
              if (valor !== undefined) campo.valorEjemplo = valor;
            }
          }
        }
      });
      // El panel de propiedades muestra una copia del campo seleccionado: sin refrescarla seguiría
      // enseñando el valor anterior hasta volver a seleccionarlo.
      if (selectedCampo.value) {
        const actualizado = editData.value?.secciones
          .flatMap((s) => s.subsecciones)
          .flatMap((s) => s.campos)
          .find((c) => c.id === selectedCampo.value!.id);
        if (actualizado) selectedCampo.value = { ...actualizado };
      }
      ui.toast(`${n} ${n === 1 ? 'campo volcado' : 'campos volcados'} al valor por defecto — recuerda guardar`);
      return;
    }

    editedValores.value = { ...editedValores.value, ...valores };
    ui.toast(`${n} ${n === 1 ? 'campo volcado' : 'campos volcados'} desde el Excel — recuerda guardar`);
  }

  async function handleInsertExcel() {
    if (!editData.value || !activeEjemplo.value || !archivoExcelAsignado.value) return;
    const archivo = excelEjemploActivo.value;
    if (!archivo) { ui.toast('Este ejemplo no tiene una copia de Excel asociada', 'error'); showInsertConfirm.value = false; return; }
    isInserting.value = true;
    insertProgress.value = 0;
    avisosListas.value = [];
    try {
      // Siempre se inserta sobre el Excel original del catálogo (no sobre la copia ya insertada
      // del ejemplo) — insertar dos veces sobre la copia ya modificada duplicaría las filas
      // insertadas por tablas que crecen más allá de sus filas base.
      const nuevaDataUrl = await insertarValoresEnExcel(
        archivoExcelAsignado.value.dataUrl,
        editData.value,
        editedValores.value,
        (fraction) => { insertProgress.value = Math.round(fraction * 100); },
        (avisos) => { avisosListas.value = avisos; },
      );
      await setExcelEjemplo.mutateAsync({ ejemploId: activeEjemplo.value.id, archivo: { ...archivo, dataUrl: nuevaDataUrl } });
      await pushActividad.mutateAsync({ mensaje: `Se insertaron los valores del ejemplo "${activeEjemplo.value.nombre}" en su Excel`, color: 'blue' });
      ui.toast('Valores insertados en el Excel del ejemplo');
      // El aviso llega aparte y en rojo: la inserción sí se hizo, pero conviene revisar esos valores.
      const aviso = mensajeAvisoListas(avisosListas.value);
      if (aviso) {
        ui.toast(aviso, 'error');
        console.warn('[listas] valores fuera de las opciones del Excel:', avisosListas.value);
      }
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'No se pudo insertar los valores en el Excel', 'error');
    } finally {
      isInserting.value = false;
      showInsertConfirm.value = false;
    }
  }

  async function handleDeleteEjemplo() {
    if (!deleteTarget.value) return;
    const target = deleteTarget.value;
    await eliminarEjemplo.mutateAsync(target.id);
    if (activeEjemplo.value?.id === target.id) {
      const restantes = ejemplos.value.filter((e) => e.id !== target.id);
      activeEjemplo.value = restantes[0] ?? null;
    }
    await pushActividad.mutateAsync({ mensaje: `Se eliminó el ejemplo "${target.nombre}"`, color: 'orange' });
    ui.toast(`Ejemplo "${target.nombre}" eliminado`);
    deleteTarget.value = null;
  }

  function handleLeftResize(d: number) { leftWidth.value = Math.max(MIN_LEFT, leftWidth.value + d); }
  function handleRightResize(d: number) { rightWidth.value = Math.max(MIN_RIGHT, rightWidth.value - d); }
  function handleExamplesResize(d: number) { examplesWidth.value = Math.max(MIN_EXAMPLES, examplesWidth.value + d); }

  function handleTabChange(tab: VersionTab) {
    activeTab.value = tab;
    selectedCampo.value = null;
    isNewCampo.value = false;
  }

  const secciones = computed(() => editData.value?.secciones ?? []);
  const safeIdx = computed(() => Math.min(activeSectionIndex.value, secciones.value.length - 1));
  const seccionActiva = computed(() => secciones.value[safeIdx.value]);
  const isFirst = computed(() => safeIdx.value === 0);
  const isLast = computed(() => safeIdx.value === secciones.value.length - 1);
  const showExamples = computed(() => activeTab.value === 'ejemplos');

  function handleSectionSelect(seccionId: string) {
    const idx = secciones.value.findIndex((s) => s.id === seccionId);
    if (idx !== -1) { activeSectionIndex.value = idx; selectedCampo.value = null; isNewCampo.value = false; }
  }
  function goToPrevSection() { activeSectionIndex.value = Math.max(0, activeSectionIndex.value - 1); }
  function goToNextSection() { activeSectionIndex.value = Math.min(secciones.value.length - 1, activeSectionIndex.value + 1); }

  function mutate(fn: (p: Plantilla) => void) {
    if (!editData.value) return;
    const next = deepClone(editData.value);
    fn(next);
    editData.value = next;
  }

  function handleFieldUpdate(campoId: string, updates: Partial<Campo>) {
    mutate((p) => {
      for (const sec of p.secciones) {
        const campo = sec.subsecciones.flatMap((s) => s.campos).find((c) => c.id === campoId);
        if (campo) { Object.assign(campo, updates); break; }
      }
    });
    if (selectedCampo.value?.id === campoId) selectedCampo.value = { ...selectedCampo.value, ...updates };
  }

  /**
   * Siguiente identificador libre de una subsección: el mayor de sus campos más uno.
   *
   * Nunca se renumera lo que ya existe, aunque el campo entre en medio: los identificadores son la
   * clave de los valores de cada ejemplo y de las fórmulas de los campos calculados, así que
   * cambiarlos rompería datos ya guardados.
   */
  function siguienteIdentificador(campos: Campo[], subseccionCodigo: string): string {
    let maxN = 0;
    let ancho = 1;
    for (const c of campos) {
      const ultimo = c.identificador.split('.').pop() ?? '';
      const n = Number(ultimo);
      if (!Number.isFinite(n)) continue;
      maxN = Math.max(maxN, n);
      // Se respeta el cero a la izquierda de los hermanos: un campo nuevo entre 1.01.03 y
      // 1.01.04 debe ser 1.01.09, no 1.01.9.
      ancho = Math.max(ancho, ultimo.trim().length);
    }
    return `${subseccionCodigo}.${String(maxN + 1).padStart(ancho, '0')}`;
  }

  /** Código de la subsección a la que pertenece un identificador: "08.06.2" -> "08.06". */
  function codigoDeSubseccion(identificador: string): string {
    return identificador.split('.').slice(0, -1).join('.');
  }

  /** `despuesDeCampoId` coloca el campo nuevo justo detrás de ese; sin él, al final de la subsección. */
  function handleAddCampo(subseccionId: string, subseccionCodigo: string, despuesDeCampoId?: string) {
    const nuevoId = generateId();
    let nuevoCampo: Campo | null = null;
    mutate((p) => {
      for (const sec of p.secciones) {
        const sub = sec.subsecciones.find((s) => s.id === subseccionId);
        if (sub) {
          nuevoCampo = { id: nuevoId, identificador: siguienteIdentificador(sub.campos, subseccionCodigo), etiqueta: 'Nuevo campo', tipo: 'texto_corto', editable: true, descripcion: '' };
          const idx = despuesDeCampoId ? sub.campos.findIndex((c) => c.id === despuesDeCampoId) : -1;
          if (idx >= 0) sub.campos.splice(idx + 1, 0, nuevoCampo);
          else sub.campos.push(nuevoCampo);
          sec.cantidadCampos += 1;
          break;
        }
      }
    });
    if (nuevoCampo) { selectedCampo.value = nuevoCampo; isNewCampo.value = true; }
    ui.toast('Campo agregado');
  }

  /**
   * Copia exacta de un campo justo debajo del original, con el siguiente identificador libre de su
   * subsección (duplicar 08.06.2 da 08.06.3).
   *
   * Se copia TODO lo demás tal cual: etiqueta, tipo, descripción, captura y —si es tabla— su
   * configuración completa y su valor por defecto. Los ids internos de las columnas se conservan a
   * propósito: son claves dentro del propio campo (`columnaDinamicaId`, `encadenaA`, las cabeceras y
   * las filas del valor), así que regenerarlos obligaría a reescribir el valor entero para no
   * romperlo. Al vivir dentro de un solo campo, dos campos pueden compartirlos sin interferirse.
   */
  function handleDuplicarCampo(campoId: string, subseccionId: string) {
    const nuevoId = generateId();
    let copia: Campo | null = null;
    mutate((p) => {
      for (const sec of p.secciones) {
        const sub = sec.subsecciones.find((s) => s.id === subseccionId);
        if (!sub) continue;
        const idx = sub.campos.findIndex((c) => c.id === campoId);
        if (idx < 0) continue;
        const original = sub.campos[idx];
        copia = {
          ...deepClone(original),
          id: nuevoId,
          identificador: siguienteIdentificador(sub.campos, sub.codigo || codigoDeSubseccion(original.identificador)),
        };
        sub.campos.splice(idx + 1, 0, copia);
        sec.cantidadCampos += 1;
        break;
      }
    });
    if (!copia) return;
    // Se selecciona la copia (no como "campo nuevo": ya viene configurada, no hay nada que rellenar).
    selectedCampo.value = copia;
    isNewCampo.value = false;
    ui.toast(`Campo duplicado como ${(copia as Campo).identificador}`);
  }

  function handleDeleteCampo(campoId: string, subseccionId: string) {
    mutate((p) => {
      for (const sec of p.secciones) {
        const sub = sec.subsecciones.find((s) => s.id === subseccionId);
        if (sub) {
          sub.campos = sub.campos.filter((c) => c.id !== campoId);
          sec.cantidadCampos = sec.subsecciones.reduce((sum, s) => sum + s.campos.length, 0);
          break;
        }
      }
    });
    if (selectedCampo.value?.id === campoId) selectedCampo.value = null;
  }

  function handleSectionNameChange(seccionId: string, nombre: string) {
    mutate((p) => { const sec = p.secciones.find((s) => s.id === seccionId); if (sec) sec.nombre = nombre; });
  }
  function handleSectionHojaChange(seccionId: string, hoja: string) {
    mutate((p) => { const sec = p.secciones.find((s) => s.id === seccionId); if (sec) sec.hoja = hoja; });
  }
  function handleSubsectionNameChange(subseccionId: string, nombre: string) {
    mutate((p) => { for (const sec of p.secciones) { const sub = sec.subsecciones.find((s) => s.id === subseccionId); if (sub) { sub.nombre = nombre; break; } } });
  }
  function handleSubseccionAyudaChange(subseccionId: string, ayuda: string) {
    mutate((p) => { for (const sec of p.secciones) { const sub = sec.subsecciones.find((s) => s.id === subseccionId); if (sub) { sub.ayuda = ayuda; break; } } });
  }
  function handleAddSubsection(seccionId: string) {
    mutate((p) => {
      const sec = p.secciones.find((s) => s.id === seccionId);
      if (sec) {
        const num = String(sec.subsecciones.length + 1).padStart(2, '0');
        sec.subsecciones.push({ id: generateId(), codigo: `${sec.numero}.${num}`, nombre: 'NUEVA SUBSECCIÓN', campos: [] });
      }
    });
    ui.toast('Subsección agregada');
  }
  function handleDeleteSubsection(subseccionId: string, seccionId: string) {
    mutate((p) => {
      const sec = p.secciones.find((s) => s.id === seccionId);
      if (sec && sec.subsecciones.length > 1) {
        const sub = sec.subsecciones.find((s) => s.id === subseccionId);
        sec.subsecciones = sec.subsecciones.filter((s) => s.id !== subseccionId);
        if (sub) sec.cantidadCampos -= sub.campos.length;
      }
    });
  }
  function handleAddSection() {
    const nuevoIndex = secciones.value.length;
    mutate((p) => {
      const num = String(p.secciones.length + 1).padStart(2, '0');
      p.secciones.push({ id: generateId(), numero: num, nombre: 'Nueva sección', cantidadCampos: 0, subsecciones: [{ id: generateId(), codigo: `${num}.01`, nombre: 'SUBSECCIÓN', campos: [] }] });
      p.cantidadSecciones = p.secciones.length;
    });
    activeSectionIndex.value = nuevoIndex;
    ui.toast('Sección agregada');
  }

  /** Resto de un id/código con puntos, sin su primer segmento: "12.01.3" -> "01.3". */
  function sinPrimerSegmento(id: string): string {
    return id.split('.').slice(1).join('.');
  }

  /**
   * Copia completa de una sección al final de la lista — nunca a continuación de la original, ni
   * renumerando las demás. El numero nuevo es siempre el mayor numero de sección existente más uno
   * (duplicar la sección 5 con secciones hasta la 12 da 13, igual que duplicar la propia 12).
   *
   * Todo lo que cuelga de la sección (subsecciones, campos, configTabla, valores) se copia tal cual
   * — solo se reescribe el primer segmento de cada `codigo`/`identificador` para que apunte al numero
   * nuevo (12.01 -> 13.01, 12.01.3 -> 13.01.3); el resto del path no cambia. Los ids internos de las
   * columnas de tabla se conservan igual que en `handleDuplicarCampo`, por la misma razón: son claves
   * que solo viven dentro de su propio campo.
   */
  function handleDuplicarSeccion(seccionId: string) {
    const nuevoIndex = secciones.value.length;
    mutate((p) => {
      const original = p.secciones.find((s) => s.id === seccionId);
      if (!original) return;
      const maxNumero = p.secciones.reduce((max, s) => Math.max(max, Number(s.numero) || 0), 0);
      const nuevoNumero = String(maxNumero + 1).padStart(2, '0');

      const copia = deepClone(original);
      copia.id = generateId();
      copia.numero = nuevoNumero;
      for (const sub of copia.subsecciones) {
        sub.id = generateId();
        sub.codigo = `${nuevoNumero}.${sinPrimerSegmento(sub.codigo)}`;
        for (const campo of sub.campos) {
          campo.id = generateId();
          campo.identificador = `${nuevoNumero}.${sinPrimerSegmento(campo.identificador)}`;
        }
      }
      p.secciones.push(copia);
      p.cantidadSecciones = p.secciones.length;
    });
    activeSectionIndex.value = nuevoIndex;
    ui.toast('Sección duplicada');
  }

  function handleImportEstructura(secciones: Seccion[]) {
    mutate((p) => {
      p.secciones = secciones;
      p.cantidadSecciones = secciones.length;
    });
    activeSectionIndex.value = 0;
    selectedCampo.value = null;
    isNewCampo.value = false;
    ui.toast(`Estructura reemplazada — ${secciones.length} secciones importadas`);
  }

  // --- Persistencia ---
  //
  // La estructura pesa ~95 KB y el ejemplo activo unos pocos; casi nunca cambian a la vez. Por eso
  // cada parte lleva su propia huella y solo se manda la que de verdad cambió: escribir valores en
  // un ejemplo no reenvía la plantilla entera cada dos segundos.
  let estructuraGuardada: string | null = null;
  let ejemploGuardado: string | null = null;

  const huellaEstructura = () => (editData.value ? JSON.stringify(editData.value) : null);
  const huellaEjemplo = () =>
    activeTab.value === 'ejemplos' && activeEjemplo.value ? JSON.stringify(editedValores.value) : null;

  /** Manda al servidor lo que haya cambiado. Sin toasts ni registro de actividad: eso es cosa del
   * botón Guardar, que el autoguardado no debe imitar. */
  async function persistir() {
    if (!editData.value) return;

    const estructura = huellaEstructura();
    if (estructura !== null && estructura !== estructuraGuardada) {
      const fechaActualizacion = new Date().toLocaleDateString('es-PE');
      await actualizarPlantilla.mutateAsync({ id: editData.value.id, data: { ...editData.value, fechaActualizacion } });
      estructuraGuardada = estructura;
    }

    const ejemplo = huellaEjemplo();
    if (ejemplo !== null && ejemplo !== ejemploGuardado && activeEjemplo.value) {
      const valores = { ...editedValores.value };
      await actualizarEjemplo.mutateAsync({ id: activeEjemplo.value.id, data: { valores } });
      activeEjemplo.value = { ...activeEjemplo.value, valores };
      ejemploGuardado = ejemplo;
    }
  }

  const autoguardado = useAutoguardado({
    huella: () => {
      const e = huellaEstructura();
      if (e === null) return null;
      return `${e} ${huellaEjemplo() ?? ''}`;
    },
    guardar: persistir,
  });

  async function handleSave() {
    if (!editData.value) return;
    await persistir();
    autoguardado.marcarGuardado();

    await pushActividad.mutateAsync({ mensaje: `Se guardó la plantilla ${editData.value.codigo} — ${editData.value.nombre}`, color: 'blue' });

    const sinCaptura = contarCamposSinCaptura(editData.value);
    if (sinCaptura > 0) {
      ui.toast(`Guardado, pero ${sinCaptura} campo${sinCaptura === 1 ? '' : 's'} no ${sinCaptura === 1 ? 'tiene' : 'tienen'} registrada su posición en el Excel`, 'error');
      highlightMissingCaptura.value = true;
      setTimeout(() => { highlightMissingCaptura.value = false; }, 2500);
    } else {
      ui.toast(`Plantilla "${editData.value.codigo}" guardada`);
    }
  }

  function handleViewJson() {
    if (!editData.value) return;
    if (activeTab.value === 'ejemplos' && activeEjemplo.value) {
      const doc = buildDocumento(editData.value, 'ejemplo', { ...activeEjemplo.value, valores: editedValores.value });
      jsonPreview.value = { title: `${editData.value.codigo} — Ejemplo: ${activeEjemplo.value.nombre}`, json: JSON.stringify(doc, null, 2) };
    } else {
      const doc = buildDocumento(editData.value, 'estructura');
      jsonPreview.value = { title: `${editData.value.codigo} — Estructura`, json: JSON.stringify(doc, null, 2) };
    }
  }

  return {
    estadoGuardado: autoguardado.estado,
    editData, activeTab, activeSectionIndex, selectedCampo, isNewCampo, editingHojaSeccionId,
    leftWidth, rightWidth, examplesWidth, highlightMissingCaptura, ejemplosCount, jsonPreview,
    showImportEstructura,
    secciones, safeIdx, seccionActiva, isFirst, isLast, showExamples,
    ejemplos, activeEjemplo, editedValores, showNuevoEjemplo, deleteTarget, volcarTarget, volcarEstructura,
    archivoExcelAsignado, showExcelCatalogModal, showPreview, showInsertConfirm, isInserting, insertProgress,
    previewFileUrl, previewFileName,
    handleLeftResize, handleRightResize, handleExamplesResize, handleTabChange, handleSectionSelect,
    goToPrevSection, goToNextSection, handleFieldUpdate, handleAddCampo, handleDuplicarCampo, handleDeleteCampo,
    handleSectionNameChange, handleSectionHojaChange, handleSubsectionNameChange,
    handleSubseccionAyudaChange, handleAddSubsection, handleDeleteSubsection, handleAddSection, handleDuplicarSeccion,
    handleExampleValueChange, handleCreateExample, handleDeleteEjemplo, handleToggleEjemploEstado,
    handleDownloadExcel, handlePreviewExample, handleInsertExcel,
    handleVolcarExcel, handleVolcarEstructura, handleConfirmarVolcado, getDefaultValores,
    handleImportEstructura,
    handleSave, handleViewJson,
  };
}
