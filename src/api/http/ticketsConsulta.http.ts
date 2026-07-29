import { apiFetch } from './_shared';
import type { TicketsConsultaApi } from '../contracts/ticketsConsulta';
import type { TicketConsulta } from '@/types';

export const ticketsConsultaHttp: TicketsConsultaApi = {
  list(usuarioId) {
    return apiFetch<TicketConsulta[]>(`tickets-consulta/${usuarioId}`);
  },
};
