import { apiFetch } from './_shared';
import type { CoberturaHorariosApi } from '../contracts/coberturaHorarios';
import type { CoberturaHorarios } from '@/types';

export const coberturaHorariosHttp: CoberturaHorariosApi = {
  get(fecha, sectorId) {
    const params = new URLSearchParams({ fecha });
    if (sectorId) params.set('sectorId', sectorId);
    return apiFetch<CoberturaHorarios>(`asesoria/cobertura-horarios?${params.toString()}`);
  },
};
