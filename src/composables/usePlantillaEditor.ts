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
import { useExcelVivo, useAltoDeBloqueExcel, EXCEL_VIVO, type ModoCalculoExcel } from '@/composables/useListasExcel';
import { useMapaValoresExcelDebounced, type ResolverValorCampo } from '@/composables/useMapaValoresExcelDebounced';
import { mensajeAvisoListas } from '@/lib/xlsxListas';
import { useAutoguardado } from '@/composables/useAutoguardado';
import { useUiStore } from '@/stores/ui';
import type { VersionTab, Campo, Plantilla, Ejemplo, Seccion, TipologiaIoarr } from '@/types';

/** live = escribe al Excel vivo al editar; confirmar = borrador hasta pulsar Confirmar en el campo */
export type ModoEdicionEditor = 'live' | 'confirmar';

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
  // true = el ejemplo tiene ediciones que todavía no se insertaron en su copia de Excel — editar un
  // campo (live o al confirmar un borrador) lo marca desactualizado; "Insertar" lo vuelve a poner
  // al día. Es indicador de sesión, no se persiste: al cambiar de ejemplo se reinicia con su carga.
  const excelDesactualizado = ref(false);
  // Baselines del autoguardado — se declaran pronto porque el watch de carga de ejemplo las escribe.
  let estructuraGuardada: string | null = null;
  let ejemploGuardado: string | null = null;
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

  // Selector "Caché / Tiempo real" del editor (junto al botón de importar JSON) — por ficha, guardado
  // en localStorage para que la elección sobreviva a recargar la página. 'cache' es el default: es el
  // comportamiento normal desde que se agregó el caché de listas/fórmulas del Excel. 'tiempo_real' es
  // la vía de escape manual si se sospecha que el caché muestra algo desactualizado en una ficha
  // puntual — vuelve exactamente al cálculo desde cero que había antes.
  const MODO_CALCULO_KEY_PREFIX = 'pf_modo_calculo_excel_';
  const modoCalculo = ref<ModoCalculoExcel>('cache');
  watch(plantillaId, (id) => {
    const guardado = localStorage.getItem(MODO_CALCULO_KEY_PREFIX + id);
    modoCalculo.value = guardado === 'tiempo_real' ? 'tiempo_real' : 'cache';
  }, { immediate: true });
  function setModoCalculo(modo: ModoCalculoExcel) {
    modoCalculo.value = modo;
    localStorage.setItem(MODO_CALCULO_KEY_PREFIX + plantillaId.value, modo);
  }

  // Modo de edición de valores: 'live' escribe al instante (Excel vivo + autoguardado); 'confirmar'
  // guarda borradores por campo hasta que el usuario pulse Confirmar — varios campos pueden quedar
  // pendientes a la vez. Por ficha, en localStorage.
  const MODO_EDICION_KEY_PREFIX = 'pf_modo_edicion_';
  const modoEdicion = ref<ModoEdicionEditor>('live');
  /** Borradores pendientes en modo confirmar — clave = campo.id */
  const borradoresPorCampo = ref<Record<string, string>>({});
  watch(plantillaId, (id) => {
    const guardado = localStorage.getItem(MODO_EDICION_KEY_PREFIX + id);
    modoEdicion.value = guardado === 'confirmar' ? 'confirmar' : 'live';
    borradoresPorCampo.value = {};
  }, { immediate: true });
  function setModoEdicion(modo: ModoEdicionEditor) {
    modoEdicion.value = modo;
    localStorage.setItem(MODO_EDICION_KEY_PREFIX + plantillaId.value, modo);
    // Al volver a live se descartan borradores: no se confirman solos (evitar sorpresa de calc masivo).
    if (modo === 'live') borradoresPorCampo.value = {};
  }
  function limpiarBorradores() {
    borradoresPorCampo.value = {};
  }
  function setBorradorCampo(campoId: string, value: string, valorConfirmado: string) {
    if (value === (valorConfirmado || '')) {
      if (!(campoId in borradoresPorCampo.value)) return;
      const next = { ...borradoresPorCampo.value };
      delete next[campoId];
      borradoresPorCampo.value = next;
      return;
    }
    borradoresPorCampo.value = { ...borradoresPorCampo.value, [campoId]: value };
  }
  function confirmarBorradorCampo(campoId: string, identificador: string) {
    if (!(campoId in borradoresPorCampo.value)) return;
    const value = borradoresPorCampo.value[campoId];
    const next = { ...borradoresPorCampo.value };
    delete next[campoId];
    borradoresPorCampo.value = next;
    if (activeTab.value === 'ejemplos') {
      handleExampleValueChange(identificador, value);
    } else {
      handleFieldUpdate(campoId, { valorEjemplo: value });
    }
  }
  function handleUpdateDefaultValue(campoId: string, value: string) {
    if (modoEdicion.value === 'confirmar') {
      const campo = editData.value?.secciones
        .flatMap((s) => s.subsecciones)
        .flatMap((s) => s.campos)
        .find((c) => c.id === campoId);
      setBorradorCampo(campoId, value, campo?.valorEjemplo || '');
      return;
    }
    handleFieldUpdate(campoId, { valorEjemplo: value });
  }
  function handleUpdateExampleValue(campoId: string, identificador: string, value: string) {
    if (modoEdicion.value === 'confirmar') {
      const confirmado = Object.prototype.hasOwnProperty.call(editedValores.value, identificador)
        ? (editedValores.value[identificador] ?? '')
        : (editData.value?.secciones
            .flatMap((s) => s.subsecciones)
            .flatMap((s) => s.campos)
            .find((c) => c.id === campoId)?.valorEjemplo || '');
      setBorradorCampo(campoId, value, confirmado);
      return;
    }
    handleExampleValueChange(identificador, value);
  }

  // Entradas del cálculo en vivo. Se reindexan con debounce: indexar Anexo 2 entero en cada
  // persist de tabla trababa el hilo principal; las fórmulas/listas pueden ir ~300 ms detrás.
  const excelMapTrigger = ref(0);
  const resolverValorExcel = computed<ResolverValorCampo>(() => {
    const enEjemplos = activeTab.value === 'ejemplos';
    const valores = editedValores.value;
    return (identificador, valorEjemplo) =>
      (enEjemplos ? valores[identificador] : undefined) ?? valorEjemplo ?? '';
  });
  const valoresPorCelda = useMapaValoresExcelDebounced(
    editData,
    altoDeBloque,
    resolverValorExcel,
    excelMapTrigger,
    300,
  );

  // Se lee el Excel del catálogo (no la copia del ejemplo): es el mismo archivo en cuanto a opciones
  // y fórmulas, pero no cambia al insertar valores, así que la caché sigue válida toda la sesión.
  // Se comparte con las tarjetas de campo por inject.
  const excelVivo = useExcelVivo(fuenteExcel, valoresPorCelda, modoCalculo);
  provide(EXCEL_VIVO, excelVivo);

  // Sincroniza `tipo`/`editable` con lo que el Excel asignado dice de verdad: si la celda de captura
  // de un campo tiene fórmula pero el campo no está declarado `calculado`, se corrige solo. Sin esto
  // el `tipo` puede quedar desactualizado (ej. un campo `texto_corto` cuya celda en realidad es un
  // VLOOKUP) y arrastra el error a todo lo que confía en `tipo` para decidir qué NO llenar
  // automáticamente (LlenadoIAController, la guía de contexto por campo). La detección en sí sigue
  // siendo 100% en vivo (se reevalúa cada vez que cambia la estructura o el Excel asignado); lo único
  // que cambia es que el resultado se escribe en la estructura en vez de vivir solo en la UI.
  watch([excelVivo, editData], ([excel, data]) => {
    if (!excel || !data) return;
    const esCorregible = (campo: Campo) =>
      campo.tipo !== 'nota' && campo.tipo !== 'calculado' && campo.tipo !== 'tabla' && campo.tipo !== 'tabla_jerarquica';
    const tieneFormula = (hoja: string, campo: Campo) => {
      const cap = campo.captura;
      if (!cap?.columna || !cap.fila) return false;
      return excel.calculado(hoja, `${cap.columna}${cap.fila}`) !== undefined;
    };
    const hayCambios = data.secciones.some(
      (sec) => sec.hoja && sec.subsecciones.some((sub) => sub.campos.some((c) => esCorregible(c) && tieneFormula(sec.hoja!, c))),
    );
    if (!hayCambios) return;

    let corregidos = 0;
    mutate((p) => {
      for (const sec of p.secciones) {
        if (!sec.hoja) continue;
        for (const sub of sec.subsecciones) {
          for (const campo of sub.campos) {
            if (esCorregible(campo) && tieneFormula(sec.hoja, campo)) {
              campo.tipo = 'calculado';
              campo.editable = false;
              corregidos++;
            }
          }
        }
      }
    });
    ui.toast(`${corregidos} ${corregidos === 1 ? 'campo' : 'campos'} detectado${corregidos === 1 ? '' : 's'} como calculado por el Excel — se marcó automáticamente`);
  });
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
          if (campo.tipo === 'nota') continue; // su texto vive solo en campo.valorEjemplo, no en el ejemplo
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
    // Baseline del ejemplo recién cargado: no es un cambio del usuario.
    ejemploGuardado = ej ? JSON.stringify(editedValores.value) : null;
    excelDesactualizado.value = false;
    limpiarBorradores();
    queueMicrotask(() => autoguardado.marcarGuardado());
  });
  // `immediate: true` — sin esto, si `ejemplos` ya trae datos en el momento en que este watch se
  // registra (la consulta resolvió más rápido de lo esperado), el watch nunca ve el cambio de "sin
  // datos" a "con datos" y `activeEjemplo` se queda en null aunque la pestaña ya esté en "ejemplos".
  // Eso rompía "Ver JSON" en silencio: caía a mostrar el documento de Estructura sin avisar.
  watch(ejemplos, (list) => {
    if (!activeEjemplo.value && list.length > 0) activeEjemplo.value = list[0];
  }, { immediate: true });

  function handleExampleValueChange(identificador: string, value: string) {
    editedValores.value = { ...editedValores.value, [identificador]: value };
    excelDesactualizado.value = true;
    excelMapTrigger.value++;
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
    excelDesactualizado.value = true;
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
      excelDesactualizado.value = false;
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
    // Estructura y Ejemplos escriben en sitios distintos; no mezclar borradores entre tabs.
    limpiarBorradores();
    excelMapTrigger.value++;
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
    excelMapTrigger.value++;
  }

  /** Solo `valorEjemplo`: mutación in-place (sin deepClone de toda la plantilla). */
  function actualizarSoloValorEjemplo(campoId: string, valorEjemplo: string | undefined) {
    if (!editData.value) return;
    for (const sec of editData.value.secciones) {
      for (const sub of sec.subsecciones) {
        const campo = sub.campos.find((c) => c.id === campoId);
        if (!campo) continue;
        campo.valorEjemplo = valorEjemplo;
        if (selectedCampo.value?.id === campoId) {
          selectedCampo.value = { ...selectedCampo.value, valorEjemplo };
        }
        excelMapTrigger.value++;
        return;
      }
    }
  }

  function handleFieldUpdate(campoId: string, updates: Partial<Campo>) {
    const keys = Object.keys(updates);
    if (keys.length === 1 && keys[0] === 'valorEjemplo') {
      actualizarSoloValorEjemplo(campoId, updates.valorEjemplo);
      return;
    }
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
   * Una nota (4.11) no es un campo real de la ficha: no tiene identificador (no cuenta para la
   * numeración de sus hermanos ni para `cantidadCampos`) ni captura en Excel. Su texto vive en
   * `valorEjemplo`, igual que un texto_largo, y se edita una sola vez desde Estructura — se muestra
   * tal cual al cliente, no es un valor que él llene por ejemplo.
   */
  function handleAddNota(subseccionId: string, despuesDeCampoId?: string) {
    const nuevoId = generateId();
    let nuevaNota: Campo | null = null;
    mutate((p) => {
      for (const sec of p.secciones) {
        const sub = sec.subsecciones.find((s) => s.id === subseccionId);
        if (sub) {
          nuevaNota = { id: nuevoId, identificador: '', etiqueta: '', tipo: 'nota', editable: true, valorEjemplo: '' };
          const idx = despuesDeCampoId ? sub.campos.findIndex((c) => c.id === despuesDeCampoId) : -1;
          if (idx >= 0) sub.campos.splice(idx + 1, 0, nuevaNota);
          else sub.campos.push(nuevaNota);
          break;
        }
      }
    });
    if (nuevaNota) { selectedCampo.value = nuevaNota; isNewCampo.value = true; }
    ui.toast('Nota agregada');
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
        const esNota = original.tipo === 'nota';
        copia = {
          ...deepClone(original),
          id: nuevoId,
          identificador: esNota ? '' : siguienteIdentificador(sub.campos, sub.codigo || codigoDeSubseccion(original.identificador)),
        };
        sub.campos.splice(idx + 1, 0, copia);
        if (!esNota) sec.cantidadCampos += 1;
        break;
      }
    });
    if (!copia) return;
    // Se selecciona la copia (no como "campo nuevo": ya viene configurada, no hay nada que rellenar).
    selectedCampo.value = copia;
    isNewCampo.value = false;
    const identificadorCopia = (copia as Campo).identificador;
    ui.toast(identificadorCopia ? `Campo duplicado como ${identificadorCopia}` : 'Nota duplicada');
  }

  function handleDeleteCampo(campoId: string, subseccionId: string) {
    mutate((p) => {
      for (const sec of p.secciones) {
        const sub = sec.subsecciones.find((s) => s.id === subseccionId);
        if (sub) {
          sub.campos = sub.campos.filter((c) => c.id !== campoId);
          sec.cantidadCampos = sec.subsecciones.reduce((sum, s) => sum + s.campos.filter((c) => c.tipo !== 'nota').length, 0);
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
  // (estructuraGuardada / ejemploGuardado están declarados arriba, junto a editedValores.)

  const huellaEstructura = () => (editData.value ? JSON.stringify(editData.value) : null);
  // La huella del ejemplo NO depende del tab activo: si al entrar/salir de Ejemplos cambiara,
  // el autoguardado creería que hay ediciones y mandaría el JSON entero (tablas de cientos de
  // filas) solo por cambiar de pestaña — "Guardando…" eterno.
  const huellaEjemplo = () =>
    activeEjemplo.value ? JSON.stringify(editedValores.value) : null;

  watch(
    editData,
    (d) => {
      if (!d) return;
      if (estructuraGuardada === null) estructuraGuardada = JSON.stringify(d);
    },
    { immediate: true },
  );

  /** Manda al servidor lo que haya cambiado. Sin toasts ni registro de actividad: eso es cosa del
   * botón Guardar, que el autoguardado no debe imitar. */
  async function persistir() {
    if (!editData.value) return;

    const estructura = huellaEstructura();
    if (estructura !== null && estructura !== estructuraGuardada) {
      // ISO `Y-m-d`: la columna DATE de PostgreSQL rechaza `d/m/Y` de toLocaleDateString('es-PE')
      // (ej. "14/8/2026") y el PUT de plantilla fallaba — bloqueando también el guardado del ejemplo.
      const fechaActualizacion = new Date().toISOString().slice(0, 10);
      await actualizarPlantilla.mutateAsync({ id: editData.value.id, data: { ...editData.value, fechaActualizacion } });
      editData.value = { ...editData.value, fechaActualizacion };
      estructuraGuardada = huellaEstructura();
    }

    const ejemplo = huellaEjemplo();
    if (ejemplo !== null && ejemplo !== ejemploGuardado && activeEjemplo.value) {
      const valores = { ...editedValores.value };
      await actualizarEjemplo.mutateAsync({ id: activeEjemplo.value.id, data: { valores } });
      // Misma id → el watch de carga no reinicia editedValores (guarda ejemploCargadoId).
      activeEjemplo.value = { ...activeEjemplo.value, valores };
      ejemploGuardado = ejemplo;
    }
  }

  const autoguardado = useAutoguardado({
    huella: () => {
      const e = huellaEstructura();
      if (e === null) return null;
      return `${e}\0${activeEjemplo.value?.id ?? ''}\0${huellaEjemplo() ?? ''}`;
    },
    guardar: persistir,
  });

  async function handleSave() {
    if (!editData.value) return;
    try {
      await persistir();
      autoguardado.marcarGuardado();
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
      return;
    }

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

  // Para el documento exportado ("Ver JSON"): el valor que el Excel calcularía en esa celda, con
  // los datos que se estén viendo ahora mismo (mismo cómputo que ya muestra la tarjeta del campo).
  // Nunca decide qué se escribe al insertar — eso lo protege excelWriter.ts mirando la celda real.
  function celdaCalculada(hoja: string, campo: Campo): string | undefined {
    const excel = excelVivo.value;
    const cap = campo.captura;
    if (!excel || !hoja || !cap?.columna || !cap.fila) return undefined;
    return excel.calculado(hoja, `${cap.columna}${cap.fila}`)?.texto || undefined;
  }

  function handleViewJson() {
    if (!editData.value) return;
    if (activeTab.value === 'ejemplos' && activeEjemplo.value) {
      const doc = buildDocumento(editData.value, 'ejemplo', { ...activeEjemplo.value, valores: editedValores.value }, celdaCalculada);
      jsonPreview.value = { title: `${editData.value.codigo} — Ejemplo: ${activeEjemplo.value.nombre}`, json: JSON.stringify(doc, null, 2) };
    } else {
      const doc = buildDocumento(editData.value, 'estructura', undefined, celdaCalculada);
      jsonPreview.value = { title: `${editData.value.codigo} — Estructura`, json: JSON.stringify(doc, null, 2) };
    }
  }

  return {
    estadoGuardado: autoguardado.estado,
    editData, activeTab, activeSectionIndex, selectedCampo, isNewCampo, editingHojaSeccionId,
    leftWidth, rightWidth, examplesWidth, highlightMissingCaptura, ejemplosCount, jsonPreview,
    showImportEstructura, modoCalculo, setModoCalculo,
    modoEdicion, setModoEdicion, borradoresPorCampo, confirmarBorradorCampo,
    handleUpdateDefaultValue, handleUpdateExampleValue,
    secciones, safeIdx, seccionActiva, isFirst, isLast, showExamples,
    ejemplos, activeEjemplo, editedValores, excelDesactualizado, showNuevoEjemplo, deleteTarget, volcarTarget, volcarEstructura,
    archivoExcelAsignado, showExcelCatalogModal, showPreview, showInsertConfirm, isInserting, insertProgress,
    previewFileUrl, previewFileName,
    handleLeftResize, handleRightResize, handleExamplesResize, handleTabChange, handleSectionSelect,
    goToPrevSection, goToNextSection, handleFieldUpdate, handleAddCampo, handleAddNota, handleDuplicarCampo, handleDeleteCampo,
    handleSectionNameChange, handleSectionHojaChange, handleSubsectionNameChange,
    handleSubseccionAyudaChange, handleAddSubsection, handleDeleteSubsection, handleAddSection, handleDuplicarSeccion,
    handleExampleValueChange, handleCreateExample, handleDeleteEjemplo, handleToggleEjemploEstado,
    handleDownloadExcel, handlePreviewExample, handleInsertExcel,
    handleVolcarExcel, handleVolcarEstructura, handleConfirmarVolcado, getDefaultValores,
    handleImportEstructura,
    handleSave, handleViewJson,
  };
}
