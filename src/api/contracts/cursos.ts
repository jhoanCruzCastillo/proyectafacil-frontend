import type { Curso } from '@/types';

export interface CursosApi {
  list(): Promise<Curso[]>;
  create(datos: { nombre: string; colorAccent: string }): Promise<Curso>;
}
