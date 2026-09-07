import type { EstadoCampoIA, Plantilla, CampoCambio } from '@/types';

// Compara los valores guardados de una ficha antes/después de un "Guardar" y arma la lista de
// campos que realmente cambiaron, con etiqueta legible — usado para el histórico de cambios
// (Nivel 2).
//
// Tres señales para saber si un cambio lo propuso la IA (etiqueta "autocompletado" en vez de
// "editado"):
//  - `fuentesPorCampo`: el mismo mapa que alimenta el "?" de origen del dato (ver FieldCard.vue) —
//    solo se llena cuando el modelo devuelve una fuente citable no vacía.
//  - `estadosIA`: el mapa extraído/inferido/requiere_confirmacion/no_encontrado del llenado con IA
//    de TEXTO de toda la ficha (ver useLlenadoIAProgreso) — un identificador sigue ahí mientras no
//    se le borre su valor por completo (alEditarCampoIA solo lo limpia desde "no_encontrado").
//  - `camposAutocompletados`: marcado explícito de useClienteFichaEditor para TABLAS llenadas con
//    IA (ver marcarAutocompletadoPorIA) — hace falta aparte de fuentesPorCampo porque una tabla
//    puede llenarse con datos reales sin que el modelo cite una fuente concreta.
// Ninguna es una bandera exacta por edición: si el usuario reescribe a mano un campo que el sistema
// ya había llenado con IA, igual puede verse como "autocompletado" — aceptable para esta primera
// versión del historial.
export function calcularCambios(
  plantilla: Plantilla,
  anteriores: Record<string, string>,
  nuevos: Record<string, string>,
  fuentesPorCampo: Record<string, string> = {},
  estadosIA: Record<string, EstadoCampoIA> = {},
  camposAutocompletados: Set<string> = new Set(),
): CampoCambio[] {
  const cambios: CampoCambio[] = [];
  for (const seccion of plantilla.secciones) {
    for (const sub of seccion.subsecciones) {
      for (const campo of sub.campos) {
        const antes = anteriores[campo.identificador] ?? '';
        const despues = nuevos[campo.identificador] ?? '';
        if (antes !== despues) {
          const esIA = !!fuentesPorCampo[campo.identificador]
            || campo.identificador in estadosIA
            || camposAutocompletados.has(campo.identificador);
          cambios.push({
            identificador: campo.identificador,
            etiqueta: campo.etiqueta,
            valorAnterior: antes,
            valorNuevo: despues,
            accion: despues === '' ? 'eliminado' : esIA ? 'autocompletado' : 'editado',
            seccionNumero: seccion.numero,
            seccionNombre: seccion.nombre,
          });
        }
      }
    }
  }
  return cambios;
}
