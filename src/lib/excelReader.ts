import { leerLibroXlsx, type CeldaLeida } from './xlsxXmlReader';
import { aFechaISO, aAnio, textoABooleano } from './conversionesExcel';
import type { Plantilla, Campo, TipoCampo } from '@/types';

// Volcado de datos Excel -> valores de un ejemplo: el inverso de excelWriter.ts. Recorre la
// plantilla igual que `insertarValoresEnExcel`, pero en vez de escribir cada campo en su celda de
// `captura`, lee esa misma celda y arma el Record<identificador, valor> del ejemplo.
//
// Alcance deliberado (pedido del usuario): SOLO campos simples. Las tablas se omiten por completo
// — su lectura implica reconstruir filas dinámicas/jerarquías/períodos desde el Excel, que no es un
// mapeo 1:1 como el de un campo simple y se abordará por separado.
//
// Regla de no-destrucción, simétrica a la del writer ("celda vacía no toca el Excel"): una celda
// vacía en el Excel NO borra el valor que el ejemplo ya tuviera — simplemente no se reporta.

// Convierte lo leído del Excel al formato que guarda el campo según su tipo. Devuelve null cuando
// el contenido no es utilizable para ese tipo (se omite el campo en vez de guardar algo inválido).
// Fechas y años NO se convierten aquí: pasan siempre por lib/conversionesExcel.ts, que es el punto
// único donde vive la aritmética de seriales de Excel.
function valorParaCampo(campo: Campo, celda: CeldaLeida): string | null {
  const texto = celda.valor.trim();
  if (texto === '') return null;

  // Celda con formato de solo año ("yyyy"): interesa el año, no la fecha completa que codifica el
  // serial. Aplica sin importar cómo esté tipado el campo — el formato de la celda manda.
  if (celda.soloAnio) return aAnio(celda.valor, true);
  if (celda.esFecha) return aFechaISO(celda.valor, true);

  switch (campo.tipo) {
    case 'booleano':
      return textoABooleano(texto, campo.etiquetasBooleano);
    case 'fecha':
      return aFechaISO(celda.valor, false) ?? texto;
    case 'numero':
    case 'decimal': {
      const n = Number(texto.replace(/\s/g, '').replace(',', '.'));
      return Number.isFinite(n) ? String(n) : texto; // texto no numérico se conserva tal cual
    }
    // 'mapa_coordenadas' cae aquí a propósito: por ahora las coordenadas se tratan como texto
    // simple (decisión del usuario), sin intentar parsearlas a {lat,lng}.
    default:
      return celda.valor; // texto_corto / texto_largo / catálogos: sin recortar, el original manda
  }
}

export interface ResultadoVolcado {
  /** Valores listos para fusionar con los del ejemplo, por identificador de campo */
  valores: Record<string, string>;
  /** Campos simples que sí traían dato en el Excel */
  camposLeidos: number;
  /** Campos simples cuya celda estaba vacía — no se tocan */
  camposVacios: number;
  /** Campos tabla, fuera del alcance de este volcado */
  tablasOmitidas: number;
  /** Hojas que la plantilla declara pero el Excel no tiene (nombres cambiados, otro archivo) */
  hojasFaltantes: string[];
}

const TIPOS_TABLA: TipoCampo[] = ['tabla', 'tabla_jerarquica'];

export async function leerValoresDeExcel(dataUrl: string, plantilla: Plantilla): Promise<ResultadoVolcado> {
  const libro = await leerLibroXlsx(dataUrl);
  const hojasDelLibro = new Set(libro.hojas);

  const valores: Record<string, string> = {};
  let camposLeidos = 0;
  let camposVacios = 0;
  let tablasOmitidas = 0;
  const hojasFaltantes = new Set<string>();

  for (const seccion of plantilla.secciones) {
    if (seccion.hoja && !hojasDelLibro.has(seccion.hoja)) hojasFaltantes.add(seccion.hoja);

    for (const sub of seccion.subsecciones) {
      for (const campo of sub.campos) {
        if (TIPOS_TABLA.includes(campo.tipo)) { tablasOmitidas++; continue; }
        // Un campo calculado guarda su fórmula (ej. "=6.01.10-6.01.01"), no un dato tecleado:
        // sobrescribirlo con el número que Excel dejó cacheado rompería el cálculo.
        if (campo.tipo === 'calculado' || !campo.editable) continue;
        if (!seccion.hoja || !campo.captura?.columna || !campo.captura.fila) continue;

        const celda = libro.celda(seccion.hoja, `${campo.captura.columna}${campo.captura.fila}`);
        if (!celda) { camposVacios++; continue; }

        const valor = valorParaCampo(campo, celda);
        if (valor === null) { camposVacios++; continue; }

        valores[campo.identificador] = valor;
        camposLeidos++;
      }
    }
  }

  return { valores, camposLeidos, camposVacios, tablasOmitidas, hojasFaltantes: Array.from(hojasFaltantes) };
}
