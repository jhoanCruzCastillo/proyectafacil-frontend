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

  let abortLote = false;
  let abortRequest: AbortController | null = null;
  let timeoutLoteHandle: ReturnType<typeof setTimeout> | null = null;

  const haySesionIA = computed(
    () => fase.value !== 'idle' || showResultado.value || Object.keys(estadosCamposIA.value).length > 0,
  );

  /** True mientras hay una sección en vuelo esperando al servidor. */
  const esperandoServidor = computed(() => {
    if (fase.value !== 'procesando') return false;
    return secciones.value.some((s) => s.estado === 'procesando');
  });

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
    showResultado.value = false;
    showProgreso.value = true;

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
      return 'El llenado con IA se canceló por tiempo de espera. Las secciones ya completadas se conservan; vuelve a intentar el resto.';
    }
    const raw = e instanceof Error ? e.message : 'No se pudo llenar la ficha con IA';
    if (/504|timeout|timed out|gateway/i.test(raw)) {
      return 'El servidor cortó la petición por tiempo (504). Prueba de nuevo; si se repite, llena menos secciones a la vez.';
    }
    return raw;
  }

  async function llenarUnaSeccion(ejemploId: string, seccionId: string): Promise<ResultadoLlenadoIA> {
    const ctrl = new AbortController();
    abortRequest = ctrl;
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_POR_SECCION_MS);
    try {
      return await fuenteVerdadHttp.llenarConIA(ejemploId, {
        seccionIds: [seccionId],
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
      if (abortRequest === ctrl) abortRequest = null;
    }
  }

  async function iniciar(ejemploId: string, seccionIds?: string[] | null) {
    const ids = seccionIds && seccionIds.length > 0 ? [...seccionIds] : null;
    abortLote = false;
    abortRequest?.abort();
    abortRequest = null;
    limpiarTimeoutLote();
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

    timeoutLoteHandle = setTimeout(() => {
      abortLote = true;
      abortRequest?.abort();
    }, TIMEOUT_LOTE_MS);

    let documentosAnalizados = 0;
    try {
      const fuente = await fuenteVerdadHttp.porEjemplo(ejemploId);
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
        const parcial = await llenarUnaSeccion(ejemploId, seccion.id);

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

  /** Contexto IA: reabre progreso / error / lista de campos, o el informe si ya lo abrió. */
  function abrirSiHaySesion(): boolean {
    if (fase.value === 'procesando' || fase.value === 'error') {
      showProgreso.value = true;
      return true;
    }
    if (fase.value === 'completado' && resumenResultado.value) {
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
    if (!resumenResultado.value) return;
    showProgreso.value = false;
    showResultado.value = true;
    if (fase.value !== 'error') {
      fase.value = 'completado';
    }
  }

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
