import { type MaybeRefOrGetter, toValue } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ticketsAsesoriaHttp } from '@/api/http/ticketsAsesoria.http';

// Panel del Administrativo de Asesorías (Módulo 4) — polling cada 15s, igual que
// useMisSolicitudesQuery, para que el dashboard y la tabla reflejen matchmaking en curso.
const INTERVALO_MS = 15_000;

export function useDashboardAsesoriaQuery() {
  return useQuery({
    queryKey: ['asesoria', 'dashboard'],
    queryFn: () => ticketsAsesoriaHttp.dashboard(),
    refetchInterval: INTERVALO_MS,
  });
}

export function useTicketsAsesoriaQuery() {
  return useQuery({
    queryKey: ['asesoria', 'tickets'],
    queryFn: () => ticketsAsesoriaHttp.index(),
    refetchInterval: INTERVALO_MS,
  });
}

export function useTicketDetalleQuery(id: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: ['asesoria', 'tickets', 'detalle', id],
    queryFn: () => ticketsAsesoriaHttp.detalle(toValue(id) as string),
    enabled: () => !!toValue(id),
  });
}

export function useDocentesDisponiblesQuery(id: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: ['asesoria', 'tickets', 'docentes-disponibles', id],
    queryFn: () => ticketsAsesoriaHttp.docentesDisponibles(toValue(id) as string),
    enabled: () => !!toValue(id),
  });
}

function useInvalidarTickets() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['asesoria', 'tickets'] });
    queryClient.invalidateQueries({ queryKey: ['asesoria', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['asesoria', 'solicitudes'] });
  };
}

export function useAsignarTicket() {
  const invalidar = useInvalidarTickets();
  return useMutation({
    mutationFn: ({ id, asesorId }: { id: string; asesorId: string }) => ticketsAsesoriaHttp.asignar(id, asesorId),
    onSuccess: invalidar,
  });
}

export function useMarcarEnEspera() {
  const invalidar = useInvalidarTickets();
  return useMutation({
    mutationFn: (id: string) => ticketsAsesoriaHttp.marcarEnEspera(id),
    onSuccess: invalidar,
  });
}

export function useReabrirHorario() {
  const invalidar = useInvalidarTickets();
  return useMutation({
    mutationFn: (id: string) => ticketsAsesoriaHttp.reabrirHorario(id),
    onSuccess: invalidar,
  });
}

export function useCancelarTicketAdmin() {
  const invalidar = useInvalidarTickets();
  return useMutation({
    mutationFn: (id: string) => ticketsAsesoriaHttp.cancelar(id),
    onSuccess: invalidar,
  });
}

export function useTicketsMismoHorarioQuery(fecha: MaybeRefOrGetter<string>, horaInicio: MaybeRefOrGetter<string>, horaFin: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['asesoria', 'tickets-mismo-horario', fecha, horaInicio, horaFin],
    queryFn: () => ticketsAsesoriaHttp.mismoHorario(toValue(fecha), toValue(horaInicio), toValue(horaFin)),
    enabled: () => !!toValue(fecha) && !!toValue(horaInicio) && !!toValue(horaFin),
  });
}
