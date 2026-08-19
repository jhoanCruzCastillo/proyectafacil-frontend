import { type Ref, computed, provide, ref, watch } from 'vue';
import { useEjemploQuery, useEjemplosByPlantillaQuery, useActualizarEjemplo } from '@/composables/useEjemplos';
import { usePlantillaQuery } from '@/composables/usePlantillas';
import { useExcelEjemploQuery, useSetExcelEjemplo } from '@/composables/useExcelEjemplos';
import { useCatalogoExcelQuery } from '@/composables/useArchivosExcel';
import { useRegistrarCambioFicha } from '@/composables/useHistorialCambios';
import { usePushActividad } from '@/composables/useActividad';
import { useUsuariosQuery } from '@/composables/useUsuarios';
import { useEstadoEntrenamiento } from '@/composables/useEstadoEntrenamiento';
import { useExcelVivo, useAltoDeBloqueExcel, EXCEL_VIVO } from '@/composables/useListasExcel';
import { useMapaValoresExcelDebounced, type ResolverValorCampo } from '@/composables/useMapaValoresExcelDebounced';
import type { ModoEdicionEditor } from '@/composables/usePlantillaEditor';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { generateId } from '@/api/mock/_shared';
import { cuentaEfectivaDe, puedeVerFicha } from '@/lib/permisos';
import { puedeVerHistorial } from '@/lib/planAcceso';
import { insertarValoresEnExcel, type AvisoLista } from '@/lib/excelWriter';
import { mensajeAvisoListas } from '@/lib/xlsxListas';
import { calcularCambios } from '@/lib/historialFicha';
import { validarValoresPlantilla, calcularProgresoValores } from '@/lib/valorValidation';

const MIN_LEFT = 180;
const DEFAULT_LEFT = 260;
const MIN_EXAMPLES = 220;
const DEFAULT_EXAMPLES = 300;

export function useClienteFichaEditor(ejemploId: Ref<string>) {
  const session = useSessionStore();
  const ui = useUiStore();

  const { data: ejemplo } = useEjemploQuery(ejemploId);
  const plantillaId = computed(() => ejemplo.value?.plantillaId ?? '');
  const { data: plantilla } = usePlantillaQuery(plantillaId);
  const { data: archivoEjemplo } = useExcelEjemploQuery(ejemploId);
  const { data: ejemplosPlantillaData } = useEjemplosByPlantillaQuery(plantillaId);
  const { data: usuariosData } = useUsuariosQuery();
  const actualizarEjemplo = useActualizarEjemplo();
  const setExcelEjemplo = useSetExcelEjemplo();
  const registrarCambioFicha = useRegistrarCambioFicha();
  const pushActividad = usePushActividad();
  const { esNivel0, vencido, diasRestantes, numeroNivel } = useEstadoEntrenamiento();

  const soloLectura = computed(() => esNivel0.value && vencido.value);
  const permiteMejoraIA = computed(() => numeroNivel.value >= 1);
  const muestraHistorial = computed(() => puedeVerHistorial(numeroNivel.value));
  const showHistorial = ref(false);
  const showFuenteVerdad = ref(false);

  const cuentaId = computed(() => (session.sesion ? cuentaEfectivaDe(usuariosData.value ?? [], session.sesion) : null));
  const esTitular = computed(() => !!session.sesion && session.sesion.usuarioId === cuentaId.value);
  const esPropietario = computed(
    () => !!ejemplo.value && !!session.sesion && ejemplo.value.propietarioId === cuentaId.value && puedeVerFicha(ejemplo.value, session.sesion.usuarioId, esTitular.value),
  );
  // Ejemplos autorados por el admin para esta plantilla (sin propietarioId) — sirven de guía al cliente.
  const ejemplosReferencia = computed(() => (ejemplosPlantillaData.value ?? []).filter((e) => !e.propietarioId));

  const activeSectionIndex = ref(0);
  const editedValores = ref<Record<string, string>>({});
  /** Origen breve por identificador ("¿de dónde salió este dato?"), para el botón "?" del editor. */
  const fuentesPorCampo = ref<Record<string, string>>({});
  /** Advertencias del último llenado con IA de una tabla (ej. "Fila 2: no se pudo determinar el
   * UBIGEO para 'X' — revísalo"), por identificador — ver setAdvertenciasCampo. Efímero: a
   * diferencia de `fuentesPorCampo`, no se persiste en el servidor (no tiene sentido arrastrar la
   * advertencia de un llenado de hace una semana), así que se reinicia al cambiar de ejemplo, igual
   * que `borradoresPorCampo`. */
  const advertenciasPorCampo = ref<Record<string, string[]>>({});
  const leftWidth = ref(DEFAULT_LEFT);
  // 'ejemplos' reutiliza la misma navegación de secciones que 'mi-ficha' (activeSectionIndex es
  // compartido) — solo cambia qué panel de la izquierda se muestra y de dónde salen los valores
  // que se renderizan a la derecha (ver ClienteFichaEditPage.vue).
  const activeTab = ref<'mi-ficha' | 'ejemplos'>('mi-ficha');
  const examplesWidth = ref(DEFAULT_EXAMPLES);
  const showPreview = ref(false);
  const showInsertConfirm = ref(false);
  const isInserting = ref(false);
  const insertProgress = ref(0);
  const insertProgressLabel = ref('Procesando…');
  const referenciaId = ref('');
  const referenciaEjemplo = computed(() => ejemplosReferencia.value.find((e) => e.id === referenciaId.value));

  // Desplegables leídos del Excel (para que el cliente elija la opción exacta en vez de teclearla) y
  // celdas calculadas (para que "Objeto de intervención"/"Localización" y demás fórmulas del Excel se
  // vean en vivo, no como "Sin valor") — la ESTRUCTURA (qué celda tiene fórmula, qué opciones ofrece
  // un desplegable) sale siempre del Excel ASIGNADO a la plantilla, exactamente igual que en el
  // editor de admin (ver fuenteExcel en usePlantillaEditor.ts) — es el mismo Excel para cualquier
  // ejemplo de esa plantilla, no la copia 1:1 que cada ficha guarda para descargar/insertar (esa
  // puede no existir todavía, p. ej. en una ficha vieja creada antes de que se copiara automático).
  // Lo que sí cambia según la pestaña son los VALORES que alimentan esas fórmulas (ver valoresPorCelda).
  const { data: catalogoExcel } = useCatalogoExcelQuery(plantillaId);
  const archivoExcelAsignado = computed(() => {
    const catalogo = catalogoExcel.value;
    return catalogo?.archivos.find((a) => a.id === catalogo.asignadoId) ?? null;
  });
  const fuenteExcelVivo = computed(() => archivoExcelAsignado.value?.dataUrl ?? null);
  const altoDeBloqueExcel = useAltoDeBloqueExcel(fuenteExcelVivo);
  const excelMapTrigger = ref(0);
  /** Declarado acá (antes de resolverValorExcel, que lo lee) en vez de junto a setBorradorCampo/
   * confirmarBorradorCampo más abajo, porque useMapaValoresExcelDebounced() lee resolverValorExcel.value
   * de forma síncrona al armarse — si el ref existiera más abajo en el código, JS lanzaría
   * "Cannot access before initialization" (temporal dead zone) aunque el cierre solo lo necesite en
   * tiempo de ejecución posterior; encontrado en vivo al probar este fix. */
  const borradoresPorCampo = ref<Record<string, string>>({});
  // Los BORRADORES (propuestas de IA aún no confirmadas por el usuario, ver borradoresPorCampo más
  // abajo) también deben alimentar el Excel vivo — si no, el llenado en lote de una sección con
  // catálogos en cascada (ej. 5.02.02/5.02.04 dependen de la Causa Indirecta que la IA propuso en
  // 5.01.02 un instante antes, dentro del mismo `llenarTablasFaltantes()`) siempre ve la tabla previa
  // vacía, porque `editedValores` solo se actualiza al Confirmar. Encontrado en vivo: 5.01.02 se
  // llenaba bien pero 5.02.02/5.02.04 quedaban con "medio"/"acciones" en blanco porque
  // opcionesLlenadoCascada() no encontraba ninguna Causa Indirecta todavía confirmada. Esto NO cambia
  // el estado de revisión (sigue en ámbar hasta que el usuario confirma) — solo hace que el motor de
  // fórmulas del Excel pueda leer el valor propuesto.
  const identificadorPorCampoId = computed(() => {
    const mapa = new Map<string, string>();
    for (const seccion of plantilla.value?.secciones ?? []) {
      for (const sub of seccion.subsecciones) {
        for (const campo of sub.campos) mapa.set(campo.id, campo.identificador);
      }
    }
    return mapa;
  });
  const resolverValorExcel = computed<ResolverValorCampo>(() => {
    if (activeTab.value === 'ejemplos') {
      const valores = referenciaEjemplo.value?.valores ?? {};
      return (identificador, valorEjemplo) => valores[identificador] ?? valorEjemplo ?? '';
    }
    const valores = editedValores.value;
    const borradores = borradoresPorCampo.value;
    const mapaIds = identificadorPorCampoId.value;
    const borradoresPorIdentificador: Record<string, string> = {};
    for (const [campoId, valor] of Object.entries(borradores)) {
      const identificador = mapaIds.get(campoId);
      if (identificador) borradoresPorIdentificador[identificador] = valor;
    }
    return (identificador, valorEjemplo) =>
      borradoresPorIdentificador[identificador] ?? valores[identificador] ?? valorEjemplo ?? '';
  });
  const valoresPorCelda = useMapaValoresExcelDebounced(
    plantilla,
    altoDeBloqueExcel,
    resolverValorExcel,
    excelMapTrigger,
    300,
  );
  // Se guarda en una variable (además de `provide`) para que ClienteFichaEditPage.vue pueda
  // resolver catálogos en vivo directamente (ej. la cascada de Sección 5 Problema-Objetivo), sin
  // depender de un `inject` redundante en el mismo componente que ya hizo el `provide`.
  const excelVivo = useExcelVivo(fuenteExcelVivo, valoresPorCelda);
  provide(EXCEL_VIVO, excelVivo);

  // OJO: NO limpiar `borradoresPorCampo` aquí. Este watch se dispara en CUALQUIER refetch del
  // ejemplo (no solo al cambiar de ficha — para eso ya está el watch de `ejemploId` más abajo),
  // incluido el refetch de fondo que dispara guardarValores() del llenado de texto con IA. Ese
  // refetch aterriza de forma asíncrona MIENTRAS llenarTablasFaltantes() ya va procesando tablas en
  // secuencia — si limpiábamos acá, el borrador recién puesto de la PRIMERA tabla (ej. 2.01.01)
  // se perdía en silencio si el refetch llegaba justo entre esa tabla y la siguiente, mientras que
  // las tablas posteriores (procesadas después de que el refetch ya había aterrizado) sí
  // sobrevivían — encontrado en vivo: 2.01.01 nunca mostraba el borrador ámbar aunque el backend
  // sí devolvía una propuesta válida (confirmado con Ver JSON / Red), pero 2.02.01 sí.
  watch(ejemplo, (ej) => {
    if (ej) {
      editedValores.value = { ...ej.valores };
      fuentesPorCampo.value = { ...(ej.fuentes ?? {}) };
      excelMapTrigger.value++;
    }
  });

  /** Registra de dónde salió el valor propuesto por IA para un campo (tabla o texto), para el botón
   * "?" del editor. A diferencia del llenado por sección (que ya persiste su `fuentes` en el
   * servidor), esto cubre el llenado de tablas, que no persiste nada hasta que el cliente guarda. */
  function setFuenteCampo(identificador: string, fuente: string) {
    if (!fuente.trim()) return;
    fuentesPorCampo.value = { ...fuentesPorCampo.value, [identificador]: fuente };
  }

  /** Advertencias del llenado con IA de una tabla — ver `advertenciasPorCampo`. Reemplaza (no
   * acumula) las de ese campo: son del último intento, no un historial. */
  function setAdvertenciasCampo(identificador: string, advertencias: string[]) {
    if (advertencias.length === 0) {
      if (!(identificador in advertenciasPorCampo.value)) return;
      const next = { ...advertenciasPorCampo.value };
      delete next[identificador];
      advertenciasPorCampo.value = next;
      return;
    }
    advertenciasPorCampo.value = { ...advertenciasPorCampo.value, [identificador]: advertencias };
  }

  // En modo entrenamiento el solucionario es el punto central del ejercicio — se preselecciona
  // en vez de dejar que el cliente tenga que descubrir el selector de "Ejemplo de referencia".
  watch([esNivel0, ejemplosReferencia], ([nivel0, referencias]) => {
    if (nivel0 && !referenciaId.value && referencias.length > 0) referenciaId.value = referencias[0].id;
  });

  // Cliente: siempre Confirmar (sin toggle). El Excel vivo solo se actualiza al confirmar cada campo.
  const modoEdicion = ref<ModoEdicionEditor>('confirmar');
  watch(ejemploId, () => {
    borradoresPorCampo.value = {};
    advertenciasPorCampo.value = {};
  }, { immediate: true });
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
    editedValores.value = { ...editedValores.value, [identificador]: value };
    excelMapTrigger.value++;
  }

  /** Confirma TODOS los borradores pendientes de una vez (ej. al terminar la revisión del llenado
   * con IA) — sin esto, cerrar esa sesión sin haber confirmado tabla por tabla dejaba las tablas
   * llenadas por IA como borrador en memoria nomás: al salir de la ficha se perdían en silencio,
   * aunque el modal de "Terminar" decía "los valores que ya están en la ficha se conservan". */
  function confirmarTodosLosBorradores() {
    const pendientes = Object.keys(borradoresPorCampo.value);
    if (pendientes.length === 0 || !plantilla.value) return;
    const identificadorPorCampoId = new Map<string, string>();
    for (const seccion of plantilla.value.secciones) {
      for (const sub of seccion.subsecciones) {
        for (const campo of sub.campos) {
          identificadorPorCampoId.set(campo.id, campo.identificador);
        }
      }
    }
    for (const campoId of pendientes) {
      const identificador = identificadorPorCampoId.get(campoId);
      if (identificador) confirmarBorradorCampo(campoId, identificador);
    }
  }

  const errores = computed(() => (plantilla.value ? validarValoresPlantilla(plantilla.value, editedValores.value) : {}));
  const erroresCount = computed(() => Object.keys(errores.value).length);
  const progreso = computed(() => (plantilla.value ? calcularProgresoValores(plantilla.value, editedValores.value) : undefined));
  const erroresPorSeccion = computed(() => {
    if (!plantilla.value) return {} as Record<string, number>;
    const map: Record<string, number> = {};
    for (const seccion of plantilla.value.secciones) {
      map[seccion.id] = seccion.subsecciones.reduce((acc, sub) => acc + sub.campos.filter((c) => errores.value[c.identificador]).length, 0);
    }
    return map;
  });

  const secciones = computed(() => plantilla.value?.secciones ?? []);
  const safeIdx = computed(() => Math.min(activeSectionIndex.value, secciones.value.length - 1));
  const seccionActiva = computed(() => secciones.value[safeIdx.value]);
  const isFirst = computed(() => safeIdx.value === 0);
  const isLast = computed(() => safeIdx.value === secciones.value.length - 1);

  function handleLeftResize(d: number) { leftWidth.value = Math.max(MIN_LEFT, leftWidth.value + d); }
  function handleExamplesResize(d: number) { examplesWidth.value = Math.max(MIN_EXAMPLES, examplesWidth.value + d); }
  function handleSectionSelect(seccionId: string) {
    const idx = secciones.value.findIndex((s) => s.id === seccionId);
    if (idx !== -1) activeSectionIndex.value = idx;
  }
  function goToPrevSection() { activeSectionIndex.value = Math.max(0, activeSectionIndex.value - 1); }
  function goToNextSection() { activeSectionIndex.value = Math.min(secciones.value.length - 1, activeSectionIndex.value + 1); }
  function handleValueChange(campoId: string, campoIdentificador: string, value: string) {
    setBorradorCampo(campoId, value, editedValores.value[campoIdentificador] ?? '');
  }

  async function handleSave() {
    if (!plantilla.value || !ejemplo.value || !session.sesion) return;
    const cambios = calcularCambios(plantilla.value, ejemplo.value.valores, editedValores.value);
    await actualizarEjemplo.mutateAsync({
      id: ejemplo.value.id,
      data: { valores: editedValores.value, fuentes: fuentesPorCampo.value },
    });
    if (cambios.length > 0) {
      await registrarCambioFicha.mutateAsync({
        id: generateId(),
        ejemploId: ejemplo.value.id,
        usuarioId: session.sesion.usuarioId,
        fecha: new Date().toISOString(),
        campos: cambios,
      });
    }
    await pushActividad.mutateAsync({ mensaje: `Guardaste avances en "${ejemplo.value.nombre}"`, color: 'blue' });
    ui.toast(`"${ejemplo.value.nombre}" guardada`);
  }

  async function handleDownload() {
    if (!archivoEjemplo.value) { ui.toast('Esta ficha no tiene una copia de Excel asociada', 'error'); return; }
    try {
      const { descargarArchivoUrl } = await import('@/lib/fetchBinario');
      await descargarArchivoUrl(archivoEjemplo.value.dataUrl, archivoEjemplo.value.nombre);
    } catch {
      ui.toast('No se pudo descargar el Excel', 'error');
    }
  }

  async function handleInsert() {
    if (!plantilla.value || !ejemplo.value || !archivoEjemplo.value) {
      ui.toast('Esta ficha no tiene una copia de Excel asociada', 'error');
      showInsertConfirm.value = false;
      return;
    }
    isInserting.value = true;
    insertProgress.value = 0;
    insertProgressLabel.value = 'Preparando…';
    try {
      // Se inserta siempre sobre la copia propia de la ficha (tomada al crearla), no sobre el
      // archivo que esté asignado hoy en el catálogo — así el resultado no se rompe si el admin
      // reasigna un Excel distinto a la plantilla después de que el cliente ya empezó a llenarla.
      let avisos: AvisoLista[] = [];
      const nuevaDataUrl = await insertarValoresEnExcel(
        archivoEjemplo.value.dataUrl,
        plantilla.value,
        editedValores.value,
        (fraction, fase) => {
          insertProgress.value = Math.round(fraction * 100);
          if (fase) insertProgressLabel.value = fase;
        },
        (a) => { avisos = a; },
      );
      insertProgress.value = 88;
      insertProgressLabel.value = 'Subiendo Excel…';
      await setExcelEjemplo.mutateAsync({ ejemploId: ejemplo.value.id, archivo: { ...archivoEjemplo.value, dataUrl: nuevaDataUrl } });
      insertProgress.value = 95;
      insertProgressLabel.value = 'Guardando…';
      await pushActividad.mutateAsync({ mensaje: `Se insertaron los valores de "${ejemplo.value.nombre}" en su Excel`, color: 'blue' });
      insertProgress.value = 100;
      insertProgressLabel.value = 'Listo';
      await new Promise((r) => setTimeout(r, 250));
      ui.toast('Valores insertados en el Excel');
      // El aviso llega aparte y en rojo: la inserción sí se hizo, pero conviene revisar esos valores.
      const aviso = mensajeAvisoListas(avisos);
      if (aviso) ui.toast(aviso, 'error');
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'No se pudo insertar los valores en el Excel', 'error');
    } finally {
      isInserting.value = false;
      insertProgressLabel.value = 'Procesando…';
      showInsertConfirm.value = false;
    }
  }

  return {
    ejemplo, plantilla, archivoEjemplo, esNivel0, vencido, diasRestantes, numeroNivel,
    soloLectura, permiteMejoraIA, muestraHistorial, showHistorial, showFuenteVerdad,
    esPropietario, ejemplosReferencia, referenciaId, referenciaEjemplo,
    activeSectionIndex, editedValores, fuentesPorCampo, setFuenteCampo, advertenciasPorCampo, setAdvertenciasCampo, confirmarTodosLosBorradores, leftWidth, activeTab, examplesWidth, showPreview, showInsertConfirm, isInserting, insertProgress, insertProgressLabel,
    modoEdicion, borradoresPorCampo, confirmarBorradorCampo,
    errores, erroresCount, progreso, erroresPorSeccion,
    secciones, safeIdx, seccionActiva, isFirst, isLast,
    handleLeftResize, handleExamplesResize, handleSectionSelect, goToPrevSection, goToNextSection, handleValueChange,
    handleSave, handleDownload, handleInsert,
    excelVivo,
  };
}
