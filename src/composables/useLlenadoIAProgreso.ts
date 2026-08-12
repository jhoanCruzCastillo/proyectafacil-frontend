import { computed, onUnmounted, ref, type Ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { fuenteVerdadHttp } from '@/api/http/fuenteVerdad.http';
import { construirResumenResultadoLlenado, mapaEstadosDesdeResumen, nombresCamposLlenadosPorSeccion } from '@/lib/resultadoLlenadoIA';
import { useUiStore } from '@/stores/ui';
import type {
  EstadoCampoIA,
  Plantilla,
  ResultadoLlenadoIA,
  ResumenResultadoLlenadoIA,
} from '@/types';
import type { SeccionProgresoIA } from '@/features/cliente/ProcesamientoIAModal.vue';

export type FaseLlenadoIA = 'idle' | 'procesando' | 'completado' | 'error';

/** El backend hace 1 llamada OpenAI por sección (~10–30 s c/u). Tope de espera en el cliente. */
const TIMEOUT_LLENADO_MS = 15 * 60 * 1000;

/**
 * Orquesta progreso + resultados del llenado con IA en el editor del cliente.
 * El backend responde al final (una sola petición larga); la UI avanza sección a sección
 * a un ritmo alineado a esa duración, y al terminar abre el informe.
 */
export function useLlenadoIAProgreso(plantilla: Ref<Plantilla | null | undefined>) {
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

  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let abortSimulacion = false;
  let abortRequest: AbortController | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const haySesionIA = computed(
    () => fase.value !== 'idle' || showResultado.value || Object.keys(estadosCamposIA.value).length > 0,
  );

  /** Última sección en curso y el resto ya completadas → aún esperamos al POST. */
  const esperandoServidor = computed(() => {
    if (fase.value !== 'procesando' || secciones.value.length === 0) return false;
    const last = secciones.value[secciones.value.length - 1];
    if (last.estado !== 'procesando') return false;
    return secciones.value.slice(0, -1).every((s) => s.estado === 'completada');
  });

  function limpiarTick() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function limpiarTimeoutRequest() {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
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

  /**
   * Ritmo de la barra: ~4 min para recorrer N-1 secciones (la última espera al servidor).
   * Evita llegar al final en ~80 s mientras el backend sigue en las primeras secciones.
   */
  function intervaloProgresoMs(n: number): number {
    const pasos = Math.max(1, n - 1);
    const objetivo = 4 * 60 * 1000;
    return Math.min(20_000, Math.max(6_000, Math.round(objetivo / pasos)));
  }

  function iniciarSimulacionProgreso() {
    limpiarTick();
    abortSimulacion = false;
    if (secciones.value.length === 0) return;
    secciones.value[0] = { ...secciones.value[0], estado: 'procesando' };

    const every = intervaloProgresoMs(secciones.value.length);
    tickTimer = setInterval(() => {
      if (abortSimulacion || fase.value !== 'procesando') {
        limpiarTick();
        return;
      }
      const idx = secciones.value.findIndex((s) => s.estado === 'procesando');
      if (idx < 0) {
        limpiarTick();
        return;
      }
      // La última sección se queda en "procesando" hasta que responda el servidor.
      if (idx >= secciones.value.length - 1) return;

      secciones.value = secciones.value.map((s, i) => {
        if (i === idx) return { ...s, estado: 'completada' as const };
        if (i === idx + 1) return { ...s, estado: 'procesando' as const };
        return s;
      });
    }, every);
  }

  function aplicarResumenServidor(resultado: ResultadoLlenadoIA) {
    const resumen = resultado.secciones ?? [];
    const porId = new Map(resumen.map((r) => [r.seccionId, r]));
    const nombresPorSeccion = plantilla.value
      ? nombresCamposLlenadosPorSeccion(plantilla.value, resultado.valores ?? {})
      : {};

    secciones.value = secciones.value.map((s) => {
      const r = porId.get(s.id);
      const nombres = nombresPorSeccion[s.id] ?? [];
      return {
        ...s,
        estado: 'completada' as const,
        campos: r?.campos,
        llenados: r?.llenados ?? nombres.length,
        camposLlenadosNombres: nombres,
      };
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
      campos: [],
    };
  }

  function finalizarExito(
    resultado: ResultadoLlenadoIA,
    documentosAnalizados: number,
    seccionIds?: string[] | null,
  ) {
    abortSimulacion = true;
    limpiarTick();
    limpiarTimeoutRequest();
    aplicarResumenServidor(resultado);

    resumenResultado.value = plantilla.value
      ? construirResumenResultadoLlenado(plantilla.value, resultado, documentosAnalizados, seccionIds)
      : resumenFallback(resultado, documentosAnalizados);
    estadosCamposIA.value = {
      ...estadosCamposIA.value,
      ...mapaEstadosDesdeResumen(resumenResultado.value),
    };

    // Primero el modal de progreso con la lista de campos por sección; el usuario pasa al informe.
    fase.value = 'completado';
    showResultado.value = false;
    showProgreso.value = true;

    const total = (resultado.secciones ?? []).reduce((acc, s) => acc + (s.llenados ?? 0), 0);
    ui.toast(`Ficha llenada con IA — ${total} campos completados`);

    void queryClient.invalidateQueries({ queryKey: ['ejemplos'] });
  }

  function finalizarError(msg: string) {
    abortSimulacion = true;
    limpiarTick();
    limpiarTimeoutRequest();
    mensajeError.value = msg;
    secciones.value = secciones.value.map((s) =>
      s.estado === 'procesando' || s.estado === 'pendiente'
        ? { ...s, estado: s.estado === 'procesando' ? ('error' as const) : s.estado }
        : s,
    );
    fase.value = 'error';
    showProgreso.value = true;
    showResultado.value = false;
    ui.toast(msg, 'error');
  }

  async function iniciar(ejemploId: string, seccionIds?: string[] | null) {
    const ids = seccionIds && seccionIds.length > 0 ? [...seccionIds] : null;
    abortSimulacion = false;
    abortRequest?.abort();
    abortRequest = new AbortController();
    limpiarTimeoutRequest();
    mensajeError.value = null;
    resumenResultado.value = null;
    showResultado.value = false;
    secciones.value = seccionesDesdePlantilla(ids);
    if (secciones.value.length === 0) {
      ui.toast('Selecciona al menos una sección para llenar', 'error');
      return;
    }

    fase.value = 'procesando';
    showProgreso.value = true;
    iniciarSimulacionProgreso();

    timeoutHandle = setTimeout(() => {
      abortRequest?.abort();
    }, TIMEOUT_LLENADO_MS);

    let documentosAnalizados = 0;
    try {
      const fuente = await fuenteVerdadHttp.porEjemplo(ejemploId);
      documentosAnalizados = fuente.archivos.length + (fuente.textoAdicional.trim() ? 1 : 0);
    } catch {
      documentosAnalizados = 0;
    }

    try {
      const resultado = await fuenteVerdadHttp.llenarConIA(ejemploId, {
        seccionIds: ids ?? undefined,
        signal: abortRequest.signal,
      });
      finalizarExito(resultado, documentosAnalizados, ids);
    } catch (e) {
      const aborted =
        (e instanceof DOMException && e.name === 'AbortError') ||
        (e instanceof Error && e.name === 'AbortError');
      const msg = aborted
        ? 'El llenado con IA tardó demasiado y se canceló. Vuelve a intentar; si se repite, reduce el tamaño de la fuente de la verdad.'
        : e instanceof Error
          ? e.message
          : 'No se pudo llenar la ficha con IA';
      finalizarError(msg);
    } finally {
      limpiarTimeoutRequest();
      abortRequest = null;
    }
  }

  /** Contexto IA: reabre progreso / error / lista de campos, o el informe si ya lo abrió. */
  function abrirSiHaySesion(): boolean {
    if (fase.value === 'procesando' || fase.value === 'error') {
      showProgreso.value = true;
      return true;
    }
    if (fase.value === 'completado' && resumenResultado.value) {
      // Preferir el progreso con nombres de campos si aún no abrió el informe.
      if (!showResultado.value) {
        showProgreso.value = true;
        return true;
      }
      showResultado.value = true;
      return true;
    }
    if (resumenResultado.value) {
      showResultado.value = true;
      fase.value = 'completado';
      return true;
    }
    return false;
  }

  function cerrarProgreso() {
    showProgreso.value = false;
    if (fase.value === 'error') {
      fase.value = 'idle';
      mensajeError.value = null;
    }
  }

  function verResultados() {
    showProgreso.value = false;
    if (resumenResultado.value) {
      showResultado.value = true;
      fase.value = 'completado';
    }
  }

  function cerrarResultado() {
    showResultado.value = false;
  }

  /** Cierra la sesión de llenado IA por completo; Contexto IA vuelve a abrir la fuente de verdad. */
  function terminarProceso() {
    abortSimulacion = true;
    limpiarTick();
    limpiarTimeoutRequest();
    abortRequest?.abort();
    abortRequest = null;
    showProgreso.value = false;
    showResultado.value = false;
    fase.value = 'idle';
    resumenResultado.value = null;
    estadosCamposIA.value = {};
    secciones.value = [];
    mensajeError.value = null;
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
    abortSimulacion = true;
    limpiarTick();
    limpiarTimeoutRequest();
    abortRequest?.abort();
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
    iniciar,
    abrirSiHaySesion,
    cerrarProgreso,
    verResultados,
    cerrarResultado,
    terminarProceso,
    confirmarCampoIA,
    alEditarCampoIA,
  };
}
