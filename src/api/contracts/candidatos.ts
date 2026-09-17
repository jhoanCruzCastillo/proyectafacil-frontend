import type { Candidato, CandidatoDetalle, EstadoCandidato, NotaCandidato, ResumenCandidatos } from '@/types';

export interface CandidatosApi {
  list(): Promise<Candidato[]>;
  resumen(): Promise<ResumenCandidatos>;
  detalle(id: string): Promise<CandidatoDetalle>;
  notas(id: string): Promise<NotaCandidato[]>;
  agregarNota(id: string, texto: string): Promise<NotaCandidato[]>;
  cambiarEstado(id: string, estado: EstadoCandidato): Promise<CandidatoDetalle>;
  eliminar(id: string): Promise<void>;
}
