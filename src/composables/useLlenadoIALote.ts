import { computed, onUnmounted, ref, type Ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { llenadoIALoteHttp } from '@/api/http/llenadoIALote.http';
import { construirResumenResultadoLlenado, mapaEstadosDesdeResumen, nombresCamposLlenadosPorSeccion } from '@/lib/resultadoLlenadoIA';
import { useUiStore } from '@/stores/ui';
import type { EstadoCampoIA, Plantilla, ResultadoLlenadoIA, ResumenResultadoLlenadoIA } from '@/types';
import type { TablaLoteIA } from '@/api/contracts/llenadoIALote';
import type { SeccionProgresoIA } from '@/features/cliente/ProcesamientoIAModal.vue';

export type FaseLoteIA = 'idle' | 'enviando' | 'procesando' | 'completado' | 'error';

/** Cada cuánto se consulta el estado del lote mientras OpenAI lo procesa. Un lote no tiene el apuro
 * de una llamada síncrona — no hace falta pollear más seguido que esto. */
const INTERVALO_POLL_MS = 15_000;
/** Tope duro de espera antes de avisar "esto está tardando más de lo normal" (no cancela el lote en
 * OpenAI — solo dejamos de pollear y el usuario decide si seguir esperando reabriendo el modal). */
const TOPE_ESPERA_MS = 20 * 60 * 1000;

/**
 * Orquesta "Llenar toda la ficha" vía Batch API de OpenAI (~50% más barato que la llamada síncrona
 * de useLlenadoIAProgreso.ts, a cambio de no tener respuesta inmediata — ver enviarLoteFicha() en el
 * backend). Deliberadamente NO reemplaza useLlenadoIAProgreso.ts (se deja intacta, sin usar, por si
 * hace falta volver al flujo síncrono) — esta es una composable nueva y separada, con su propio
 * estado más simple: un lote no tiene progreso granular por sección mientras espera (todos los
 * resultados llegan juntos cuando OpenAI termina), así que `secciones` solo distingue
 * pendiente/procesando (todas a la vez) de completada/error (todas a la vez, al final).
 *
 * No persiste sesión en localStorage (a diferencia de useLlenadoIAProgreso) — si el usuario recarga
 * mientras un lote está en curso, el lote SIGUE corriendo en OpenAI (ya se cobró), pero esta pestaña
 * pierde el loteId y no puede seguir consultándolo. Aceptado como limitación conocida: los valores de
 * texto que el lote complete se guardan solos en el backend en cuanto termine de procesarse — para
 * verlos basta con reabrir "Llenar toda la ficha" más tarde; lo único que se pierde es el aviso
 * visual de "completado" en esta sesión del navegador, no los datos.
 */
export function useLlenadoIALote(plantilla: Ref<Plantilla | null | undefined>) {
  const ui = useUiStore();
  const queryClient = useQueryClient();

  const showProgreso = ref(false);
  const showResultado = ref(false);
  const fase = ref<FaseLoteIA>('idle');
  const secciones = ref<SeccionProgresoIA[]>([]);
  const mensajeError = ref<string | null>(null);
  const resumenResultado = ref<ResumenResultadoLlenadoIA | null>(null);
  const estadosCamposIA = ref<Record<string, EstadoCampoIA>>({});
  const tablasPropuestas = ref<TablaLoteIA[]>([]);
  const resaltarVerResumen = ref(false);
  /** request_counts real de OpenAI mientras el lote está en curso — ver ProcesamientoIAModal.vue
   * (progresoReal), que lo usa para que la barra avance de verdad en vez de quedarse fija. */
  const progresoLote = ref<{ total: number; completed: number } | null>(null);

  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let inicioEspera = 0;
  let cancelado = false;

  const haySesionIA = computed(
    () => fase.value !== 'idle' || Object.keys(estadosCamposIA.value).length > 0,
  );
  const enRevisionIA = computed(() => fase.value === 'completado');
  const esperandoServidor = computed(() => fase.value === 'procesando' || fase.value === 'enviando');

  function limpiarPoll() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function marcarSecciones(patch: Partial<SeccionProgresoIA>) {
    secciones.value = secciones.value.map((s) => ({ ...s, ...patch }));
  }

  async function pollLote(ejemploId: string, loteId: number) {
    if (cancelado) return;
    if (Date.now() - inicioEspera > TOPE_ESPERA_MS) {
      fase.value = 'error';
      mensajeError.value = 'El lote está tardando más de lo normal. Sigue procesándose en segundo plano — vuelve a abrir "Llenar toda la ficha" en unos minutos para ver si ya terminó (no se está cobrando de más por la espera).';
      marcarSecciones({ estado: 'error' });
      showProgreso.value = true;
      return;
    }

    let respuesta;
    try {
      respuesta = await llenadoIALoteHttp.estadoLote(ejemploId, loteId);
    } catch (e) {
      // Hipo de red consultando el estado — no es que el lote haya fallado en OpenAI. Reintenta.
      console.warn(`[llenado-ia-lote] Hipo de red consultando el lote ${loteId}, reintentando en ${INTERVALO_POLL_MS / 1000}s:`, e);
      pollTimer = setTimeout(() => void pollLote(ejemploId, loteId), INTERVALO_POLL_MS);
      return;
    }
    if (cancelado) return;

    if (respuesta.estado === 'error') {
      fase.value = 'error';
      mensajeError.value = respuesta.error ?? 'La IA no pudo procesar el lote.';
      marcarSecciones({ estado: 'error' });
      showProgreso.value = true;
      ui.toast(mensajeError.value, 'error');
      // El mensaje de arriba es genérico a propósito (no queremos mostrarle al usuario un JSON crudo
      // de error de OpenAI) — el motivo técnico real (ej. "token_limit_exceeded" por saturar la cuota
      // de la organización con varios lotes grandes a la vez) queda en consola para poder diagnosticar
      // sin tener que ir a buscar el log del backend cada vez.
      console.error(`[llenado-ia-lote] Lote ${loteId} falló:`, respuesta.detalle ?? respuesta.error);
      return;
    }
    if (respuesta.estado !== 'completado') {
      progresoLote.value = respuesta.progreso
        ? { total: respuesta.progreso.total, completed: respuesta.progreso.completed }
        : null;
      pollTimer = setTimeout(() => void pollLote(ejemploId, loteId), INTERVALO_POLL_MS);
      return;
    }
    progresoLote.value = null;

    // Completado.
    const resultado: ResultadoLlenadoIA = {
      valores: respuesta.valores ?? {},
      estados: respuesta.estados,
      confianza: respuesta.confianza,
      fuentes: respuesta.fuentes,
      secciones: respuesta.secciones ?? [],
      costoTotalUsd: respuesta.costoTotalUsd,
    };
    tablasPropuestas.value = respuesta.tablas ?? [];

    const seccionIds = secciones.value.map((s) => s.id);
    resumenResultado.value = plantilla.value
      ? construirResumenResultadoLlenado(plantilla.value, resultado, 1, seccionIds)
      : null;
    if (resumenResultado.value) {
      estadosCamposIA.value = { ...estadosCamposIA.value, ...mapaEstadosDesdeResumen(resumenResultado.value) };
    }
    const nombresPorSeccion = plantilla.value ? nombresCamposLlenadosPorSeccion(plantilla.value, resultado.valores) : {};
    secciones.value = secciones.value.map((s) => {
      const r = (resultado.secciones ?? []).find((x) => x.seccionId === s.id);
      return {
        ...s,
        estado: 'completada',
        campos: r?.campos,
        llenados: r?.llenados ?? 0,
        camposLlenadosNombres: nombresPorSeccion[s.id] ?? [],
      };
    });

    fase.value = 'completado';
    showProgreso.value = false;
    showResultado.value = true;
    resaltarVerResumen.value = true;

    const totalTexto = (resultado.secciones ?? []).reduce((acc, s) => acc + (s.llenados ?? 0), 0);
    const totalTablas = tablasPropuestas.value.filter((t) => !t.error).length;
    ui.toast(`Lote completado — ${totalTexto} campos y ${totalTablas} tablas propuestas`);

    void queryClient.invalidateQueries({ queryKey: ['ejemplos'] });
  }

  async function iniciar(ejemploId: string, seccionIds?: string[] | null) {
    cancelado = false;
    limpiarPoll();
    mensajeError.value = null;
    resumenResultado.value = null;
    estadosCamposIA.value = {};
    tablasPropuestas.value = [];
    progresoLote.value = null;
    showResultado.value = false;

    const todas = plantilla.value?.secciones ?? [];
    const filtro = seccionIds && seccionIds.length > 0 ? new Set(seccionIds) : null;
    secciones.value = todas
      .filter((s) => !filtro || filtro.has(s.id))
      .map((s) => ({ id: s.id, nombre: s.nombre, estado: 'procesando' as const }));
    if (secciones.value.length === 0) {
      ui.toast('Selecciona al menos una sección para llenar', 'error');
      return;
    }

    fase.value = 'enviando';
    showProgreso.value = true;

    try {
      const { loteId } = await llenadoIALoteHttp.enviarLote(ejemploId, seccionIds);
      fase.value = 'procesando';
      inicioEspera = Date.now();
      await pollLote(ejemploId, loteId);
    } catch (e) {
      fase.value = 'error';
      mensajeError.value = e instanceof Error ? e.message : 'No se pudo enviar el lote a la IA';
      console.error('[llenado-ia-lote] Falló el envío del lote:', e);
      marcarSecciones({ estado: 'error' });
      ui.toast(mensajeError.value, 'error');
    }
  }

  function cancelar() {
    // No hay forma de "cancelar" un lote ya facturándose en OpenAI de forma útil desde acá — esto
    // solo deja de pollear en ESTA pestaña. El lote sigue corriendo y sus resultados de sección se
    // guardan solos cuando termine (igual que si el usuario nunca hubiera cancelado la espera).
    cancelado = true;
    limpiarPoll();
    fase.value = 'idle';
    showProgreso.value = false;
    ui.toast('Dejaste de esperar el lote — sigue procesándose igual y los textos se guardarán solos cuando termine.');
  }

  function cerrarProgreso() {
    showProgreso.value = false;
  }

  function verResultados() {
    if (!resumenResultado.value) {
      ui.toast('Todavía no hay resultados para mostrar.', 'error');
      return;
    }
    showProgreso.value = false;
    showResultado.value = true;
    resaltarVerResumen.value = false;
  }

  function cerrarResultado() {
    showResultado.value = false;
  }

  function terminarProceso() {
    cancelado = true;
    limpiarPoll();
    showProgreso.value = false;
    showResultado.value = false;
    fase.value = 'idle';
    resumenResultado.value = null;
    estadosCamposIA.value = {};
    secciones.value = [];
    tablasPropuestas.value = [];
    mensajeError.value = null;
    resaltarVerResumen.value = false;
    progresoLote.value = null;
  }

  function confirmarCampoIA(identificador: string) {
    if (!(identificador in estadosCamposIA.value)) return;
    estadosCamposIA.value = { ...estadosCamposIA.value, [identificador]: 'extraido' };
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

  function abrirSiHaySesion(): boolean {
    if (fase.value === 'enviando' || fase.value === 'procesando' || fase.value === 'error') {
      showProgreso.value = true;
      return true;
    }
    if (resumenResultado.value) {
      showResultado.value = true;
      resaltarVerResumen.value = false;
      return true;
    }
    return false;
  }

  onUnmounted(() => {
    cancelado = true;
    limpiarPoll();
  });

  return {
    showProgreso,
    showResultado,
    fase,
    secciones,
    mensajeError,
    resumenResultado,
    estadosCamposIA,
    tablasPropuestas,
    progresoLote,
    esperandoServidor,
    haySesionIA,
    enRevisionIA,
    resaltarVerResumen,
    iniciar,
    cancelar,
    cerrarProgreso,
    verResultados,
    cerrarResultado,
    terminarProceso,
    abrirSiHaySesion,
    confirmarCampoIA,
    alEditarCampoIA,
  };
}
