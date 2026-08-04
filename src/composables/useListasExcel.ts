// Carga las listas desplegables del Excel asignado y las deja disponibles para toda la pantalla del
// editor vía provide/inject, de forma que cada campo pueda preguntar por su celda sin que haya que
// pasar el catálogo como prop por los tres niveles (página -> SectionContent -> FieldCard).
//
// El catálogo es SIEMPRE una ayuda opcional: si el ejemplo no tiene Excel, si la descarga falla o si
// la celda no tiene desplegable, el campo se comporta como texto libre igual que antes.

import { shallowRef, watch, type InjectionKey, type Ref, type ShallowRef } from 'vue';
import { leerLibroXlsx } from '@/lib/xlsxXmlReader';
import { catalogoDeListas, type CatalogoListas } from '@/lib/xlsxListas';

export const LISTAS_EXCEL: InjectionKey<ShallowRef<CatalogoListas | null>> = Symbol('listasExcel');

// El libro se descarga y parsea una sola vez por URL, para toda la sesión: son ~250 KB y las
// opciones no cambian mientras el archivo asignado sea el mismo.
const cache = new Map<string, Promise<CatalogoListas>>();

export function useListasExcel(fuente: Ref<string | null | undefined>): ShallowRef<CatalogoListas | null> {
  const catalogo = shallowRef<CatalogoListas | null>(null);

  watch(
    fuente,
    (url) => {
      catalogo.value = null;
      if (!url) return;

      let promesa = cache.get(url);
      if (!promesa) {
        promesa = leerLibroXlsx(url).then(catalogoDeListas);
        cache.set(url, promesa);
      }
      promesa
        .then((c) => {
          if (fuente.value === url) catalogo.value = c; // el archivo pudo cambiar mientras se bajaba
        })
        .catch((e) => {
          cache.delete(url); // que un fallo puntual de red no deje la pantalla sin desplegables
          console.warn('[listas] no se pudieron leer las listas del Excel:', e);
        });
    },
    { immediate: true },
  );

  return catalogo;
}
