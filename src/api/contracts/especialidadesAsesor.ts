export interface EspecialidadesAsesorApi {
  list(usuarioId: string): Promise<string[]>;
  guardar(usuarioId: string, sectorIds: string[]): Promise<string[]>;
}
