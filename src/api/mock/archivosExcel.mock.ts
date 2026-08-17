import type { ArchivosExcelApi } from '../contracts/archivosExcel';
import { delay, readLocal, writeLocal } from './_shared';
import type { CatalogoExcelPlantilla } from '@/types';

const KEY = 'vf_excel_catalogos';

function load(): Record<string, CatalogoExcelPlantilla> {
  return readLocal<Record<string, CatalogoExcelPlantilla>>(KEY, {});
}

function save(data: Record<string, CatalogoExcelPlantilla>): void {
  writeLocal(KEY, data);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export const archivosExcelMock: ArchivosExcelApi = {
  async getCatalogo(plantillaId) {
    await delay();
    return load()[plantillaId] ?? { archivos: [] };
  },

  async addArchivo(plantillaId, file, onProgress) {
    onProgress?.(0.2, 'Subiendo al servidor…');
    await delay();
    onProgress?.(0.7, 'Subiendo al servidor…');
    const dataUrl = await fileToDataUrl(file);
    onProgress?.(1, 'Guardando en Railway…');
    await delay();
    const archivo = {
      id: `mock-${Date.now()}`,
      nombre: file.name,
      dataUrl,
      fechaSubida: new Date().toLocaleDateString('es-PE'),
    };
    const data = load();
    const actual = data[plantillaId] ?? { archivos: [] };
    data[plantillaId] = { archivos: [...actual.archivos, archivo], asignadoId: actual.asignadoId ?? archivo.id };
    save(data);
    return data[plantillaId];
  },

  async deleteArchivo(plantillaId, archivoId) {
    await delay();
    const data = load();
    const actual = data[plantillaId];
    if (!actual) return { archivos: [] };
    data[plantillaId] = {
      archivos: actual.archivos.filter((a) => a.id !== archivoId),
      asignadoId: actual.asignadoId === archivoId ? undefined : actual.asignadoId,
    };
    save(data);
    return data[plantillaId];
  },

  async asignarArchivo(plantillaId, archivoId) {
    await delay();
    const data = load();
    const actual = data[plantillaId] ?? { archivos: [] };
    data[plantillaId] = { ...actual, asignadoId: archivoId };
    save(data);
    return data[plantillaId];
  },
};
