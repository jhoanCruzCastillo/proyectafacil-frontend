<script setup lang="ts">
interface OpcionTema {
  id: number;
  nombre: string;
  sub: string;
  icono: string;
}

const MENSAJE_ERROR = 'Selecciona al menos un tema de especialización.';

// Mismo ícono "+" genérico que ICONO_TEMA_GENERICO en RegistroEspecialistaPage.vue — "Otros temas
// de especialidad" no es una fila del catálogo real, así que no tiene un ícono propio asignado.
const ICONO_OTROS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';

defineProps<{
  temas: OpcionTema[];
  campos: { otrosTemas: string };
  mostrarError: boolean;
}>();

const temasSeleccionados = defineModel<number[]>('temasSeleccionados', { required: true });
// No es un id del catálogo real (no viaja en temaIds) — solo controla si se muestra el textarea de
// abajo, igual que el mockup del cliente (checkbox "Otros temas de especialidad" -> #g-otrostemas).
const otrosSeleccionado = defineModel<boolean>('otrosSeleccionado', { required: true });

function temaMarcado(id: number): boolean {
  return temasSeleccionados.value.includes(id);
}
function alternarTema(id: number, marcado: boolean) {
  const i = temasSeleccionados.value.indexOf(id);
  if (marcado && i === -1) temasSeleccionados.value.push(id);
  else if (!marcado && i > -1) temasSeleccionados.value.splice(i, 1);
}
</script>

<template>
  <div class="sec">
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </div>
        <div><div class="section-title">Áreas y temas de especialización</div><div class="section-subtitle">Selecciona los temas en los que puedes asesorar</div></div>
      </div>
      <div class="form-group full-width">
        <label class="form-label">Temas principales de asesoría <span class="required">*</span> <span class="form-hint">Puedes seleccionar más de uno</span></label>
        <div class="checkbox-group">
          <label v-for="o in temas" :key="o.id" class="checkbox-item" :class="{ checked: temaMarcado(o.id) }">
            <input type="checkbox" :checked="temaMarcado(o.id)" @change="alternarTema(o.id, ($event.target as HTMLInputElement).checked)" />
            <span class="tic" v-html="o.icono" />
            <span>{{ o.nombre }} <span v-if="o.sub" class="sub-label">{{ o.sub }}</span></span>
          </label>
          <label class="checkbox-item" :class="{ checked: otrosSeleccionado }">
            <input type="checkbox" v-model="otrosSeleccionado" />
            <span class="tic" v-html="ICONO_OTROS" />
            <span>Otros temas de especialidad <span class="sub-label">Especifica en el campo de abajo los temas adicionales en los que eres experto</span></span>
          </label>
        </div>
      </div>
      <div v-if="otrosSeleccionado" class="form-group full-width">
        <label class="form-label" style="display: flex; align-items: center; gap: 8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 004 4h12"/></svg>
          Anote aquí los otros temas de su especialidad
        </label>
        <textarea v-model="campos.otrosTemas" placeholder="Ej: 'Auditoría forense en obras públicas', 'Lavado de activos en contrataciones', 'BIM en proyectos de inversión pública'..." />
      </div>
      <div class="err" :class="{ on: mostrarError }">{{ MENSAJE_ERROR }}</div>
    </div>
  </div>
</template>
