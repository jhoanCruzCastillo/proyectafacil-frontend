import type { TicketConsulta } from '@/types';

export interface TicketsConsultaApi {
  list(usuarioId: string): Promise<TicketConsulta[]>;
}
