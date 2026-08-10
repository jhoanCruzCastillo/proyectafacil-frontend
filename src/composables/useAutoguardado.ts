import { onScopeDispose, ref, watch, type Ref } from 'vue';

// Autoguardado por INACTIVIDAD, no por reloj.
//
// Un `setInterval` fijo tiene dos problemas: guarda casi siempre sin nada que guardar, y el
// navegador estrangula los temporizadores cuando la pestaña está en segundo plano, así que el
// intervalo real no es el que crees. Disparar tras la última edición evita ambos: si no hay
// ediciones no hay nada programado, y en una pestaña de fondo no hay nada que salvar.

export type EstadoAutoguardado = 'inactivo' | 'pendiente' | 'guardando' | 'guardado' | 'error';

/** Espera tras la última edición antes de guardar */
const ESPERA_MS = 2000;
/** Tope desde el primer cambio sin guardar: quien escribe sin parar no puede aplazarlo para siempre */
const TOPE_MS = 20000;

export interface OpcionesAutoguardado {
  /**
   * Huella de lo que se guardaría. Si no cambia respecto al último guardado, no se manda nada.
   * `null` = todavía no hay nada que guardar (la plantilla aún no ha cargado).
   */
  huella: () => string | null;
  /**
   * Persiste de verdad. No debe sacar toasts ni escribir en el registro de actividad: a esta
   * frecuencia inundaría el historial y la pantalla.
   */
  guardar: () => Promise<void>;
  esperaMs?: number;
  topeMs?: number;
}

export interface Autoguardado {
  estado: Ref<EstadoAutoguardado>;
  /** Marca la huella actual como ya guardada — lo llama el botón Guardar manual para que el
   * autoguardado no repita inmediatamente lo que se acaba de mandar. */
  marcarGuardado: () => void;
}

export function useAutoguardado(opciones: OpcionesAutoguardado): Autoguardado {
  const espera = opciones.esperaMs ?? ESPERA_MS;
  const tope = opciones.topeMs ?? TOPE_MS;

  const estado = ref<EstadoAutoguardado>('inactivo');
  let huellaGuardada: string | null = null;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let primerCambioEn: number | null = null;
  let enVuelo = false;

  function cancelar() {
    if (temporizador !== null) { clearTimeout(temporizador); temporizador = null; }
  }

  function programar() {
    cancelar();
    const ahora = Date.now();
    if (primerCambioEn === null) primerCambioEn = ahora;
    // El tope manda sobre la espera: con edición continua, el guardado no se aplaza más allá de él.
    const restante = Math.max(0, tope - (ahora - primerCambioEn));
    temporizador = setTimeout(ejecutar, Math.min(espera, restante));
  }

  async function ejecutar() {
    temporizador = null;
    const actual = opciones.huella();
    if (actual === null || actual === huellaGuardada) { primerCambioEn = null; return; }
    // Nunca dos guardados a la vez: si se solaparan, el más viejo podría llegar el último y
    // deshacer lo recién escrito. El que quede pendiente se reprograma al terminar este.
    if (enVuelo) return;

    enVuelo = true;
    estado.value = 'guardando';
    try {
      await opciones.guardar();
      // La huella que se da por guardada es la de ANTES de la petición: lo que se haya editado
      // mientras volaba sigue pendiente y dispara otro guardado abajo.
      huellaGuardada = actual;
      estado.value = 'guardado';
      primerCambioEn = null;
    } catch {
      estado.value = 'error';
    } finally {
      enVuelo = false;
      if (opciones.huella() !== huellaGuardada) programar();
    }
  }

  watch(
    () => opciones.huella(),
    (actual) => {
      if (actual === null) return;
      if (actual === huellaGuardada) {
        // Se deshizo el cambio a mano: ya no hay nada pendiente.
        cancelar();
        primerCambioEn = null;
        if (estado.value === 'pendiente') estado.value = 'guardado';
        return;
      }
      if (huellaGuardada === null) {
        // Primera huella conocida: es lo que hay en el servidor, no un cambio del usuario.
        huellaGuardada = actual;
        return;
      }
      estado.value = 'pendiente';
      programar();
    },
    { immediate: true },
  );

  // Salir de la pantalla no debe costar los últimos segundos de trabajo. No se espera la respuesta
  // —el componente ya se está destruyendo—, pero la petición sale.
  onScopeDispose(() => {
    cancelar();
    if (!enVuelo && opciones.huella() !== null && opciones.huella() !== huellaGuardada) {
      void opciones.guardar().catch(() => {});
    }
  });

  return {
    estado,
    marcarGuardado: () => {
      cancelar();
      primerCambioEn = null;
      huellaGuardada = opciones.huella();
      estado.value = 'guardado';
    },
  };
}
