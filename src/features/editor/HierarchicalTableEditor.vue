<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faPlus, faTrash, fieldTypeIcons } from '@/lib/icons';
import CampoListaInput from '@/components/CampoListaInput.vue';
import CampoBooleanoInput from '@/components/CampoBooleanoInput.vue';
import { EXCEL_VIVO } from '@/composables/useListasExcel';
import { etiquetaDeValor, textoVisibleDeNumero } from '@/lib/conversionesExcel';
import { createNodeChain, parseTree, getPeriodos, agrupadorProfundidad, esJerarquica, posicionesArbol, posicionDe, varianteBooleanoColumna, type TreeNode } from '@/lib/tableRowHelpers';
import { estiloAnchoColumna, iniciarResizeColumna } from '@/lib/tableColumnWidth';
import type { ConfigTabla, CabeceraGrupo, ColumnaTabla } from '@/types';

// El componente de mayor riesgo de fidelidad de toda la migración (ver plan): edición de un árbol
// jerárquico con selección de celda por clic, edición inline, navegación por flechas y expansión de
// filas por rowspan calculado dinámicamente — igual interacción documentada en el CLAUDE.md del
// prototipo. Clic = selecciona Y entra en edición. Enter confirma sin deseleccionar. Flechas
// navegan (↑↓ hermanos, ←→ padre/hijo) solo fuera de modo edición. Escape sale de edición o
// deselecciona.
const props = defineProps<{
  config: ConfigTabla;
  modelValue: string;
  /** true = permite agregar/renombrar columnas dinámicas (solo tab Estructura) */
  puedeEditarPeriodos?: boolean;
  /** Hoja de Excel de la sección — habilita desplegables y cálculo en vivo dentro de las celdas */
  hoja?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [string]; 'update:config': [ConfigTabla] }>();

function cloneTree(roots: TreeNode[]): TreeNode[] {
  return JSON.parse(JSON.stringify(roots));
}
function getNode(roots: TreeNode[], path: number[]): TreeNode | null {
  let current: TreeNode | undefined = roots[path[0]];
  for (let i = 1; i < path.length && current; i++) current = current.children[path[i]];
  return current ?? null;
}
function samePath(a: number[] | null, b: number[]): boolean {
  return !!a && JSON.stringify(a) === JSON.stringify(b);
}

// --- Flat rows builder (calcula rowspan dinámico por selección) ---

type FlatCell =
  | { type: 'data'; value: string | string[]; path: number[]; rowSpan: number }
  | { type: 'group-title'; value: string | string[]; path: number[]; colSpan: number }
  // Columna libre a la derecha del título de grupo: editable, guarda en node.valores[colId]
  | { type: 'group-extra'; path: number[]; colId: string; value: string | string[] }
  | { type: 'add'; parentPath: number[] }
  | { type: 'empty' };

interface FlatRow { cells: (FlatCell | null)[]; isGroupStart?: boolean }

// Un nivel de agrupador NO consume columna: sus hijos siguen en la MISMA columna, debajo de la fila
// de título. Así las columnas se configuran como en cualquier jerárquica y el agrupador es solo una
// forma de dibujar un nivel — antes se comía un slot, y por eso había que declarar una columna
// entera para él (la "Detalle (grupo)" duplicada de 3.07.01).
function getNodeSpan(node: TreeNode, colIdx: number, numCols: number, selectedPath: number[] | null, path: number[], agrupadorDepth: number, prof = 0): number {
  const esNivelAgrupador = prof === agrupadorDepth && node.children.length > 0;
  const isLeaf = node.children.length === 0 || (!esNivelAgrupador && colIdx >= numCols - 1);
  const colDeHijos = esNivelAgrupador ? colIdx : colIdx + 1;
  const childrenSpan = isLeaf ? 0 : node.children.reduce((s, c, ci) => s + getNodeSpan(c, colDeHijos, numCols, selectedPath, [...path, ci], agrupadorDepth, prof + 1), 0);
  const baseSpan = isLeaf ? 1 : esNivelAgrupador ? 1 + childrenSpan : childrenSpan;
  const sel = samePath(selectedPath, path);
  return baseSpan + (sel && colIdx < numCols - 1 ? 1 : 0);
}

function buildFlatRows(roots: TreeNode[], numCols: number, selectedPath: number[] | null, agrupadorDepth: number, abarcaGrupo: number | undefined, columnas: ColumnaTabla[]): FlatRow[] {
  const rows: FlatRow[] = [];

  function walkNode(node: TreeNode, colIdx: number, path: number[], prof = 0) {
    const esNivelAgrupador = prof === agrupadorDepth && node.children.length > 0;
    const isLeaf = node.children.length === 0 || (!esNivelAgrupador && colIdx >= numCols - 1);
    const sel = samePath(selectedPath, path);
    const addRowNeeded = sel && colIdx < numCols - 1;

    // Nivel de agrupador: en vez de fusionar su celda a la izquierda de la primera fila hija, esta
    // celda ocupa su propia fila de título de ancho completo (igual patrón que GroupedRowsEditor).
    // Sus hijos siguen en la MISMA columna: el título no desplaza la tabla a la derecha.
    if (esNivelAgrupador) {
      const titleRow: FlatRow = { cells: Array(numCols).fill(null) };
      // El título abarca las cabeceras que se hayan configurado (engranaje del agrupador), contando
      // desde su propia columna; por defecto, hasta el final. Las que quedan LIBRES a su derecha son
      // editables y guardan en node.valores — es la fila-resumen del grupo (ej. el total del grupo).
      const disponibles = numCols - colIdx;
      const abarca = Math.min(Math.max(abarcaGrupo ?? disponibles, 1), disponibles);
      titleRow.cells[colIdx] = { type: 'group-title', value: node.value, path, colSpan: abarca };
      for (let i = colIdx + abarca; i < numCols; i++) {
        const colId = columnas[i]?.id ?? '';
        // Las celdas partidas (4.8) no aplican a una fila de grupo: solo texto o valor por período.
        const bruto = node.valores?.[colId];
        const valor = typeof bruto === 'string' || Array.isArray(bruto) ? bruto : '';
        titleRow.cells[i] = { type: 'group-extra', path, colId, value: valor };
      }
      rows.push(titleRow);
      node.children.forEach((child, ci) => walkNode(child, colIdx, [...path, ci], prof + 1));
      if (addRowNeeded) {
        const addRow: FlatRow = { cells: Array(numCols).fill(null) };
        addRow.cells[colIdx] = { type: 'add', parentPath: path };
        for (let i = colIdx + 1; i < numCols; i++) addRow.cells[i] = { type: 'empty' };
        rows.push(addRow);
      }
      return;
    }

    const colDeHijos = colIdx + 1;
    const baseSpan = isLeaf ? 1 : node.children.reduce((s, c, ci) => s + getNodeSpan(c, colDeHijos, numCols, selectedPath, [...path, ci], agrupadorDepth, prof + 1), 0);
    const totalSpan = baseSpan + (addRowNeeded ? 1 : 0);

    if (isLeaf) {
      const row: FlatRow = { cells: Array(numCols).fill(null) };
      row.cells[colIdx] = { type: 'data', value: node.value, path, rowSpan: totalSpan };
      for (let i = colIdx + 1; i < numCols; i++) row.cells[i] = { type: 'empty' };
      rows.push(row);
    } else {
      const startRow = rows.length;
      node.children.forEach((child, ci) => walkNode(child, colDeHijos, [...path, ci], prof + 1));
      if (rows[startRow]) rows[startRow].cells[colIdx] = { type: 'data', value: node.value, path, rowSpan: totalSpan };
      for (let r = startRow + 1; r < startRow + baseSpan; r++) { if (rows[r]) rows[r].cells[colIdx] = null; }
    }

    if (addRowNeeded) {
      const addRow: FlatRow = { cells: Array(numCols).fill(null) };
      addRow.cells[colIdx + 1] = { type: 'add', parentPath: path };
      for (let i = colIdx + 2; i < numCols; i++) addRow.cells[i] = { type: 'empty' };
      rows.push(addRow);
    }
  }

  roots.forEach((root, ri) => {
    const startIdx = rows.length;
    walkNode(root, 0, [ri]);
    if (rows[startIdx]) rows[startIdx].isGroupStart = ri > 0;
  });
  return rows;
}

// --- Estado ---

const columns = computed(() => props.config.columnas);
const numCols = computed(() => columns.value.length);
const dinamicaId = computed(() => props.config.columnaDinamicaId);
const periodos = computed(() => getPeriodos(props.config));
const agrupadorDepth = computed(() => (props.config.agrupador ? agrupadorProfundidad(columns.value, props.config) : -1));

/** Sí/No si es la única booleana; casilla si hay ≥2 sin etiquetas en la tabla. */
function varianteBooleanoCol(col: (typeof columns.value)[number] | undefined): 'si_no' | 'casilla' {
  if (!col) return 'si_no';
  return varianteBooleanoColumna(col, columns.value);
}

const roots = ref<TreeNode[]>(parseTree(props.modelValue, columns.value, props.config));
watch(() => props.modelValue, (v) => { roots.value = parseTree(v, columns.value, props.config); });

const selectedPath = ref<number[] | null>(null);
const isEditing = ref(false);
const focusPath = ref<string | null>(null);
const tableRef = ref<HTMLDivElement | null>(null);
const inputRefs = new Map<string, HTMLInputElement | HTMLTextAreaElement>();

function setInputRef(pathStr: string, el: Element | { $el: Element } | null) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) inputRefs.set(pathStr, el);
}

function persist(next: TreeNode[]) {
  roots.value = next;
  emit('update:modelValue', JSON.stringify(next));
}

function updateNodeValue(path: number[], val: string) {
  const next = cloneTree(roots.value);
  const node = getNode(next, path);
  if (node) node.value = val;
  persist(next);
}
function updateNodePeriodo(path: number[], periodoIdx: number, val: string) {
  const next = cloneTree(roots.value);
  const node = getNode(next, path);
  if (!node) return;
  const arr = Array.isArray(node.value) ? [...node.value] : [];
  arr[periodoIdx] = val;
  node.value = arr;
  persist(next);
}

// Valores propios de la fila de título de grupo, en las columnas libres a su derecha (4.5c).
function updateGrupoValor(path: number[], colId: string, val: string) {
  const next = cloneTree(roots.value);
  const node = getNode(next, path);
  if (!node) return;
  node.valores = { ...(node.valores ?? {}), [colId]: val };
  persist(next);
}
function updateGrupoValorPeriodo(path: number[], colId: string, periodoIdx: number, val: string) {
  const next = cloneTree(roots.value);
  const node = getNode(next, path);
  if (!node) return;
  const actual = node.valores?.[colId];
  const arr = Array.isArray(actual) ? [...actual] : [];
  arr[periodoIdx] = val;
  node.valores = { ...(node.valores ?? {}), [colId]: arr };
  persist(next);
}

function addRoot() {
  const newIdx = roots.value.length;
  persist([...roots.value, createNodeChain(columns.value, props.config)]);
  selectedPath.value = [newIdx];
  isEditing.value = true;
  focusPath.value = JSON.stringify([newIdx]);
}
function addChildAt(path: number[]) {
  const next = cloneTree(roots.value);
  const parent = getNode(next, path);
  if (!parent) return;
  const newChildIdx = parent.children.length;
  parent.children.push(createNodeChain(columns.value, props.config, path.length));
  persist(next);
  const newPath = [...path, newChildIdx];
  selectedPath.value = newPath;
  isEditing.value = true;
  focusPath.value = JSON.stringify(newPath);
}
function removeNode(path: number[]) {
  const next = cloneTree(roots.value);
  if (path.length === 1) {
    if (next.length <= 1) return;
    next.splice(path[0], 1);
  } else {
    const parent = getNode(next, path.slice(0, -1));
    if (parent) parent.children.splice(path[path.length - 1], 1);
  }
  persist(next);
  if (samePath(selectedPath.value, path)) { selectedPath.value = null; isEditing.value = false; }
}

interface NavCell { path: number[]; colIndex: number }
function navGrid(): NavCell[] {
  const cells: NavCell[] = [];
  function walk(node: TreeNode, colIdx: number, path: number[]) {
    cells.push({ path, colIndex: colIdx });
    node.children.forEach((child, ci) => walk(child, colIdx + 1, [...path, ci]));
  }
  roots.value.forEach((root, ri) => walk(root, 0, [ri]));
  return cells;
}

function navigate(direction: 'up' | 'down' | 'left' | 'right') {
  if (!selectedPath.value) return;
  const grid = navGrid();
  const currentIdx = grid.findIndex((c) => samePath(selectedPath.value, c.path));
  if (currentIdx === -1) return;
  const current = grid[currentIdx];
  let target: NavCell | undefined;

  if (direction === 'up' || direction === 'down') {
    const parentPath = selectedPath.value.slice(0, -1);
    const siblings = grid.filter((c) => c.colIndex === current.colIndex && JSON.stringify(c.path.slice(0, -1)) === JSON.stringify(parentPath));
    const sibIdx = siblings.findIndex((c) => samePath(selectedPath.value, c.path));
    if (direction === 'up' && sibIdx > 0) target = siblings[sibIdx - 1];
    if (direction === 'down' && sibIdx < siblings.length - 1) target = siblings[sibIdx + 1];
  } else if (direction === 'left') {
    if (selectedPath.value.length > 1) target = { path: selectedPath.value.slice(0, -1), colIndex: current.colIndex - 1 };
  } else if (direction === 'right') {
    const node = getNode(roots.value, selectedPath.value);
    if (node && node.children.length > 0) target = { path: [...selectedPath.value, 0], colIndex: current.colIndex + 1 };
  }

  if (target) { selectedPath.value = target.path; isEditing.value = false; }
}

function handleKeyDown(e: KeyboardEvent) {
  if (!selectedPath.value) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    if (isEditing.value) {
      isEditing.value = false;
      const input = inputRefs.get(JSON.stringify(selectedPath.value));
      input?.blur();
      tableRef.value?.focus();
    } else {
      isEditing.value = true;
      focusPath.value = JSON.stringify(selectedPath.value);
    }
    return;
  }

  if (!isEditing.value) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const dir = e.key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right';
      navigate(dir);
    }
    if (e.key === 'Escape') {
      selectedPath.value = null;
      isEditing.value = false;
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    isEditing.value = false;
    const input = inputRefs.get(JSON.stringify(selectedPath.value));
    input?.blur();
    tableRef.value?.focus();
  }
}

watch(focusPath, async (fp) => {
  if (!fp) return;
  await nextTick();
  const input = inputRefs.get(fp);
  if (input) { input.focus(); focusPath.value = null; }
});

function isPathSelected(path: number[]) { return samePath(selectedPath.value, path); }
function isPathAncestor(path: number[]) {
  if (!selectedPath.value || path.length >= selectedPath.value.length) return false;
  return path.every((v, i) => selectedPath.value![i] === v);
}

const flatRows = computed(() => buildFlatRows(roots.value, numCols.value, selectedPath.value, agrupadorDepth.value, props.config.agrupadorAbarcaColumnas, columns.value));

// --- Ayudas del Excel dentro del árbol ---
// Mismo servicio que ya usaban las tablas de filas dinámicas (TableRow), aquí resuelto a mano
// porque este editor pinta sus propias celdas. Para preguntarle al Excel por una celda hace falta
// su fila real, y eso obliga a replicar cómo el escritor aplana el árbol: una fila del Excel por
// cada fila visual que lleve datos. Las filas de "+" son puro UI y no consumen fila en el archivo
// — contarlas correría toda la tabla hacia abajo.
const excel = inject(EXCEL_VIVO, undefined);

// La fila de cada nodo NO se deduce contando filas visuales: se pide a `posicionesArbol`, la misma
// función que usa el escritor para decidir dónde escribir. Así la celda que la UI consulta y la
// celda donde el dato acaba en el archivo son siempre la misma por construcción.
const posiciones = computed(() => {
  const filaInicial = props.config.captura?.filaInicial;
  if (!props.hoja || !filaInicial) return null;
  return posicionesArbol(
    roots.value,
    props.config,
    props.hoja,
    filaInicial,
    agrupadorDepth.value,
    (hoja, columna, fila) => excel?.value?.altoDeBloque(hoja, columna, fila),
  );
});

/** Celda de Excel del nodo dibujado en esa columna, o null si no se puede resolver. */
function refCelda(path: number[], ci: number): string | null {
  const columna = columns.value[ci]?.columnaExcel;
  if (!excel?.value || !props.hoja || !columna || !posiciones.value) return null;
  const pos = posicionDe(posiciones.value, path);
  return pos ? `${columna}${pos.fila}` : null;
}

/** Opciones del desplegable declarado en el Excel para esa celda, o null. */
function opcionesCelda(path: number[], ci: number): string[] | null {
  const ref = refCelda(path, ci);
  if (!ref || !props.hoja) return null;
  const ops = excel?.value?.opcionesDe(props.hoja, ref);
  return ops && ops.length > 0 ? ops : null;
}

// El valor guardado ya es la palabra del Excel; la traducción solo entra para los ejemplos
// anteriores, que guardaron 'true'/'false' (ver etiquetaDeValor). Si la celda tiene máscara
// (`"E-"00`) y el JSON aún trae el crudo (`1`), se muestra como en Excel (E-01).
function valorMostradoCelda(valor: unknown, path: number[], ci: number, opciones: string[] | null): string {
  const bruto = typeof valor === 'string' ? valor : '';
  const base = etiquetaDeValor(bruto, opciones, columns.value[ci]?.etiquetasBooleano);
  const ref = refCelda(path, ci);
  if (!ref || !props.hoja) return base;
  const fmt = excel?.value?.codigoFormato?.(props.hoja, ref);
  return textoVisibleDeNumero(base, fmt) ?? base;
}

/** Lo que el Excel calcula en esa celda, o null si no lleva fórmula. */
function calculoCelda(path: number[], ci: number) {
  const ref = refCelda(path, ci);
  if (!ref || !props.hoja) return null;
  return excel?.value?.calculado(props.hoja, ref) ?? null;
}

const grupos = computed(() => props.config.cabeceras ?? []);
const hasCabeceras = computed(() => grupos.value.length > 0);
function grupoForId(id: string): CabeceraGrupo | undefined { return grupos.value.find((g) => g.hijoIds.includes(id)); }

interface Run { grupo?: CabeceraGrupo; cols: ColumnaTabla[] }
const runs = computed(() => {
  const list: Run[] = [];
  for (const col of columns.value) {
    const g = grupoForId(col.id);
    const last = list[list.length - 1];
    if (last && g && last.grupo === g) last.cols.push(col);
    else list.push({ grupo: g, cols: [col] });
  }
  return list;
});

function selectCell(path: number[]) {
  selectedPath.value = path;
  isEditing.value = true;
  focusPath.value = JSON.stringify(path);
}

// --- Grupos en tablas jerárquicas ---
//
// Un grupo NO es un dato aparte: es un nodo del árbol en el nivel `agrupadorNivel`, que se dibuja
// como fila de título de ancho completo. Elegir el nivel con un clic debajo de una columna sustituye
// al mecanismo viejo (marcar columnas como Padre/Hijo), que obligaba a gastar una columna entera en
// el agrupador. La última columna nunca puede serlo: un grupo necesita columnas a su derecha.
const puedeAgrupar = computed(() => props.config.agrupador && esJerarquica(props.config.subtipo));

// ¿Ya hay algún nodo en el nivel del agrupador? Mientras no lo haya, el nivel sigue libre y el botón
// se ofrece bajo todas las columnas; en cuanto existe el primer grupo, queda fijado (una tabla tiene
// un único nivel de agrupación, igual que en el Excel).
const nivelFijado = computed(() => {
  if (!puedeAgrupar.value) return null;
  if (typeof props.config.agrupadorNivel !== 'number') return null;
  return hayNodoEnNivel(roots.value, 0, props.config.agrupadorNivel) ? props.config.agrupadorNivel : null;
});

function hayNodoEnNivel(nodos: TreeNode[], prof: number, objetivo: number): boolean {
  if (prof === objetivo) return nodos.length > 0;
  return nodos.some((n) => hayNodoEnNivel(n.children, prof + 1, objetivo));
}

function puedeAgregarGrupoEn(colIdx: number): boolean {
  if (!puedeAgrupar.value || colIdx >= numCols.value - 1) return false;
  return nivelFijado.value === null || nivelFijado.value === colIdx;
}

// Desciende por el último hijo de cada nivel hasta `nivel`, y ahí cuelga el grupo nuevo. Si el árbol
// todavía no llega a esa profundidad, se crean los eslabones que falten.
function addGrupoEnNivel(nivel: number) {
  const next = cloneTree(roots.value);
  if (nivel === 0) {
    next.push(createNodeChain(columns.value, props.config, 0));
  } else {
    let actual: TreeNode | undefined = next[next.length - 1];
    for (let prof = 1; prof < nivel && actual; prof++) {
      if (actual.children.length === 0) actual.children.push(createNodeChain(columns.value, props.config, prof));
      actual = actual.children[actual.children.length - 1];
    }
    if (!actual) return;
    actual.children.push(createNodeChain(columns.value, props.config, nivel));
  }

  if (props.config.agrupadorNivel !== nivel) emit('update:config', { ...props.config, agrupadorNivel: nivel });
  persist(next);

  const path = pathUltimoEnNivel(next, nivel);
  if (path) { selectedPath.value = path; isEditing.value = true; focusPath.value = JSON.stringify(path); }
}

function pathUltimoEnNivel(nodos: TreeNode[], nivel: number): number[] | null {
  if (nodos.length === 0) return null;
  const idx = nodos.length - 1;
  if (nivel === 0) return [idx];
  const hijo = pathUltimoEnNivel(nodos[idx].children, nivel - 1);
  return hijo ? [idx, ...hijo] : null;
}

function addPeriodo() {
  emit('update:config', { ...props.config, periodos: [...(props.config.periodos ?? []), ''] });
}
function renamePeriodo(pi: number, value: string) {
  const periodos = [...(props.config.periodos ?? [])];
  periodos[pi] = value;
  emit('update:config', { ...props.config, periodos });
}
function resizeColumna(colId: string, anchoPx: number) {
  // Solo UI en sesión: no escribe en config/plantilla (evita autoguardado masivo al arrastrar).
  anchosLocales.value = { ...anchosLocales.value, [colId]: anchoPx };
}
function partsDe(col: ColumnaTabla): number {
  if (col.id === dinamicaId.value && periodos.value.length > 0) return periodos.value.length;
  return 1;
}
function estiloDe(col: ColumnaTabla | undefined) {
  const ancho = col ? (anchosLocales.value[col.id] ?? col.ancho) : undefined;
  return col ? estiloAnchoColumna(ancho, partsDe(col)) : undefined;
}
function onResizeStart(col: ColumnaTabla, e: MouseEvent) {
  const parts = partsDe(col);
  const th = (e.currentTarget as HTMLElement).parentElement;
  const anchoGuardado = anchosLocales.value[col.id] ?? col.ancho;
  const anchoActual = anchoGuardado && anchoGuardado > 0 ? anchoGuardado : (th?.offsetWidth ?? 96) * parts;
  iniciarResizeColumna(e.clientX, anchoActual, (ancho) => resizeColumna(col.id, ancho));
}

const anchosLocales = ref<Record<string, number>>({});
</script>

<template>
  <div class="mt-2">
    <div ref="tableRef" tabindex="0" @keydown="handleKeyDown" class="overflow-x-auto rounded-lg border border-gray-300 outline-none">
      <table
        class="w-full text-xs"
        style="border-collapse: collapse"
        :class="Object.keys(anchosLocales).length > 0 || columns.some((c) => c.ancho) ? 'table-fixed' : ''"
      >
        <thead>
          <tr v-if="hasCabeceras" class="bg-brand-900">
            <template v-for="(run, ri) in runs" :key="ri">
              <th
                v-if="run.grupo"
                :colspan="run.cols.reduce((s, c) => s + (c.id === dinamicaId ? Math.max(periodos.length, 1) : 1), 0)"
                class="px-2 py-1.5 text-center font-semibold text-white border border-white/40 bg-brand-900 break-words whitespace-normal text-[11px]"
              >
                {{ run.grupo.titulo || 'Sin título' }}
              </th>
              <template v-for="col in (run.grupo ? [] : run.cols)" :key="col.id">
                <th
                  v-if="col.id === dinamicaId && periodos.length > 0"
                  :colspan="periodos.length"
                  class="px-3 py-2 text-left font-semibold text-white border-b border-white/40 bg-brand-700 break-words whitespace-normal text-[11px] uppercase tracking-wider align-top"
                  :class="col.id === columns[numCols - 1].id ? '' : 'border-r border-white/40'"
                >
                  {{ col.nombre }}
                </th>
                <th
                  v-else
                  rowspan="2"
                  class="px-3 py-2 text-left font-semibold text-white border-b-2 border-white/40 bg-brand-700 break-words whitespace-normal text-[11px] uppercase tracking-wider align-middle"
                  :class="col.id === columns[numCols - 1].id ? '' : 'border-r border-white/40'"
                >
                  {{ col.nombre }}
                </th>
              </template>
            </template>
            <th rowspan="2" class="w-6 border-b-2 border-white/40 bg-brand-900" />
          </tr>
          <tr class="bg-brand-700">
            <template v-if="hasCabeceras">
              <template v-for="run in runs" :key="run.grupo?.titulo ?? run.cols[0].id">
                <template v-for="col in (run.grupo ? run.cols : [])" :key="col.id">
                  <template v-if="col.id === dinamicaId && periodos.length > 0">
                    <th
                      v-for="(p, pi) in periodos"
                      :key="`${col.id}-${pi}`"
                      :style="estiloDe(col)"
                      class="relative px-1.5 py-1.5 text-left font-medium text-white border-b border-amber-300 bg-brand-700 break-words whitespace-normal text-[11px]"
                    >
                      <div class="flex items-center gap-1">
                        <input
                          v-if="puedeEditarPeriodos"
                          :value="p"
                          @input="renamePeriodo(pi, ($event.target as HTMLInputElement).value)"
                          @click.stop
                          type="text"
                          placeholder="Nombre..."
                          class="w-14 px-1 py-0.5 rounded border border-amber-300 bg-brand-100 text-gray-900 text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-400/40 focus:border-amber-400"
                        />
                        <span v-else class="underline decoration-amber-400">{{ p }}</span>
                        <button
                          v-if="pi === periodos.length - 1 && puedeEditarPeriodos"
                          @click.stop="addPeriodo"
                          type="button"
                          title="Agregar columna dinámica"
                          class="w-4 h-4 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shrink-0"
                        >
                          <FontAwesomeIcon :icon="faPlus" class="w-2 h-2" />
                        </button>
                      </div>
                      <div
                        class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60"
                        title="Arrastrar para cambiar el ancho"
                        @mousedown.stop.prevent="onResizeStart(col, $event)"
                      />
                    </th>
                  </template>
                  <th
                    v-else
                    class="px-3 py-2 text-left font-semibold text-white border-b-2 border-white/40 bg-brand-700 break-words whitespace-normal text-[11px] uppercase tracking-wider align-top"
                    :class="col.id === columns[numCols - 1].id ? '' : 'border-r border-white/40'"
                  >
                    {{ col.nombre }}
                  </th>
                </template>
              </template>
            </template>
            <template v-else>
              <template v-for="(col, ci) in columns" :key="col.id">
                <template v-if="col.id === dinamicaId && periodos.length > 0">
                  <th
                    v-for="(p, pi) in periodos"
                    :key="`${col.id}-${pi}`"
                    :style="estiloDe(col)"
                    class="relative px-1.5 py-1.5 text-left font-medium text-white border-b border-amber-300 bg-brand-700 break-words whitespace-normal text-[11px] align-top"
                    :class="ci === numCols - 1 && pi === periodos.length - 1 ? '' : 'border-r border-white/40'"
                  >
                    <div class="flex items-start gap-1 min-w-0">
                      <input
                        v-if="puedeEditarPeriodos"
                        :value="p"
                        @input="renamePeriodo(pi, ($event.target as HTMLInputElement).value)"
                        @click.stop
                        type="text"
                        placeholder="Nombre..."
                        class="min-w-0 flex-1 px-1 py-0.5 rounded border border-amber-300 bg-brand-100 text-gray-900 text-[10px] focus:outline-none focus:ring-1 focus:ring-amber-400/40 focus:border-amber-400"
                      />
                      <span v-else class="underline decoration-amber-400 break-words min-w-0">{{ p }}</span>
                      <button
                        v-if="pi === periodos.length - 1 && puedeEditarPeriodos"
                        @click.stop="addPeriodo"
                        type="button"
                        title="Agregar columna dinámica"
                        class="w-4 h-4 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shrink-0"
                      >
                        <FontAwesomeIcon :icon="faPlus" class="w-2 h-2" />
                      </button>
                    </div>
                    <div
                      class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60"
                      title="Arrastrar para cambiar el ancho"
                      @mousedown.stop.prevent="onResizeStart(col, $event)"
                    />
                  </th>
                </template>
                <th
                  v-else
                  :style="estiloDe(col)"
                  class="relative px-3 py-2 text-left font-semibold text-white border-b-2 border-white/40 bg-brand-700 break-words whitespace-normal text-[11px] uppercase tracking-wider align-top"
                  :class="ci === numCols - 1 ? '' : 'border-r border-white/40'"
                >
                  {{ col.nombre }}
                  <div
                    class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500/60"
                    title="Arrastrar para cambiar el ancho"
                    @mousedown.stop.prevent="onResizeStart(col, $event)"
                  />
                </th>
              </template>
            </template>
            <th v-if="!hasCabeceras" class="w-6 border-b-2 border-white/40 bg-brand-700" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in flatRows" :key="ri" :class="row.isGroupStart ? 'border-t-2 border-gray-400' : 'border-t border-gray-200'">
            <template v-for="(cell, ci) in row.cells" :key="ci">
              <td v-if="cell === null" style="display: none" />

              <template v-else-if="columns[ci]?.id === dinamicaId && periodos.length > 0">
                <template v-if="cell.type === 'data'">
                  <td
                    v-for="(p, pi) in periodos"
                    :key="`${ci}-${pi}`"
                    :rowspan="cell.rowSpan > 1 ? cell.rowSpan : undefined"
                    class="px-1 py-1 align-top group/cell"
                    :class="[
                      pi === periodos.length - 1 ? '' : 'border-r border-gray-200',
                      isPathSelected(cell.path) ? 'bg-brand-100' : isPathAncestor(cell.path) ? 'bg-brand-50/50' : 'bg-amber-50/20',
                    ]"
                  >
                    <div class="flex items-center gap-0.5">
                      <input
                        :value="(Array.isArray(cell.value) ? cell.value[pi] : '') || ''"
                        :title="p"
                        :placeholder="p || '—'"
                        type="text"
                        @input="updateNodePeriodo(cell.path, pi, ($event.target as HTMLInputElement).value)"
                        @click.stop="selectCell(cell.path)"
                        class="flex-1 min-w-0 px-1 py-1 rounded border border-transparent hover:border-amber-200 focus:border-amber-400 text-xs text-heading focus:outline-none focus:ring-1 focus:ring-amber-500/30 bg-transparent"
                      />
                      <button
                        v-if="pi === periodos.length - 1"
                        @click.stop="removeNode(cell.path)"
                        type="button"
                        title="Eliminar fila"
                        class="w-4 h-4 rounded flex items-center justify-center text-gray-300 opacity-0 group-hover/cell:opacity-100 hover:text-red-500 transition-opacity shrink-0"
                      >
                        <FontAwesomeIcon :icon="faTrash" class="w-2 h-2" />
                      </button>
                    </div>
                  </td>
                </template>
                <!-- Columna dinámica libre en la fila de grupo: un valor por período -->
                <template v-else-if="cell.type === 'group-extra'">
                  <td
                    v-for="(p, pi) in periodos"
                    :key="`ge-${ci}-${pi}`"
                    class="px-1 py-1 bg-brand-50/60 border-t-2 border-brand-200"
                    :class="pi === periodos.length - 1 ? '' : 'border-r border-gray-200'"
                  >
                    <input
                      :value="(Array.isArray(cell.value) ? cell.value[pi] : '') || ''"
                      :title="p"
                      :placeholder="p || '—'"
                      type="text"
                      @input="updateGrupoValorPeriodo(cell.path, cell.colId, pi, ($event.target as HTMLInputElement).value)"
                      @click.stop
                      class="w-full min-w-0 px-1 py-1 rounded border border-transparent hover:border-amber-200 focus:border-amber-400 text-xs font-semibold text-heading focus:outline-none focus:ring-1 focus:ring-amber-500/30 bg-transparent"
                    />
                  </td>
                </template>
                <td v-else :colspan="periodos.length" class="px-1.5 py-1" :class="cell.type === 'empty' ? 'bg-gray-50/50' : ''">
                  <button
                    v-if="cell.type === 'add'"
                    @click.stop="addChildAt(cell.parentPath)"
                    type="button"
                    class="w-full py-1.5 rounded bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                  >
                    <FontAwesomeIcon :icon="faPlus" class="w-2.5 h-2.5" /> {{ columns[ci]?.nombre }}
                  </button>
                </td>
              </template>

              <!-- Columna libre a la derecha del título de grupo: es la fila-resumen del grupo (ej.
                   el total de sus ítems). Recibe el mismo trato del Excel que cualquier otra celda
                   —cálculo en vivo o desplegable—, porque en el archivo es una celda como las demás:
                   la fila del grupo con la columna de esa columna libre. -->
              <td
                v-else-if="cell.type === 'group-extra'"
                class="px-1.5 py-1 align-top bg-brand-50/60 border-t-2 border-brand-200"
                :class="ci < numCols - 1 ? 'border-r border-gray-300' : ''"
              >
                <div v-if="calculoCelda(cell.path, ci)" class="flex items-start gap-1 px-1 py-1">
                  <FontAwesomeIcon :icon="fieldTypeIcons.calculado" class="w-2.5 h-2.5 text-sky-500 shrink-0 mt-0.5" title="Lo calcula el Excel" />
                  <span v-if="!calculoCelda(cell.path, ci)!.soportado" class="text-[11px] text-sky-800/60 italic">Lo calcula el Excel</span>
                  <span v-else-if="calculoCelda(cell.path, ci)!.error" class="text-[11px] text-amber-700 font-mono">{{ calculoCelda(cell.path, ci)!.error }}</span>
                  <span v-else-if="calculoCelda(cell.path, ci)!.texto" class="text-xs font-semibold text-heading break-words">{{ calculoCelda(cell.path, ci)!.texto }}</span>
                  <span v-else class="text-[11px] text-muted">—</span>
                </div>
                <CampoListaInput
                  v-else-if="opcionesCelda(cell.path, ci)"
                  :value="valorMostradoCelda(cell.value, cell.path, ci, opcionesCelda(cell.path, ci))"
                  :opciones="opcionesCelda(cell.path, ci) ?? []"
                  compacto
                  @change="updateGrupoValor(cell.path, cell.colId, $event)"
                  @click.stop
                />
                <!-- Columna booleana: con etiquetas → Sí/No; sin ellas → un círculo -->
                <CampoBooleanoInput
                  v-else-if="columns[ci]?.tipo === 'booleano'"
                  :value="typeof cell.value === 'string' ? cell.value : ''"
                  :etiquetas="columns[ci]?.etiquetasBooleano ?? (varianteBooleanoCol(columns[ci]) === 'si_no' ? { true: 'Sí', false: 'No' } : null)"
                  :variante="varianteBooleanoCol(columns[ci])"
                  compacto
                  @change="updateGrupoValor(cell.path, cell.colId, $event)"
                />
                <textarea
                  v-else
                  :value="typeof cell.value === 'string' ? cell.value : ''"
                  rows="1"
                  :placeholder="`${columns[ci]?.nombre}...`"
                  @input="updateGrupoValor(cell.path, cell.colId, ($event.target as HTMLTextAreaElement).value)"
                  @click.stop
                  class="block w-full px-1.5 py-1 rounded border border-transparent hover:border-gray-200 focus:border-brand-300 text-xs font-semibold text-heading focus:outline-none focus:ring-1 focus:ring-brand-500/30 bg-transparent resize-none overflow-y-auto max-h-[15lh] [field-sizing:content]"
                />
              </td>

              <td
                v-else-if="cell.type === 'group-title'"
                :colspan="cell.colSpan"
                class="px-2 py-1.5 bg-brand-50/60 border-t-2 border-brand-200"
                @click.stop="selectCell(cell.path)"
              >
                <div class="flex items-center gap-2 group/cell">
                  <textarea
                    :ref="(el) => setInputRef(JSON.stringify(cell.path), el as Element)"
                    :value="typeof cell.value === 'string' ? cell.value : ''"
                    rows="1"
                    :readonly="!(isPathSelected(cell.path) && isEditing)"
                    tabindex="-1"
                    placeholder="Nombre del grupo..."
                    @input="updateNodeValue(cell.path, ($event.target as HTMLTextAreaElement).value)"
                    @click.stop="() => { if (!(isPathSelected(cell.path) && isEditing)) selectCell(cell.path); }"
                    class="flex-1 min-w-0 px-1.5 py-1 rounded border text-xs font-semibold tracking-wide text-heading focus:outline-none resize-none overflow-y-auto max-h-[15lh] [field-sizing:content] bg-transparent"
                    :class="isPathSelected(cell.path) && isEditing ? 'border-brand-400 bg-white ring-1 ring-brand-500/30' : 'border-transparent cursor-pointer'"
                  />
                  <button
                    @click.stop="removeNode(cell.path)"
                    type="button"
                    class="w-4 h-4 rounded flex items-center justify-center text-gray-400 opacity-0 group-hover/cell:opacity-100 hover:text-red-500 transition-opacity shrink-0"
                  >
                    <FontAwesomeIcon :icon="faTrash" class="w-2.5 h-2.5" />
                  </button>
                </div>
              </td>
              <td v-else-if="cell.type === 'add'" class="px-1.5 py-1" :class="ci < numCols - 1 ? 'border-r border-gray-300' : ''">
                <button
                  @click.stop="addChildAt(cell.parentPath)"
                  type="button"
                  class="w-full py-1.5 rounded bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <FontAwesomeIcon :icon="faPlus" class="w-2.5 h-2.5" /> {{ columns[ci]?.nombre }}
                </button>
              </td>
              <td v-else-if="cell.type === 'empty'" class="px-1.5 py-1 bg-gray-50/50" :class="ci < numCols - 1 ? 'border-r border-gray-300' : ''" />
              <td
                v-else
                :rowspan="cell.rowSpan > 1 ? cell.rowSpan : undefined"
                class="px-1.5 py-1 align-top cursor-pointer transition-colors duration-75"
                :class="[
                  ci < numCols - 1 ? 'border-r border-gray-300' : '',
                  isPathSelected(cell.path)
                    ? 'bg-brand-100 ring-2 ring-inset ring-brand-500'
                    : isPathAncestor(cell.path)
                      ? 'bg-brand-50/50'
                      : ci === 0
                        ? 'bg-amber-50/40 hover:bg-amber-50'
                        : 'hover:bg-gray-50',
                ]"
                @click.stop="selectCell(cell.path)"
              >
                <div class="flex items-start gap-0.5 group/cell">
                  <!-- Celda que el Excel calcula: no se edita, se muestra su resultado en vivo -->
                  <div v-if="calculoCelda(cell.path, ci)" class="flex items-start gap-1 flex-1 min-w-0 px-1 py-1">
                    <FontAwesomeIcon :icon="fieldTypeIcons.calculado" class="w-2.5 h-2.5 text-sky-500 shrink-0 mt-0.5" title="Lo calcula el Excel" />
                    <span v-if="!calculoCelda(cell.path, ci)!.soportado" class="text-[11px] text-sky-800/60 italic">Lo calcula el Excel</span>
                    <span v-else-if="calculoCelda(cell.path, ci)!.error" class="text-[11px] text-amber-700 font-mono">{{ calculoCelda(cell.path, ci)!.error }}</span>
                    <span v-else-if="calculoCelda(cell.path, ci)!.texto" class="text-xs text-heading break-words">{{ calculoCelda(cell.path, ci)!.texto }}</span>
                    <span v-else class="text-[11px] text-muted">—</span>
                  </div>
                  <!-- Celda con desplegable declarado en el Excel -->
                  <CampoListaInput
                    v-else-if="opcionesCelda(cell.path, ci)"
                    :value="valorMostradoCelda(cell.value, cell.path, ci, opcionesCelda(cell.path, ci))"
                    :opciones="opcionesCelda(cell.path, ci) ?? []"
                    class="flex-1 min-w-0"
                    @change="updateNodeValue(cell.path, $event)"
                    @click.stop
                  />
                  <!-- Columna booleana: con etiquetas → Sí/No; sin ellas → un círculo -->
                  <CampoBooleanoInput
                    v-else-if="columns[ci]?.tipo === 'booleano'"
                    :value="typeof cell.value === 'string' ? cell.value : ''"
                    :etiquetas="columns[ci]?.etiquetasBooleano ?? (varianteBooleanoCol(columns[ci]) === 'si_no' ? { true: 'Sí', false: 'No' } : null)"
                    :variante="varianteBooleanoCol(columns[ci])"
                    compacto
                    @change="updateNodeValue(cell.path, $event)"
                  />
                  <!-- textarea con field-sizing: crece con el contenido hasta 15 líneas y luego
                       scrollea. Enter sigue confirmando la edición (handleKeyDown lo intercepta
                       con preventDefault antes de que inserte un salto de línea). -->
                  <textarea
                    v-else
                    :ref="(el) => setInputRef(JSON.stringify(cell.path), el as Element)"
                    :value="typeof cell.value === 'string' ? cell.value : ''"
                    rows="1"
                    :readonly="!(isPathSelected(cell.path) && isEditing)"
                    tabindex="-1"
                    :placeholder="`${columns[ci]?.nombre}...`"
                    @input="updateNodeValue(cell.path, ($event.target as HTMLTextAreaElement).value)"
                    @click.stop="() => { if (!(isPathSelected(cell.path) && isEditing)) selectCell(cell.path); }"
                    class="flex-1 px-1.5 py-1 rounded border text-xs text-heading focus:outline-none min-w-0 resize-none overflow-y-auto max-h-[15lh] [field-sizing:content]"
                    :class="isPathSelected(cell.path) && isEditing ? 'border-brand-400 bg-white ring-1 ring-brand-500/30' : 'border-transparent bg-transparent cursor-pointer'"
                  />
                  <button
                    @click.stop="removeNode(cell.path)"
                    type="button"
                    class="w-4 h-4 rounded flex items-center justify-center text-gray-300 opacity-0 group-hover/cell:opacity-100 hover:text-red-500 transition-opacity shrink-0 mt-1"
                  >
                    <FontAwesomeIcon :icon="faTrash" class="w-2 h-2" />
                  </button>
                </div>
              </td>
            </template>
            <td class="w-6" />
          </tr>

          <!-- Pie: un "Agregar grupo" debajo de la última celda de cada columna. La columna donde se
               hace clic define el nivel del agrupador; una vez creado el primer grupo, solo esa
               columna sigue ofreciéndolo. -->
          <tr v-if="puedeAgrupar" class="border-t-2 border-gray-300 bg-gray-50/60">
            <template v-for="(col, ci) in columns" :key="`ag-${col.id}`">
              <td
                :colspan="col.id === dinamicaId && periodos.length > 0 ? periodos.length : 1"
                class="px-1.5 py-1.5 align-top"
                :class="ci < numCols - 1 ? 'border-r border-gray-300' : ''"
              >
                <button
                  v-if="puedeAgregarGrupoEn(ci)"
                  @click.stop="addGrupoEnNivel(ci)"
                  type="button"
                  :title="`Agregar grupo a partir de la columna «${col.nombre}»`"
                  class="w-full py-1.5 rounded border border-dashed text-[10px] font-medium flex items-center justify-center gap-1 transition-colors"
                  :class="nivelFijado === ci
                    ? 'border-brand-300 text-brand-600 hover:bg-brand-50'
                    : 'border-gray-300 text-gray-400 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50'"
                >
                  <FontAwesomeIcon :icon="faPlus" class="w-2.5 h-2.5" /> Grupo
                </button>
              </td>
            </template>
            <td class="w-6" />
          </tr>
        </tbody>
      </table>
    </div>
    <div class="flex items-center gap-2 mt-1.5">
      <button
        @click.stop="addRoot"
        type="button"
        class="py-1.5 px-4 rounded-lg border border-dashed border-gray-300 text-[10px] font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-colors flex items-center gap-1"
      >
        <FontAwesomeIcon :icon="faPlus" class="w-2.5 h-2.5" /> Item
      </button>
      <span class="text-[9px] text-muted">Enter: editar · Flechas: navegar · Esc: salir</span>
    </div>
  </div>
</template>
