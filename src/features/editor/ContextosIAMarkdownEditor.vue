<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import {
  faHeading, faBold, faItalic, faListUl, faListOl, faCode, faQuoteLeft, faLink, faEye,
} from '@/lib/icons';
import { renderMarkdown } from '@/lib/markdown';

const props = withDefaults(defineProps<{
  modelValue: string;
  label?: string;
  minHeightClass?: string;
  showPreview?: boolean;
}>(), {
  label: 'Contenido',
  minHeightClass: 'min-h-[280px]',
  showPreview: true,
});

const emit = defineEmits<{ 'update:modelValue': [string] }>();

function insertar(antes: string, despues = '') {
  const el = document.activeElement as HTMLTextAreaElement | null;
  const texto = props.modelValue;
  if (!el || el.tagName !== 'TEXTAREA') {
    emit('update:modelValue', texto + antes + despues);
    return;
  }
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const seleccionado = texto.slice(start, end);
  const nuevo = texto.slice(0, start) + antes + seleccionado + despues + texto.slice(end);
  emit('update:modelValue', nuevo);
}

const herramientas = [
  { icon: faHeading, title: 'Título', action: () => insertar('\n## ', '\n') },
  { icon: faBold, title: 'Negrita', action: () => insertar('**', '**') },
  { icon: faItalic, title: 'Cursiva', action: () => insertar('*', '*') },
  { icon: faListUl, title: 'Lista', action: () => insertar('\n- ') },
  { icon: faListOl, title: 'Lista numerada', action: () => insertar('\n1. ') },
  { icon: faCode, title: 'Código', action: () => insertar('`', '`') },
  { icon: faQuoteLeft, title: 'Cita', action: () => insertar('\n> ') },
  { icon: faLink, title: 'Enlace', action: () => insertar('[', '](url)') },
] as const;
</script>

<template>
  <div class="flex flex-col gap-3 min-h-0 flex-1">
    <div class="flex flex-col min-h-0 flex-1" :class="showPreview ? 'xl:grid xl:grid-cols-2 xl:gap-4' : ''">
      <div class="flex flex-col min-h-0 rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/80">
          <span class="text-xs font-semibold text-heading">{{ label }}</span>
          <div class="flex items-center gap-0.5">
            <button
              v-for="(t, i) in herramientas"
              :key="i"
              type="button"
              class="w-7 h-7 rounded-md text-muted hover:bg-white hover:text-heading transition-colors"
              :title="t.title"
              @click="t.action"
            >
              <FontAwesomeIcon :icon="t.icon" class="w-3 h-3" />
            </button>
          </div>
        </div>
        <textarea
          :value="modelValue"
          :class="minHeightClass"
          class="flex-1 w-full resize-none px-4 py-3 text-sm font-mono text-heading leading-relaxed outline-none"
          spellcheck="false"
          @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        />
        <div class="px-3 py-2 border-t border-gray-100 text-[11px] text-muted flex justify-end">
          Contador de caracteres: {{ modelValue.length.toLocaleString('es-PE') }}
        </div>
      </div>

      <div
        v-if="showPreview"
        class="hidden xl:flex flex-col min-h-0 rounded-xl border border-gray-200 bg-white overflow-hidden"
      >
        <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/80">
          <FontAwesomeIcon :icon="faEye" class="w-3.5 h-3.5 text-violet-600" />
          <span class="text-xs font-semibold text-heading">Vista previa</span>
        </div>
        <div
          class="flex-1 overflow-y-auto px-4 py-3 text-sm prose-ia"
          :class="minHeightClass"
          v-html="modelValue.trim() ? renderMarkdown(modelValue) : '<p class=\'text-muted\'>Sin contenido todavía.</p>'"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.prose-ia :deep(h1),
.prose-ia :deep(h2),
.prose-ia :deep(h3),
.prose-ia :deep(h4) {
  font-weight: 700;
  color: var(--color-heading, #0f172a);
  margin: 0.75rem 0 0.35rem;
}
.prose-ia :deep(h1) { font-size: 1.1rem; }
.prose-ia :deep(h2) { font-size: 1rem; }
.prose-ia :deep(h3) { font-size: 0.95rem; }
.prose-ia :deep(h4) { font-size: 0.9rem; }
.prose-ia :deep(p),
.prose-ia :deep(li) {
  color: #334155;
  line-height: 1.55;
  margin: 0.35rem 0;
}
.prose-ia :deep(ul) {
  list-style: disc;
  padding-left: 1.25rem;
}
.prose-ia :deep(ol) {
  list-style: decimal;
  padding-left: 1.25rem;
}
.prose-ia :deep(strong) {
  font-weight: 700;
  color: #0f172a;
}
.prose-ia :deep(a) {
  color: #7c3aed;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.prose-ia :deep(blockquote) {
  margin: 0.5rem 0;
  padding-left: 0.75rem;
  border-left: 2px solid #cbd5e1;
  color: #475569;
  font-style: italic;
}
.prose-ia :deep(hr) {
  margin: 0.75rem 0;
  border: 0;
  border-top: 1px solid #e2e8f0;
}
.prose-ia :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
  margin: 0.5rem 0;
}
.prose-ia :deep(th),
.prose-ia :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 0.35rem 0.65rem;
  text-align: left;
  vertical-align: top;
  color: #334155;
}
.prose-ia :deep(th) {
  background: #f8fafc;
  font-weight: 600;
  color: #0f172a;
}
/* Solo código INLINE — no aplicar fondo a `pre > code` (rompe contraste). */
.prose-ia :deep(:not(pre) > code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85em;
  background: #f1f5f9;
  color: #0f172a;
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
}
.prose-ia :deep(pre.md-pre),
.prose-ia :deep(pre) {
  margin: 0.5rem 0;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  overflow-x: auto;
}
.prose-ia :deep(pre code),
.prose-ia :deep(code.md-code-block) {
  display: block;
  background: transparent;
  color: #1e293b;
  padding: 0;
  border-radius: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.78rem;
  line-height: 1.55;
  white-space: pre;
  -webkit-font-smoothing: antialiased;
}
</style>
