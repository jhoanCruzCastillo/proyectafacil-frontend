import type { Ejemplo } from '@/types';

export interface EjemplosApi {
  list(): Promise<Ejemplo[]>;
  listByPlantilla(plantillaId: string): Promise<Ejemplo[]>;
  get(id: string): Promise<Ejemplo | null>;
  create(ejemplo: Ejemplo): Promise<Ejemplo>;
  update(id: string, data: Partial<Ejemplo>): Promise<Ejemplo>;
  remove(id: string): Promise<void>;
  /** Marca (o desmarca) este ejemplo como el único "ejemplo de referencia para IA" de su plantilla —
   * ver `Ejemplo.esReferenciaIA`. Va aparte de `update()` porque el backend limpia cualquier otro
   * ejemplo marcado de la misma plantilla antes de marcar este, algo que un PUT de campo suelto no
   * puede garantizar. */
  marcarReferenciaIA(id: string, activo: boolean): Promise<Ejemplo>;
}
