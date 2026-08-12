// Intérprete de Markdown minimalista y sin dependencias — cubre lo que necesita el contenido de
// "Ayuda para llenar" y "Contextos IA" (encabezados, negrita/cursiva/código inline, enlaces,
// listas, citas, bloques de código, tablas y párrafos).
// No es un parser CommonMark completo a propósito: el contenido lo escribe el propio admin, no
// hace falta soportar la especificación entera.
//
// A diferencia del original en React (que construye nodos JSX), acá se genera un string de HTML
// para usar con `v-html` — el texto crudo se escapa ANTES de aplicar los patrones de markdown, así
// que el HTML final solo contiene las etiquetas que este módulo arma explícitamente. Los bloques de
// código (```) también quedan escapados: nunca se interpreta HTML crudo dentro del markdown fuente,
// ni siquiera dentro de una tabla o un bloque de código — es lo que mantiene esto seguro ante XSS.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function esUrlSegura(url: string): boolean {
  return /^(https?:|mailto:)/i.test(url.trim());
}

function renderInline(textoEscapado: string): string {
  const patron = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/;
  let resultado = '';
  let restante = textoEscapado;
  while (restante) {
    const m = restante.match(patron);
    if (!m || m.index === undefined) {
      resultado += restante;
      break;
    }
    if (m.index > 0) resultado += restante.slice(0, m.index);
    if (m[2] !== undefined) {
      resultado += `<strong>${m[2]}</strong>`;
    } else if (m[3] !== undefined) {
      resultado += `<em>${m[3]}</em>`;
    } else if (m[4] !== undefined) {
      resultado += `<code class="px-1 py-0.5 rounded bg-gray-100 text-[13px] font-mono">${m[4]}</code>`;
    } else if (m[5] !== undefined && m[6] !== undefined) {
      resultado = esUrlSegura(m[6])
        ? resultado + `<a href="${m[6]}" target="_blank" rel="noreferrer" class="text-brand-600 underline">${m[5]}</a>`
        : resultado + m[5];
    }
    restante = restante.slice(m.index + m[0].length);
  }
  return resultado;
}

/** Fila de tabla `| a | b |` -> celdas ya recortadas, sin las barras de los extremos. */
function celdasDeFila(linea: string): string[] {
  let contenido = linea.trim();
  if (contenido.startsWith('|')) contenido = contenido.slice(1);
  if (contenido.endsWith('|')) contenido = contenido.slice(0, -1);
  return contenido.split('|').map((c) => c.trim());
}

const RE_FILA_TABLA = /^\|.*\|$/;
const RE_SEPARADOR_TABLA = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

export function renderMarkdown(texto: string): string {
  if (!texto.trim()) return '';
  const lineas = escapeHtml(texto).split('\n');
  const bloques: string[] = [];
  let lista: { tipo: 'ul' | 'ol'; items: string[] } | null = null;

  const cerrarLista = () => {
    if (!lista) return;
    const clases = lista.tipo === 'ul' ? 'list-disc pl-5 space-y-1 my-2' : 'list-decimal pl-5 space-y-1 my-2';
    const items = lista.items.map((item) => `<li class="text-sm text-gray-700 leading-relaxed">${renderInline(item)}</li>`).join('');
    bloques.push(`<${lista.tipo} class="${clases}">${items}</${lista.tipo}>`);
    lista = null;
  };

  let i = 0;
  while (i < lineas.length) {
    const linea = lineas[i];
    const trim = linea.trim();

    if (!trim) {
      cerrarLista();
      i++;
      continue;
    }

    // Bloque de código ```lenguaje … ``` — el contenido va tal cual (ya viene escapado), sin
    // interpretar ningún patrón de markdown dentro.
    const inicioFence = trim.match(/^```\s*(\S*)\s*$/);
    if (inicioFence) {
      cerrarLista();
      const codigo: string[] = [];
      i++;
      while (i < lineas.length && lineas[i].trim() !== '```') {
        codigo.push(lineas[i]);
        i++;
      }
      i++; // salta la línea de cierre ```
      // Tema claro a propósito: contraste legible en paneles blancos (Contextos IA, ayudas).
      // `whitespace-pre` conserva indentación JSON; el fondo no debe pelearse con estilos de `code` inline.
      bloques.push(
        `<pre class="md-pre my-2 p-3 rounded-lg bg-slate-50 border border-slate-200 overflow-x-auto"><code class="md-code-block text-[12.5px] font-mono text-slate-800 leading-relaxed whitespace-pre">${codigo.join('\n')}</code></pre>`,
      );
      continue;
    }

    // Tabla GFM: fila de encabezado + fila separadora (|---|---|) + filas de datos.
    if (RE_FILA_TABLA.test(trim) && i + 1 < lineas.length && RE_SEPARADOR_TABLA.test(lineas[i + 1].trim())) {
      cerrarLista();
      const encabezados = celdasDeFila(trim);
      i += 2;
      const filas: string[][] = [];
      while (i < lineas.length && RE_FILA_TABLA.test(lineas[i].trim())) {
        filas.push(celdasDeFila(lineas[i].trim()));
        i++;
      }
      const th = encabezados.map((c) => `<th class="px-3 py-1.5 border border-gray-200 bg-gray-50 text-left font-semibold">${renderInline(c)}</th>`).join('');
      const filasHtml = filas
        .map((fila) => `<tr>${fila.map((c) => `<td class="px-3 py-1.5 border border-gray-200 align-top">${renderInline(c)}</td>`).join('')}</tr>`)
        .join('');
      bloques.push(
        `<div class="my-2 overflow-x-auto"><table class="w-full text-sm border-collapse"><thead><tr>${th}</tr></thead><tbody>${filasHtml}</tbody></table></div>`,
      );
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trim)) {
      cerrarLista();
      bloques.push('<hr class="my-3 border-gray-200" />');
      i++;
      continue;
    }

    const cita = trim.match(/^>\s?(.*)$/);
    if (cita) {
      cerrarLista();
      const lineasCita: string[] = [cita[1]];
      i++;
      while (i < lineas.length) {
        const m = lineas[i].trim().match(/^>\s?(.*)$/);
        if (!m) break;
        lineasCita.push(m[1]);
        i++;
      }
      bloques.push(
        `<blockquote class="my-2 pl-3 border-l-2 border-gray-300 text-sm text-gray-600 italic space-y-1">${lineasCita.map((l) => `<p>${renderInline(l)}</p>`).join('')}</blockquote>`,
      );
      continue;
    }

    const encabezado = trim.match(/^(#{1,6})\s+(.*)$/);
    if (encabezado) {
      cerrarLista();
      const nivel = encabezado[1].length;
      const clases = nivel === 1
        ? 'text-base font-bold text-heading mt-3 mb-1'
        : nivel === 2
          ? 'text-sm font-bold text-heading mt-3 mb-1'
          : 'text-sm font-semibold text-heading mt-2 mb-1';
      bloques.push(`<h${nivel} class="${clases}">${renderInline(encabezado[2])}</h${nivel}>`);
      i++;
      continue;
    }

    const itemUl = trim.match(/^[-*]\s+(.*)$/);
    if (itemUl) {
      if (!lista || lista.tipo !== 'ul') { cerrarLista(); lista = { tipo: 'ul', items: [] }; }
      lista.items.push(itemUl[1]);
      i++;
      continue;
    }

    const itemOl = trim.match(/^\d+\.\s+(.*)$/);
    if (itemOl) {
      if (!lista || lista.tipo !== 'ol') { cerrarLista(); lista = { tipo: 'ol', items: [] }; }
      lista.items.push(itemOl[1]);
      i++;
      continue;
    }

    cerrarLista();
    bloques.push(`<p class="text-sm text-gray-700 leading-relaxed">${renderInline(trim)}</p>`);
    i++;
  }
  cerrarLista();

  return `<div class="space-y-1">${bloques.join('')}</div>`;
}
