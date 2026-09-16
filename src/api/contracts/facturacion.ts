import type { FacturacionMock, ResumenNivelesFacturacion } from '@/types';

export interface FacturacionApi {
  get(usuarioId: string): Promise<FacturacionMock | null>;
  update(usuarioId: string, data: Partial<FacturacionMock>): Promise<FacturacionMock>;
  resumenNiveles(): Promise<ResumenNivelesFacturacion>;
}
