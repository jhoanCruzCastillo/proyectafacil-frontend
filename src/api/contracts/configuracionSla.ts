import type { ConfiguracionSla } from '@/types';

export interface ConfiguracionSlaApi {
  get(): Promise<ConfiguracionSla>;
  update(data: Partial<ConfiguracionSla>): Promise<ConfiguracionSla>;
}
