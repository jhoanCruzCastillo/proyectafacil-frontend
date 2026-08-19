import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { fuenteVerdadHttp } from '@/api/http/fuenteVerdad.http';
import { construirResumenResultadoLlenado, mapaEstadosDesdeResumen, nombresCamposLlenadosPorSeccion } from '@/lib/resultadoLlenadoIA';
import {
  borrarSesionLlenadoIA,
  guardarSesionLlenadoIA,
  leerSesionLlenadoIA,
} from '@/lib/llenadoIASesion';
import { useUiStore } from '@/stores/ui';
import type {
  EstadoCampoIA,
  Plantilla,
  ResultadoLlenadoIA,
  ResumenResultadoLlenadoIA,
  ResumenSeccionLlenadoIA,
} from '@/types';
import type { SeccionProgresoIA } from '@/features/cliente/ProcesamientoIAModal.vue';

export type FaseLlenadoIA = 'idle' | 'procesando' | 'completado' | 'error';

/** Tope por sección (1 llamada OpenAI). Evita 504 del gateway en deploy. */
const TIMEOUT_POR_SECCION_MS = 3 * 60 * 1000;
/** Tope total del lote de secciones. */
const TIMEOUT_LOTE_MS = 30 * 60 * 1000;

/**
 * Orquesta progreso + resultados del llenado con IA.
 * Una petición HTTP por sección (el backend ya soporta `seccionIds` parcial)
 * para no exceder el timeout del proxy/gateway en producción (~60–100 s).
 *
 * La sesión UI (fase, badges, resumen, modales) se persiste en localStorage por ficha
 * hasta "Terminar" en la barra superior — así sobrevive F5 y cerrar sesión en el mismo navegador.
 * Los valores ya los guarda el backend en cada sección.
 */
export function useLlenadoIAProgreso(
  plantilla: Ref<Plantilla | null | undefined>,
  ejemploId: Ref<string>,
) {
  const ui = useUiStore();
  const queryClient = useQueryClient();

  const showProgreso = ref(false);
  const showResultado = ref(false);
  const fase = ref<FaseLlenadoIA>('idle');
  const secciones = ref<SeccionProgresoIA[]>([]);
  const mensajeError = ref<string | null>(null);
  const resumenResultado = ref<ResumenResultadoLlenadoIA | null>(null);
  /** Estados por identificador — sobreviven al cerrar el informe para pintar badges en el editor. */
  const estadosCamposIA = ref<Record<string, EstadoCampoIA>>({});

  let abortLote = false;
  let abortRequest: AbortController | null = null;
  let timeoutLoteHandle: ReturnType<typeof setTimeout> | null = null;
  let restaurando = false;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** true mientras un lote está corriendo Y el usuario pidió cancelarlo (distingue de un timeout) —
   * el bucle de tablas en ClienteFichaEditPage.vue también la revisa, para que "Cancelar" corte TODO
   * el proceso (secciones de texto + tablas), no solo lo que está corriendo dentro de este composable. */
  const cancelado = ref(false);

  const haySesionIA = computed(
    () => fase.value !== 'idle' || showResultado.value || Object.keys(estadosCamposIA.value).length > 0,
  );

  /** Tras un llenado (o error con datos), hasta "Terminar" en la barra. */
  const enRevisionIA = computed(
    () =>
      fase.value === 'completado'
      || (fase.value === 'error' && (!!resumenResultado.value || Object.keys(estadosCamposIA.value).length > 0)),
  );

  /** Parpadeo inicial de "Ver resumen" hasta que el usuario lo abra desde la barra. */
  const resaltarVerResumen = ref(false);

  /** True mientras hay una sección en vuelo esperando al servidor. */
  const esperandoServidor = computed(() => {
    if (fase.value !== 'procesando') return false;
    return secciones.value.some((s) => s.estado === 'procesando');
  });

  function modalActual(): 'progreso' | 'resultado' | null {
    if (showResultado.value) return 'resultado';
    if (showProgreso.value) return 'progreso';
    return null;
  }

  function persistirAhora() {
    const id = ejemploId.value;
    if (!id || restaurando) return;
    if (fase.value === 'idle' && Object.keys(estadosCamposIA.value).length === 0) {
      borrarSesionLlenadoIA(id);
      return;
    }
    if (fase.value === 'idle') return;
    guardarSesionLlenadoIA({
      ejemploId: id,
      fase: fase.value,
      secciones: secciones.value,
      resumenResultado: resumenResultado.value,
      estadosCamposIA: estadosCamposIA.value,
      mensajeError: mensajeError.value,
      modal: modalActual(),
    });
  }

  function programarPersistir() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistirAhora();
    }, 120);
  }

  function restaurarDesdeStorage(id: string) {
    const guardada = leerSesionLlenadoIA(id);
    if (!guardada) return;

    restaurando = true;
    try {
      let faseRestaurada: FaseLlenadoIA = guardada.fase;
      let mensaje = guardada.mensajeError;
      let seccionesRest = guardada.secciones ?? [];

      // Un lote a medias no se puede reanudar: marcar como interrumpido y conservar lo completado.
      if (faseRestaurada === 'procesando') {
        faseRestaurada = 'error';
        mensaje =
          mensaje
          ?? 'El llenado con IA se interrumpió (saliste o recargaste la página). Las secciones ya completadas se conservan; puedes ver resultados o volver a intentar el resto.';
        seccionesRest = seccionesRest.map((s) =>
          s.estado === 'procesando' || s.estado === 'pendiente'
            ? { ...s, estado: s.estado === 'procesando' ? ('error' as const) : s.estado }
            : s,
        );
      }

      fase.value = faseRestaurada;
      secciones.value = seccionesRest;
      resumenResultado.value = guardada.resumenResultado;
      estadosCamposIA.value = guardada.estadosCamposIA ?? {};
      mensajeError.value = mensaje;

      if (guardada.modal === 'resultado' && guardada.resumenResultado) {
        showResultado.value = true;
        showProgreso.value = false;
      } else if (faseRestaurada === 'error' || guardada.modal === 'progreso') {
        // Error o progreso a medias: reabrir el modal de procesamiento.
        showProgreso.value = true;
        showResultado.value = false;
      } else if (faseRestaurada === 'completado' && guardada.resumenResultado) {
        // Revisión pendiente: no forzar modal; Ver resumen en la barra.
        showProgreso.value = false;
        showResultado.value = false;
        resaltarVerResumen.value = true;
      } else {
        showProgreso.value = false;
        showResultado.value = false;
      }
    } finally {
      restaurando = false;
      persistirAhora();
    }
  }

  watch(
    ejemploId,
    (id, prev) => {
      if (prev && prev !== id) {
        // Al cambiar de ficha no borramos la sesión de la anterior: sigue pendiente de Terminar.
      }
      // Reset en memoria y cargar la de esta ficha (si hay).
      if (!id) return;
      showProgreso.value = false;
      showResultado.value = false;
      fase.value = 'idle';
      secciones.value = [];
      mensajeError.value = null;
      resumenResultado.value = null;
      estadosCamposIA.value = {};
      resaltarVerResumen.value = false;
      restaurarDesdeStorage(id);
    },
    { immediate: true },
  );

  watch(
    [fase, secciones, resumenResultado, estadosCamposIA, mensajeError, showProgreso, showResultado],
    () => programarPersistir(),
    { deep: true },
  );

  function limpiarTimeoutLote() {
    if (timeoutLoteHandle) {
      clearTimeout(timeoutLoteHandle);
      timeoutLoteHandle = null;
    }
  }

  function seccionesDesdePlantilla(seccionIds?: string[] | null): SeccionProgresoIA[] {
    const todas = plantilla.value?.secciones ?? [];
    const filtro = seccionIds && seccionIds.length > 0 ? new Set(seccionIds) : null;
    return todas
      .filter((s) => !filtro || filtro.has(s.id))
      .map((s) => ({
        id: s.id,
        nombre: s.nombre,
        estado: 'pendiente' as const,
      }));
  }

  function marcarSeccion(id: string, patch: Partial<SeccionProgresoIA>) {
    secciones.value = secciones.value.map((s) => (s.id === id ? { ...s, ...patch } : s));
  }

  function aplicarSeccionCompletada(seccionId: string, resultado: ResultadoLlenadoIA) {
    const resumen = (resultado.secciones ?? []).find((r) => r.seccionId === seccionId);
    const nombres = plantilla.value
      ? (nombresCamposLlenadosPorSeccion(plantilla.value, resultado.valores ?? {})[seccionId] ?? [])
      : [];
    marcarSeccion(seccionId, {
      estado: 'completada',
      campos: resumen?.campos,
      llenados: resumen?.llenados ?? nombres.length,
      camposLlenadosNombres: nombres,
    });
  }

  function resumenFallback(resultado: ResultadoLlenadoIA, documentosAnalizados: number): ResumenResultadoLlenadoIA {
    const n = Object.keys(resultado.valores ?? {}).length;
    return {
      documentosAnalizados,
      camposCompletados: n,
      altaConfianza: n,
      requierenRevision: 0,
      yaExistian: 0,
      sinInformacion: 0,
      camposTablaOmitidos: 0,
      campos: [],
    };
  }

  function finalizarExito(
    resultado: ResultadoLlenadoIA,
    documentosAnalizados: number,
    seccionIds?: string[] | null,
  ) {
    limpiarTimeoutLote();

    resumenResultado.value = plantilla.value
      ? construirResumenResultadoLlenado(plantilla.value, resultado, documentosAnalizados, seccionIds)
      : resumenFallback(resultado, documentosAnalizados);
    estadosCamposIA.value = {
      ...estadosCamposIA.value,
      ...mapaEstadosDesdeResumen(resumenResultado.value),
    };

    fase.value = 'completado';
    showProgreso.value = false;
    showResultado.value = true;
    resaltarVerResumen.value = true;

    const total = (resultado.secciones ?? []).reduce((acc, s) => acc + (s.llenados ?? 0), 0);
    ui.toast(`Ficha llenada con IA — ${total} campos completados`);

    void queryClient.invalidateQueries({ queryKey: ['ejemplos'] });
  }

  function finalizarError(msg: string, resultadoParcial?: ResultadoLlenadoIA | null, seccionIds?: string[] | null, documentosAnalizados = 0) {
    limpiarTimeoutLote();
    mensajeError.value = msg;
    secciones.value = secciones.value.map((s) =>
      s.estado === 'procesando' || s.estado === 'pendiente'
        ? { ...s, estado: s.estado === 'procesando' ? ('error' as const) : s.estado }
        : s,
    );

    if (resultadoParcial && Object.keys(resultadoParcial.valores ?? {}).length > 0 && plantilla.value) {
      resumenResultado.value = construirResumenResultadoLlenado(
        plantilla.value,
        resultadoParcial,
        documentosAnalizados,
        seccionIds,
      );
      estadosCamposIA.value = {
        ...estadosCamposIA.value,
        ...mapaEstadosDesdeResumen(resumenResultado.value),
      };
      void queryClient.invalidateQueries({ queryKey: ['ejemplos'] });
    }

    fase.value = 'error';
    showProgreso.value = true;
    showResultado.value = false;
    ui.toast(msg, 'error');
  }

  function mensajeErrorLlenado(e: unknown): string {
    if (
      (e instanceof DOMException && e.name === 'AbortError') ||
      (e instanceof Error && e.name === 'AbortError')
    ) {
      return cancelado.value
        ? 'Cancelaste el llenado con IA. Las secciones y tablas ya completadas se conservan.'
        : 'El llenado con IA se canceló por tiempo de espera. Las secciones ya completadas se conservan; vuelve a intentar el resto.';
    }
    const raw = e instanceof Error ? e.message : 'No se pudo llenar la ficha con IA';
    if (/504|timeout|timed out|gateway/i.test(raw)) {
      return 'El servidor cortó la petición por tiempo (504). Prueba de nuevo; si se repite, llena menos secciones a la vez.';
    }
    return raw;
  }

  async function llenarUnaSeccion(idEjemplo: string, seccionId: string): Promise<ResultadoLlenadoIA> {
    const ctrl = new AbortController();
    abortRequest = ctrl;
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_POR_SECCION_MS);
    try {
      return await fuenteVerdadHttp.llenarConIA(idEjemplo, {
        seccionIds: [seccionId],
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
      if (abortRequest === ctrl) abortRequest = null;
    }
  }

  async function iniciar(idEjemplo: string, seccionIds?: string[] | null) {
    const ids = seccionIds && seccionIds.length > 0 ? [...seccionIds] : null;
    abortLote = false;
    cancelado.value = false;
    abortRequest?.abort();
    abortRequest = null;
    limpiarTimeoutLote();
    borrarSesionLlenadoIA(idEjemplo);
    mensajeError.value = null;
    resumenResultado.value = null;
    estadosCamposIA.value = {};
    showResultado.value = false;
    secciones.value = seccionesDesdePlantilla(ids);
    if (secciones.value.length === 0) {
      ui.toast('Selecciona al menos una sección para llenar', 'error');
      return;
    }

    fase.value = 'procesando';
    showProgreso.value = true;

    timeoutLoteHandle = setTimeout(() => {
      abortLote = true;
      abortRequest?.abort();
    }, TIMEOUT_LOTE_MS);

    let documentosAnalizados = 0;
    try {
      const fuente = await fuenteVerdadHttp.porEjemplo(idEjemplo);
      documentosAnalizados = fuente.archivos.length + (fuente.textoAdicional.trim() ? 1 : 0);
    } catch {
      documentosAnalizados = 0;
    }

    const valoresAcum: Record<string, string> = {};
    const estadosAcum: Record<string, EstadoCampoIA> = {};
    const confianzaAcum: Record<string, number> = {};
    const resumenSecciones: ResumenSeccionLlenadoIA[] = [];
    const idsProcesados: string[] = [];

    try {
      for (const seccion of secciones.value) {
        if (abortLote) {
          throw new DOMException('El llenado con IA se canceló por tiempo de espera del lote.', 'AbortError');
        }

        marcarSeccion(seccion.id, { estado: 'procesando' });
        const parcial = await llenarUnaSeccion(idEjemplo, seccion.id);

        Object.assign(valoresAcum, parcial.valores ?? {});
        Object.assign(estadosAcum, parcial.estados ?? {});
        Object.assign(confianzaAcum, parcial.confianza ?? {});
        for (const r of parcial.secciones ?? []) {
          resumenSecciones.push(r);
        }
        idsProcesados.push(seccion.id);
        aplicarSeccionCompletada(seccion.id, parcial);
      }

      finalizarExito(
        {
          valores: valoresAcum,
          estados: estadosAcum,
          confianza: confianzaAcum,
          secciones: resumenSecciones,
        },
        documentosAnalizados,
        ids ?? idsProcesados,
      );
    } catch (e) {
      finalizarError(
        mensajeErrorLlenado(e),
        {
          valores: valoresAcum,
          estados: estadosAcum,
          confianza: confianzaAcum,
          secciones: resumenSecciones,
        },
        idsProcesados.length > 0 ? idsProcesados : ids,
        documentosAnalizados,
      );
    } finally {
      limpiarTimeoutLote();
      abortRequest = null;
    }
  }

  /** Barra: durante proceso abre progreso; en revisión abre el resumen de campos. */
  function abrirSiHaySesion(): boolean {
    if (fase.value === 'procesando') {
      showProgreso.value = true;
      return true;
    }
    if (fase.value === 'error' && !resumenResultado.value) {
      showProgreso.value = true;
      return true;
    }
    if (resumenResultado.value) {
      showProgreso.value = false;
      showResultado.value = true;
      resaltarVerResumen.value = false;
      if (fase.value === 'idle') fase.value = 'completado';
      return true;
    }
    if (fase.value === 'error') {
      showProgreso.value = true;
      return true;
    }
    if (Object.keys(estadosCamposIA.value).length > 0) {
      if (fase.value === 'idle') fase.value = 'completado';
      return true;
    }
    return false;
  }

  function cerrarProgreso() {
    showProgreso.value = false;
    if (fase.value === 'error') {
      // No pasar a idle: la sesión (badges / resumen parcial) sigue hasta Terminar.
      // Solo ocultamos el modal.
    }
  }

  /**
   * `valoresActuales`: valores YA guardados del ejemplo (editedValores del editor) — se usan solo
   * como red de seguridad cuando `resumenResultado` quedó vacío. Pasa esto cuando una sesión
   * restaurada tras recargar la página quedó en 'error' con secciones "completada" en la lista pero
   * sin resumen (el resumen solo se arma al terminar el lote completo en memoria — un F5 a mitad de
   * camino lo pierde aunque las secciones ya se hayan guardado de verdad en el backend). Sin esto,
   * "Ver resultados" no hacía nada visible — encontrado en vivo probando una sesión interrumpida.
   */
  function verResultados(valoresActuales?: Record<string, string>) {
    if (!resumenResultado.value && valoresActuales && plantilla.value) {
      const seccionIdsCompletadas = secciones.value.filter((s) => s.estado === 'completada').map((s) => s.id);
      if (seccionIdsCompletadas.length > 0) {
        resumenResultado.value = construirResumenResultadoLlenado(
          plantilla.value,
          { valores: valoresActuales, secciones: [] },
          0,
          seccionIdsCompletadas,
        );
      }
    }
    if (!resumenResultado.value) {
      ui.toast('Esta sesión se interrumpió antes de guardar un resumen — los campos ya completados siguen guardados en la ficha.', 'error');
      showProgreso.value = false;
      return;
    }
    showProgreso.value = false;
    showResultado.value = true;
    resaltarVerResumen.value = false;
    if (fase.value !== 'error') {
      fase.value = 'completado';
    }
  }

  /** Solo cierra el modal de resumen (botón Revisar / Cerrar); la sesión sigue hasta Terminar. */
  function cerrarResultado() {
    showResultado.value = false;
  }

  /** Cierra la sesión de llenado IA por completo; Contexto IA vuelve a abrir la fuente de verdad. */
  function terminarProceso() {
    abortLote = true;
    limpiarTimeoutLote();
    abortRequest?.abort();
    abortRequest = null;
    showProgreso.value = false;
    showResultado.value = false;
    fase.value = 'idle';
    resumenResultado.value = null;
    estadosCamposIA.value = {};
    secciones.value = [];
    mensajeError.value = null;
    resaltarVerResumen.value = false;
    borrarSesionLlenadoIA(ejemploId.value);
  }

  /**
   * Cancela un lote en curso (secciones de texto + tablas, ver `cancelado`) — a diferencia de
   * `terminarProceso()`, NO resetea el estado a `idle` acá: deja que el `catch` del bucle en
   * `iniciar()` procese el `AbortError` igual que ya hace con el timeout de lote, así se conserva
   * el resumen parcial (secciones/tablas que sí llegaron a completarse antes de cancelar).
   */
  function cancelar() {
    if (fase.value !== 'procesando') return;
    cancelado.value = true;
    abortLote = true;
    limpiarTimeoutLote();
    abortRequest?.abort();
  }

  function confirmarCampoIA(identificador: string) {
    if (!(identificador in estadosCamposIA.value)) return;
    estadosCamposIA.value = {
      ...estadosCamposIA.value,
      [identificador]: 'extraido',
    };
  }

  function alEditarCampoIA(identificador: string, valor: string) {
    const actual = estadosCamposIA.value[identificador];
    if (!actual) return;
    if (actual === 'no_encontrado' && valor.trim()) {
      const next = { ...estadosCamposIA.value };
      delete next[identificador];
      estadosCamposIA.value = next;
    }
  }

  onUnmounted(() => {
    abortLote = true;
    limpiarTimeoutLote();
    abortRequest?.abort();
    if (persistTimer) clearTimeout(persistTimer);
    persistirAhora();
  });

  return {
    showProgreso,
    showResultado,
    fase,
    secciones,
    mensajeError,
    resumenResultado,
    estadosCamposIA,
    esperandoServidor,
    haySesionIA,
    enRevisionIA,
    resaltarVerResumen,
    iniciar,
    abrirSiHaySesion,
    cerrarProgreso,
    verResultados,
    cerrarResultado,
    terminarProceso,
    confirmarCampoIA,
    alEditarCampoIA,
    cancelado,
    cancelar,
    marcarSeccion,
  };
}
