<script setup lang="ts">
import { ref } from 'vue';

const ICONO_SUBIR = '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
const MENSAJE_ERROR = 'Adjunta tu CV y acepta los términos para continuar.';

const EXTENSIONES_PERMITIDAS = ['pdf', 'doc', 'docx'];
const TAMANO_MAXIMO = 5 * 1024 * 1024;

defineProps<{
  campos: { linkedin: string; otrasRedes: string; comentarios: string };
  mostrarError: boolean;
}>();

const archivoCV = defineModel<File | null>('archivoCv', { required: true });
const aceptaTerminos = defineModel<boolean>('aceptaTerminos', { required: true });

const cvInputRef = ref<HTMLInputElement | null>(null);
const errorArchivo = ref('');
// Cuenta dragenter/dragleave en vez de un booleano simple: al arrastrar sobre el texto/ícono
// hijos del dropzone, el navegador dispara dragleave del padre + dragenter del hijo — un booleano
// parpadearía "false" entre esos dos eventos.
let contadorDrag = 0;
const arrastrando = ref(false);

function abrirSelectorArchivo() {
  cvInputRef.value?.click();
}

function validarArchivo(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!EXTENSIONES_PERMITIDAS.includes(extension)) return 'Solo se admiten archivos PDF, DOC o DOCX.';
  if (file.size > TAMANO_MAXIMO) return 'El archivo supera los 5 MB permitidos.';
  return null;
}

function procesarArchivo(file: File | undefined | null) {
  if (!file) return;
  const error = validarArchivo(file);
  if (error) {
    errorArchivo.value = error;
    return;
  }
  errorArchivo.value = '';
  archivoCV.value = file;
}

function onArchivoCambiado(evento: Event) {
  const input = evento.target as HTMLInputElement;
  procesarArchivo(input.files?.[0]);
  input.value = ''; // permite volver a soltar/elegir el mismo archivo tras un error
}

function onDragEnter(evento: DragEvent) {
  if (!evento.dataTransfer?.types.includes('Files')) return;
  contadorDrag++;
  arrastrando.value = true;
}
function onDragLeave() {
  contadorDrag = Math.max(0, contadorDrag - 1);
  if (contadorDrag === 0) arrastrando.value = false;
}
function onDrop(evento: DragEvent) {
  contadorDrag = 0;
  arrastrando.value = false;
  procesarArchivo(evento.dataTransfer?.files?.[0]);
}
</script>

<template>
  <div class="sec">
    <div class="section-card">
      <div class="section-header">
        <div class="section-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <div><div class="section-title">Documentos y presencia profesional</div><div class="section-subtitle">Antecedentes y redes de tu perfil público</div></div>
      </div>
      <div class="form-group full-width">
        <label class="form-label">Currículum Vitae <span class="required">*</span></label>
        <div
          class="file-upload"
          :class="{ dragover: arrastrando }"
          @click="abrirSelectorArchivo"
          @dragover.prevent
          @dragenter.prevent="onDragEnter"
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop"
        >
          <span v-html="ICONO_SUBIR" />
          <p>Arrastra tu CV aquí o haz clic para subir</p>
          <span>PDF, DOC o DOCX · Máximo 5 MB</span>
          <input ref="cvInputRef" type="file" accept=".pdf,.doc,.docx" @change="onArchivoCambiado" />
        </div>
        <p v-if="errorArchivo" class="form-hint" style="color: var(--rojo)">{{ errorArchivo }}</p>
        <p v-else-if="archivoCV" class="form-hint" style="color: var(--verde-claro)">✓ Archivo seleccionado: {{ archivoCV.name }}</p>
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">LinkedIn</label><input v-model="campos.linkedin" type="url" placeholder="https://linkedin.com/in/tu-perfil" /></div>
        <div class="form-group"><label class="form-label">Otras redes o sitio web</label><input v-model="campos.otrasRedes" type="url" placeholder="Blog, portafolio, ResearchGate..." /></div>
      </div>
      <div class="divider" />
      <div class="form-group full-width">
        <label class="form-label">Comentarios y sugerencias</label>
        <textarea v-model="campos.comentarios" placeholder="Experiencia destacada, casos de éxito, certificaciones, publicaciones relevantes, o cualquier información valiosa para tu postulación..." />
      </div>
      <div class="form-group full-width">
        <label class="checkbox-item" :class="{ checked: aceptaTerminos }">
          <input v-model="aceptaTerminos" type="checkbox" />
          <span>Declaro que la información proporcionada es veraz y autorizo al ILPIIE a verificar mis antecedentes profesionales. Acepto las políticas de confidencialidad y el código de ética del Instituto. <span class="sub-label">Tu información está protegida y será usada exclusivamente para fines de selección de especialistas.</span></span>
        </label>
      </div>
      <div class="err" :class="{ on: mostrarError }">{{ MENSAJE_ERROR }}</div>
    </div>
  </div>
</template>
