import type { Liquidaciones } from '@/types';

export interface LiquidacionesApi {
  get(periodo: string): Promise<Liquidaciones>;
  autorizarPago(asesorIds: string[], periodo: string): Promise<void>;
}
