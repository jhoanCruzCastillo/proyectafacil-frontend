import type { Beneficio } from '@/types';

// Punto único que las futuras funcionalidades gateadas van a llamar — mismo estilo de función
// plana que frontend/src/lib/permisos.ts (sin store central). Por ahora ningún beneficio protege
// nada todavía; esto es la base para cuando se decida qué beneficio habilita qué función.
export function tieneBeneficio(misBeneficios: Beneficio[] | undefined, slug: string): boolean {
  return (misBeneficios ?? []).some((b) => b.slug === slug);
}
