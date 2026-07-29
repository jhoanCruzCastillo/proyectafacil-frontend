<script setup lang="ts">
import { computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faCheck, faVideo, faCalendarPlus, faUser, faFolderOpen, faCalendarDays, faInfoCircle, faXmark } from '@/lib/icons';
import Avatar from '@/components/Avatar.vue';
import type { SolicitudAsesoria } from '@/types';

// Pantalla de confirmación de videollamada agendada (docs de referencia del usuario) — a
// diferencia del chat, una vez asignado un asesor a una consulta de tipo video no hay
// conversación que abrir: el único paso siguiente es unirse a la llamada en la fecha acordada.
const props = defineProps<{ isOpen: boolean; solicitud: SolicitudAsesoria | null }>();
const emit = defineEmits<{ close: [] }>();

const fechaHoraLegible = computed(() => {
  const s = props.solicitud;
  if (!s?.horarioFecha) return null;
  const fecha = new Date(`${s.horarioFecha}T00:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  const capitalizada = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  return s.horarioHoraInicio && s.horarioHoraFin ? `${capitalizada}, ${s.horarioHoraInicio} - ${s.horarioHoraFin}` : capitalizada;
});

function unirseALlamada() {
  if (props.solicitud?.linkReunion) {
    window.open(props.solicitud.linkReunion, '_blank', 'noopener,noreferrer');
  }
}

// Sin backend de calendario — genera un .ics mínimo en el cliente para que el alumno pueda
// importarlo a Google/Outlook/Apple Calendar por su cuenta.
function agregarACalendario() {
  const s = props.solicitud;
  if (!s?.horarioFecha || !s.horarioHoraInicio || !s.horarioHoraFin) return;

  const inicio = new Date(`${s.horarioFecha}T${s.horarioHoraInicio}:00`);
  const fin = new Date(`${s.horarioFecha}T${s.horarioHoraFin}:00`);
  const aFormatoIcs = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ProyectaFacil//Asesorias//ES',
    'BEGIN:VEVENT',
    `DTSTART:${aFormatoIcs(inicio)}`,
    `DTEND:${aFormatoIcs(fin)}`,
    `SUMMARY:Asesoría con ${s.docenteNombre ?? 'tu asesor'} — Proyecta Fácil`,
    `DESCRIPTION:Videollamada de asesoría 1 a 1.${s.linkReunion ? ` Link de acceso: ${s.linkReunion}` : ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([lineas.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'asesoria-proyectafacil.ics';
  enlace.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen && solicitud" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click="emit('close')">
      <Transition name="pop" appear>
        <div class="bg-white rounded-2xl shadow-modal w-full max-w-md relative" @click.stop>
          <button
            @click="emit('close')"
            type="button"
            class="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-100"
          >
            <FontAwesomeIcon :icon="faXmark" />
          </button>

          <div class="pt-10 pb-6 px-8 text-center">
            <div class="relative w-20 h-20 mx-auto mb-5">
              <span class="absolute -top-1 -left-2 w-2 h-2 rounded-full bg-brand-300" />
              <span class="absolute top-1 -right-3 w-1.5 h-1.5 rounded-full bg-brand-300" />
              <span class="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-sm rotate-45 bg-brand-200" />
              <span class="absolute bottom-0 -left-3 w-1.5 h-1.5 rounded-full bg-brand-200" />
              <div class="w-20 h-20 rounded-full bg-brand-600 flex items-center justify-center">
                <FontAwesomeIcon :icon="faCheck" class="w-8 h-8 text-white" />
              </div>
            </div>

            <h2 class="text-xl font-bold text-heading">¡Tu videollamada fue confirmada!</h2>
            <p class="text-sm text-muted mt-1.5">Tu cita está agendada. Te esperamos.</p>
          </div>

          <div class="mx-6 mb-6 rounded-xl border border-gray-200 p-5">
            <div class="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
              <Avatar :nombre="solicitud.docenteNombre ?? 'Asesor'" :fotoUrl="solicitud.docenteFotoUrl" size="w-12 h-12" />
              <div class="min-w-0">
                <p class="text-xs text-muted flex items-center gap-1.5">
                  <FontAwesomeIcon :icon="faUser" class="w-2.5 h-2.5" />
                  Docente asignado
                </p>
                <p class="font-semibold text-heading text-sm truncate">{{ solicitud.docenteNombre ?? 'Por confirmar' }}</p>
              </div>
            </div>

            <div class="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
              <div class="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faFolderOpen" class="w-3.5 h-3.5" />
              </div>
              <div class="min-w-0 flex items-center gap-2 flex-wrap">
                <p class="text-xs text-muted shrink-0">Categoría</p>
                <span v-if="solicitud.sectorNombre" class="px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700">{{ solicitud.sectorNombre }}</span>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon :icon="faCalendarDays" class="w-3.5 h-3.5" />
              </div>
              <div class="min-w-0">
                <p class="text-xs text-muted">Fecha y hora</p>
                <p class="font-semibold text-heading text-sm">{{ fechaHoraLegible ?? 'Por confirmar' }}</p>
              </div>
            </div>
          </div>

          <div class="px-6 pb-6 space-y-3">
            <button
              @click="unirseALlamada"
              :disabled="!solicitud.linkReunion"
              type="button"
              class="w-full px-5 py-3.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-75 flex items-center justify-center gap-2.5"
            >
              <FontAwesomeIcon :icon="faVideo" class="w-4 h-4" />
              Unirse a la videollamada
            </button>
            <button
              @click="agregarACalendario"
              type="button"
              class="w-full px-5 py-3 rounded-lg border border-brand-200 text-brand-700 text-sm font-semibold hover:bg-brand-50 transition-colors duration-75 flex items-center justify-center gap-2.5"
            >
              <FontAwesomeIcon :icon="faCalendarPlus" class="w-3.5 h-3.5" />
              Agregar a mi calendario
            </button>
          </div>

          <p class="px-6 pb-6 text-xs text-muted text-center flex items-center justify-center gap-1.5">
            <FontAwesomeIcon :icon="faInfoCircle" class="w-3 h-3 shrink-0" />
            Recibirás un recordatorio antes de tu cita.
          </p>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.pop-enter-active,
.pop-leave-active {
  transition: all 0.12s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.97) translateY(10px);
}
</style>
