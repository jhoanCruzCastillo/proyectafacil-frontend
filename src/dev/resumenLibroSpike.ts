// Compartido entre el worker de spike y el runner del hilo principal (Fase 0, ver
// spikeExcelVivoWorker.ts) — arma el mismo resumen comparable de un LibroLeido en ambos lados.
import type { LibroLeido } from '@/lib/xlsxXmlReader';

export interface ResumenHojaSpike {
  hoja: string;
  filaMaxima: number | undefined;
  muestraCeldas: { ref: string; valor: string; esFecha: boolean; esTexto: boolean }[];
  muestraFormulas: { ref: string; formula: string }[];
  muestraFusiones: { ref: string; filas: number; columnas: number }[];
  muestraValidaciones: { ref: string; formula: string }[];
}

export interface ResumenLibroSpike {
  hojas: string[];
  nombresDefinidosCount: number;
  porHoja: ResumenHojaSpike[];
}

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export function resumirLibro(libro: LibroLeido): ResumenLibroSpike {
  const porHoja: ResumenHojaSpike[] = libro.hojas.map((hoja) => {
    const muestraCeldas: ResumenHojaSpike['muestraCeldas'] = [];
    const muestraFormulas: ResumenHojaSpike['muestraFormulas'] = [];
    const muestraFusiones: ResumenHojaSpike['muestraFusiones'] = [];
    const muestraValidaciones: ResumenHojaSpike['muestraValidaciones'] = [];

    for (let fila = 1; fila <= 40; fila++) {
      for (const col of LETRAS) {
        const ref = `${col}${fila}`;
        const celda = libro.celda(hoja, ref);
        if (celda && muestraCeldas.length < 15) {
          muestraCeldas.push({ ref, valor: celda.valor, esFecha: celda.esFecha, esTexto: celda.esTexto });
        }
        const formula = libro.formulaDe(hoja, ref);
        if (formula && muestraFormulas.length < 10) muestraFormulas.push({ ref, formula });
        const fusion = libro.fusion(hoja, ref);
        if (fusion && muestraFusiones.length < 10) {
          muestraFusiones.push({ ref, filas: fusion.filas, columnas: fusion.columnas });
        }
        const validacion = libro.validacionLista(hoja, ref);
        if (validacion && muestraValidaciones.length < 10) muestraValidaciones.push({ ref, formula: validacion });
      }
    }

    return { hoja, filaMaxima: libro.filaMaxima(hoja), muestraCeldas, muestraFormulas, muestraFusiones, muestraValidaciones };
  });

  return { hojas: libro.hojas, nombresDefinidosCount: libro.nombresDefinidos.size, porHoja };
}
