import type { Beneficio } from '@/types';

export interface BeneficiosApi {
  catalogo(): Promise<Beneficio[]>;
  mios(usuarioId: string): Promise<Beneficio[]>;
}
