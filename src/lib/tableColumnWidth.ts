/** Ancho mínimo visual de una columna de tabla en el editor (px). */
export const ANCHO_COLUMNA_MIN_PX = 48;

/**
 * Estilo de ancho para `<th>`/`<td>` del editor. `ColumnaTabla.ancho` es solo UI (px), no Excel.
 * `parts` reparte el ancho entre subcolumnas o períodos.
 */
export function estiloAnchoColumna(
  ancho: number | undefined,
  parts = 1,
): Record<string, string> | undefined {
  if (ancho == null || !(ancho > 0)) return undefined;
  const w = Math.max(ANCHO_COLUMNA_MIN_PX, Math.round(ancho / Math.max(parts, 1)));
  return {
    width: `${w}px`,
    maxWidth: `${w}px`,
    minWidth: `${ANCHO_COLUMNA_MIN_PX}px`,
  };
}

/**
 * Arrastre horizontal para redimensionar una columna. `startAncho` suele ser `col.ancho` o el
 * `offsetWidth` actual de la celda si aún no hay ancho guardado.
 */
export function iniciarResizeColumna(
  startX: number,
  startAncho: number,
  onMove: (anchoPx: number) => void,
  onEnd?: (anchoPx: number) => void,
): void {
  const base = Math.max(ANCHO_COLUMNA_MIN_PX, startAncho);
  let actual = base;

  const prevCursor = document.body.style.cursor;
  const prevSelect = document.body.style.userSelect;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  const onPointerMove = (e: MouseEvent) => {
    actual = Math.max(ANCHO_COLUMNA_MIN_PX, Math.round(base + (e.clientX - startX)));
    onMove(actual);
  };
  const onPointerUp = () => {
    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseup', onPointerUp);
    document.body.style.cursor = prevCursor;
    document.body.style.userSelect = prevSelect;
    onEnd?.(actual);
  };
  document.addEventListener('mousemove', onPointerMove);
  document.addEventListener('mouseup', onPointerUp);
}
