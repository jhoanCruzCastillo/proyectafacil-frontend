import { type MaybeRefOrGetter, toValue } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { asesoriaHttp } from '@/api/http/asesoria.http';
import type { CrearSolicitudAsesoriaData } from '@/api/contracts/asesoria';

// Mientras haya una conversación activa, ambos lados hacen polling — no hay WebSockets en el
// proyecto. 15s para la lista de solicitudes (el asesor no necesita saber al segundo que llegó
// una, ya lo avisa la campanita de notificaciones), 3s para los mensajes de un chat abierto.
const INTERVALO_SOLICITUDES_MS = 15_000;
const INTERVALO_MENSAJES_MS = 3_000;

export function useMisSolicitudesQuery(usuarioId: MaybeRefOrGetter<string>, rol: 'cliente' | 'asesor') {
  return useQuery({
    queryKey: ['asesoria', 'solicitudes', rol, usuarioId],
    queryFn: () => asesoriaHttp.misSolicitudes(toValue(usuarioId), rol),
    enabled: () => !!toValue(usuarioId),
    refetchInterval: INTERVALO_SOLICITUDES_MS,
  });
}

export function useNoAtendidasQuery(usuarioId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['asesoria', 'no-atendidas', usuarioId],
    queryFn: () => asesoriaHttp.noAtendidas(toValue(usuarioId)),
    enabled: () => !!toValue(usuarioId),
  });
}

export function useAgendadosPorRangoQuery(desde: MaybeRefOrGetter<string>, hasta: MaybeRefOrGetter<string>, enabled: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: ['asesoria', 'agendados-por-rango', desde, hasta],
    queryFn: () => asesoriaHttp.agendadosPorRango(toValue(desde), toValue(hasta)),
    enabled: () => !!toValue(enabled) && !!toValue(desde) && !!toValue(hasta),
  });
}

export function useCrearSolicitudAsesoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearSolicitudAsesoriaData) => asesoriaHttp.crear(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asesoria', 'solicitudes'] });
      queryClient.invalidateQueries({ queryKey: ['tickets-consulta'] });
    },
  });
}

export function useAceptarSolicitud() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ solicitudId, asesorId, linkReunion }: { solicitudId: string; asesorId: string; linkReunion?: string }) =>
      asesoriaHttp.aceptar(solicitudId, asesorId, linkReunion),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asesoria', 'solicitudes'] }),
  });
}

export function useFinalizarSolicitud() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (solicitudId: string) => asesoriaHttp.finalizar(solicitudId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asesoria', 'solicitudes'] }),
  });
}

export function useCompletarVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (solicitudId: string) => asesoriaHttp.completarVideo(solicitudId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asesoria', 'solicitudes'] }),
  });
}

export function useCancelarSolicitud() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (solicitudId: string) => asesoriaHttp.cancelar(solicitudId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asesoria', 'solicitudes'] });
      queryClient.invalidateQueries({ queryKey: ['tickets-consulta'] });
    },
  });
}

export function useCalificarSolicitud() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ solicitudId, estrellas, comentario }: { solicitudId: string; estrellas: number; comentario?: string }) =>
      asesoriaHttp.calificar(solicitudId, estrellas, comentario),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asesoria', 'solicitudes'] }),
  });
}

export function useMensajesQuery(solicitudId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: ['asesoria', 'mensajes', solicitudId],
    queryFn: () => asesoriaHttp.mensajes(toValue(solicitudId) as string),
    enabled: () => !!toValue(solicitudId),
    refetchInterval: INTERVALO_MENSAJES_MS,
  });
}

export function useEnviarMensaje() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      solicitudId,
      autorId,
      texto,
      adjunto,
    }: {
      solicitudId: string;
      autorId: string;
      texto: string;
      adjunto?: { url: string; nombre: string; tipo: string };
    }) => asesoriaHttp.enviarMensaje(solicitudId, autorId, texto, adjunto),
    onSuccess: (_data, vars) => queryClient.invalidateQueries({ queryKey: ['asesoria', 'mensajes', vars.solicitudId] }),
  });
}

// Sube el archivo a Cloudinary — un paso previo y separado de useEnviarMensaje() para poder
// mostrar progreso de subida antes de que el mensaje exista.
export function useSubirAdjuntoChat() {
  return useMutation({
    mutationFn: ({ dataUrl, nombre, tipo }: { dataUrl: string; nombre: string; tipo: string }) =>
      asesoriaHttp.subirAdjunto(dataUrl, nombre, tipo),
  });
}
