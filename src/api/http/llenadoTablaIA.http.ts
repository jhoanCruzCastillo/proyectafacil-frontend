import { apiFetch } from './_shared';
import type { LlenadoTablaIAApi, ResultadoLlenadoTablaIA } from '../contracts/llenadoTablaIA';

export const llenadoTablaIAHttp: LlenadoTablaIAApi = {
  llenarTabla(ejemploId, identificador, seccionId, opciones) {
    return apiFetch<ResultadoLlenadoTablaIA>(`ejemplos/${ejemploId}/llenar-tabla-ia`, {
      method: 'POST',
      body: JSON.stringify({
        identificador,
        seccionId,
        opcionesPorColumna: opciones?.opcionesPorColumna,
        contextoAdicional: opciones?.contextoAdicional,
      }),
    });
  },
};
