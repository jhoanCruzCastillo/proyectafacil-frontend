import { nextTick, ref, watch, type Ref } from 'vue';

/**
 * Da un estado "cargando" real al cambiar de sección o de pestaña (Estructura/Ejemplos, o su
 * equivalente en la ficha del cliente), en vez de dejar que el remontaje de SectionContent bloquee
 * la UI sin avisar. Ese remontaje es trabajo síncrono de verdad — decenas de FieldCard, cada uno
 * consultando su celda en el Excel vivo (VLOOKUP incluido) — así que si solo se alternara un booleano
 * en el mismo tick, Vue jamás llegaría a pintar el esqueleto antes de arrancarlo.
 *
 * `clave` identifica qué debe estar montado (p. ej. `${seccionId}:${tab}`). Cuando cambia:
 * 1. Se desmonta lo actual y se activa `cargando`.
 * 2. Se espera un doble requestAnimationFrame — garantiza que el navegador ya pintó ese esqueleto.
 * 3. Recién ahí se revela la clave nueva, disparando el remontaje real.
 */
export function useTransicionSeccion(clave: Ref<string | null>) {
  const cargando = ref(false);
  const claveMostrada = ref<string | null>(null);

  watch(
    clave,
    async (actual) => {
      if (actual === claveMostrada.value) return;
      cargando.value = true;
      claveMostrada.value = null;
      await nextTick();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      // La clave pudo volver a cambiar mientras se esperaba (usuario cambiando de sección rápido) —
      // solo importa revelar la ÚLTIMA, no una intermedia que ya quedó obsoleta.
      if (clave.value !== actual) return;
      claveMostrada.value = actual;
      cargando.value = false;
    },
    { immediate: true },
  );

  return { cargando, claveMostrada };
}
