<script setup lang="ts">
interface OpcionTema {
  id: number;
  nombre: string;
  sub: string;
  icono: string;
}

const MENSAJE_ERROR = 'Selecciona al menos un tema de especialización.';

defineProps<{
  temas: OpcionTema[];
  campos: { otrosTemas: string };
  mostrarError: boolean;
}>();

const temasSeleccionados = defineModel<number[]>('temasSeleccionados', { required: true });

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
        </div>
      </div>
      <div class="form-group full-width">
        <label class="form-label">Otros temas o subtemas de especialidad</label>
        <textarea v-model="campos.otrosTemas" placeholder="Si seleccionaste 'Otros temas de especialidad' o deseas ampliar tu postulación, descríbelos aquí. Ej: 'Auditoría forense en obras públicas', 'Lavado de activos en contrataciones', 'BIM en proyectos de inversión pública'..." />
      </div>
      <div class="err" :class="{ on: mostrarError }">{{ MENSAJE_ERROR }}</div>
    </div>
  </div>
</template>
