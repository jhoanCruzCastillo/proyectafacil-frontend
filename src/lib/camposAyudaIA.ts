import type { Campo, TipoCampo } from '@/types';

// Tipos para los que no tiene sentido "ayúdame a llenar/verificar X": tablas (fase aparte, ver
// pedido del usuario), calculado (lo resuelve el Excel solo), imagen/firma/mapa (no son texto),
// nota (no es un campo real, es un bloque de texto del admin). Compartido entre AsesorIAChat.vue
// (chat libre) y FieldCard.vue (botón "?" del campo) para no mantener la lista dos veces.
const TIPOS_SIN_AYUDA_IA: TipoCampo[] = ['tabla', 'tabla_jerarquica', 'calculado', 'imagen', 'firma', 'nota', 'mapa_coordenadas'];

export function esCampoAyudableConIA(campo: Campo): boolean {
  return campo.editable && !TIPOS_SIN_AYUDA_IA.includes(campo.tipo);
}
