<script setup lang="ts">
// Lista plana tal como la pidió el cliente en el mockup "Nuevo-registro-especialistas-ilpiie-live-v4.html"
// (reemplaza la lista anterior agrupada por sector de ILPIIE). "Otras" revela un campo de texto libre
// (g-profotra/f-profotra en el mockup) para que el postulante especifique su profesión real.
const PROFESIONES = [
  'Abogacía', 'Administración', 'Administración de Negocios', 'Agronomía', 'Antropología', 'Arquitectura',
  'Biología', 'Ciencia Política', 'Ciencias de la Comunicación', 'Contabilidad', 'Contabilidad y Finanzas',
  'Derecho', 'Economía', 'Educación', 'Enfermería', 'Estadística', 'Farmacia y Bioquímica', 'Física',
  'Geografía', 'Geología', 'Historia', 'Ingeniería Agrícola', 'Ingeniería Ambiental', 'Ingeniería Civil',
  'Ingeniería de Minas', 'Ingeniería de Sistemas', 'Ingeniería de Software', 'Ingeniería Económica',
  'Ingeniería Eléctrica', 'Ingeniería Electrónica', 'Ingeniería Estadística', 'Ingeniería Geológica',
  'Ingeniería Industrial', 'Ingeniería Mecánica', 'Ingeniería Mecatrónica', 'Ingeniería Metalúrgica',
  'Ingeniería Petroquímica', 'Ingeniería Química', 'Ingeniería Sanitaria', 'Medicina', 'Medicina Veterinaria',
  'Obstetricia', 'Psicología', 'Química', 'Sociología', 'Trabajo Social', 'Zootecnia', 'Otras',
];

const NIVELES_ACADEMICOS = ['Bachiller', 'Licenciado / Título profesional', 'Magister / Maestría', 'Doctorado / PhD'];
const EXPERIENCIAS = ['1 – 3 años', '3 – 5 años', '5 – 10 años', 'Más de 10 años'];

const NIVELES_ESPECIALIDAD = [
  {
    valor: 'Especialista',
    sub: 'Experiencia sólida en el tema (3 – 7 años)',
    icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M15.5 13.5L17 21l-5-3-5 3 1.5-7.5"/></svg>',
  },
  {
    valor: 'Senior',
    sub: 'Experiencia amplia y referenciada (7 – 15 años)',
    icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>',
  },
  {
    valor: 'Altamente especializado',
    sub: 'Referente nacional en el tema (más de 15 años)',
    icono: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8L7 11.5 12 5l5 6.5L21.5 8 20 19H4L2.5 8z"/><path d="M4 21.5h16"/></svg>',
  },
];

const MENSAJE_ERROR = 'Completa todos los campos obligatorios. Verifica el correo, el DNI y que ambas contraseñas coincidan (mín. 8 caracteres).';

defineProps<{
  campos: {
    nombre: string; dni: string; correo: string; telefono: string; password: string; password2: string;
    profesion: string; profesionOtra: string; nivelAcademico: string; experiencia: string;
  };
  mostrarError: boolean;
}>();

const nivelEspecialidad = defineModel<string>('nivelEspecialidad', { required: true });
const errorCorreo = defineModel<string>('errorCorreo', { required: true });
</script>

<template>
  <div class="sec">
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div><div class="section-title">Datos personales y profesionales</div><div class="section-subtitle">Información básica de identificación</div></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Nombres y apellidos <span class="required">*</span></label><input v-model="campos.nombre" type="text" placeholder="Ej. Juan Carlos Pérez López" /></div>
        <div class="form-group"><label class="form-label">DNI / CE <span class="required">*</span></label><input v-model="campos.dni" type="text" placeholder="Ej. 12345678" maxlength="12" /></div>
        <div class="form-group">
          <label class="form-label">Correo electrónico <span class="required">*</span></label>
          <input v-model="campos.correo" type="email" placeholder="ejemplo@correo.com" @input="errorCorreo = ''" />
          <div class="err" :class="{ on: !!errorCorreo }">{{ errorCorreo }}</div>
        </div>
        <div class="form-group"><label class="form-label">Teléfono / WhatsApp <span class="required">*</span></label><input v-model="campos.telefono" type="tel" placeholder="Ej. 999 888 777" /></div>
        <div class="form-group"><label class="form-label">Contraseña <span class="required">*</span></label><input v-model="campos.password" type="password" placeholder="Mínimo 8 caracteres" /></div>
        <div class="form-group"><label class="form-label">Confirmar contraseña <span class="required">*</span></label><input v-model="campos.password2" type="password" placeholder="Repite tu contraseña" /></div>
      </div>
      <div class="divider" />
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Profesión <span class="required">*</span></label>
          <select v-model="campos.profesion">
            <option value="">Selecciona tu profesión</option>
            <option v-for="p in PROFESIONES" :key="p">{{ p }}</option>
          </select>
        </div>
        <div v-if="campos.profesion === 'Otras'" class="form-group full-width">
          <label class="form-label">Especifica tu profesión <span class="required">*</span></label>
          <input v-model="campos.profesionOtra" type="text" placeholder="Ej. Ingeniero/a Geógrafo/a, Técnico/a en Construcción..." />
        </div>
        <div class="form-group">
          <label class="form-label">Nivel académico <span class="required">*</span></label>
          <select v-model="campos.nivelAcademico">
            <option value="">Selecciona tu nivel</option>
            <option v-for="n in NIVELES_ACADEMICOS" :key="n">{{ n }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Años de experiencia <span class="required">*</span></label>
          <select v-model="campos.experiencia">
            <option value="">Selecciona…</option>
            <option v-for="e in EXPERIENCIAS" :key="e">{{ e }}</option>
          </select>
        </div>
        <div class="form-group full-width">
          <label class="form-label">Nivel de especialidad <span class="required">*</span></label>
          <div class="radio-group">
            <label v-for="n in NIVELES_ESPECIALIDAD" :key="n.valor" class="radio-item" :class="{ checked: nivelEspecialidad === n.valor }">
              <input v-model="nivelEspecialidad" type="radio" name="niv_esp" :value="n.valor" />
              <span class="lv-ic" v-html="n.icono" />
              <span>{{ n.valor }} <span class="sub-label">{{ n.sub }}</span></span>
            </label>
          </div>
        </div>
      </div>
      <div class="err" :class="{ on: mostrarError }">{{ MENSAJE_ERROR }}</div>
    </div>
  </div>
</template>
