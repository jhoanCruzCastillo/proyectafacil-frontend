import type { ConfiguracionVideoconferencia } from '@/types';

export interface ConfiguracionVideoconferenciaApi {
  get(): Promise<ConfiguracionVideoconferencia>;
  update(data: ConfiguracionVideoconferencia): Promise<ConfiguracionVideoconferencia>;
}
