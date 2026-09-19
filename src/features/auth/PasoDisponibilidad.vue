<script setup lang="ts">
import { computed } from 'vue';
import { DIAS, HORAS, formatoHora, bloqueMarcado, bloqueBloqueado, bloquesDelDia, claveBloque, resumenBloques } from './especialistaDisponibilidad';

const ICONO_RELOJ = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:none;margin-top:1px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const MENSAJE_ERROR = 'Selecciona al menos un bloque horario en cualquier día.';

const props = defineProps<{ bloques: Record<string, boolean>; mostrarError: boolean }>();

const diaSeleccionado = defineModel<number>('diaSeleccionado', { required: true });

function alternarBloque(hora: number) {
  if (bloqueBloqueado(diaSeleccionado.value, hora)) return;
  const clave = claveBloque(diaSeleccionado.value, hora);
  props.bloques[clave] = !props.bloques[clave];
}

const chipsResumen = computed(() => resumenBloques(props.bloques));
const total = computed(() => chipsResumen.value.length);
</script>

<template>
  <div class="sec">
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div><div class="section-title">Disponibilidad horaria</div><div class="section-subtitle">Calendario semanal de lunes a sábado · bloques de una hora</div></div>
      </div>
      <label class="form-label">Día de la semana</label>
      <div class="dias">
        <button v-for="(d, i) in DIAS" :key="d" type="button" class="dia" :class="{ on: diaSeleccionado === i }" @click="diaSeleccionado = i">
          <b>{{ d }}</b>
          <span class="cnt">{{ bloquesDelDia(bloques, i) }} bloque{{ bloquesDelDia(bloques, i) === 1 ? '' : 's' }}</span>
        </button>
      </div>
      <label class="form-label">Bloques horarios <span style="font-weight: 400; color: var(--texto-muted)">(8:00 a. m. – 10:00 p. m., de una en una hora)</span></label>
      <div class="slots">
        <button
          v-for="h in HORAS"
          :key="h"
          type="button"
          class="sl"
          :class="{ sel: bloqueMarcado(bloques, diaSeleccionado, h), off: bloqueBloqueado(diaSeleccionado, h) }"
          @click="alternarBloque(h)"
        >
          {{ formatoHora(h) }} – {{ formatoHora(h + 1) }}
        </button>
      </div>
      <div class="aviso">
        <span v-html="ICONO_RELOJ" />
        <span>Los sábados la atención es solo en la mañana: los bloques desde la 1:00 p. m. aparecen cerrados e inactivos.</span>
      </div>
      <div class="slotsum">
        <template v-if="chipsResumen.length">
          Has seleccionado <b style="color: #fff">{{ total }}</b> bloques:
          <span v-for="c in chipsResumen" :key="c" class="t">{{ c }}</span>
        </template>
        <template v-else>Selecciona los bloques en los que podrás atender. Puedes elegir varios días y varias horas.</template>
      </div>
      <div class="err" :class="{ on: mostrarError }">{{ MENSAJE_ERROR }}</div>
    </div>
  </div>
</template>
