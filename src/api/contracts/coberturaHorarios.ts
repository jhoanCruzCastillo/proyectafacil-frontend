import type { CoberturaHorarios } from '@/types';

export interface CoberturaHorariosApi {
  get(fecha: string, sectorId?: string): Promise<CoberturaHorarios>;
}
