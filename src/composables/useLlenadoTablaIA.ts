import { ref, type Ref } from 'vue';
import { llenadoTablaIAHttp } from '@/api/http/llenadoTablaIA.http';
import type { OpcionesLlenadoTabla } from '@/api/contracts/llenadoTablaIA';

/**
 * Llenado de UNA tabla con IA (a diferencia de useLlenadoIAProgreso, que llena toda una sección de
 * campos de texto). El endpoint no persiste nada — solo propone; quien llama a `llenarTabla` decide
 * qué hacer con el JSON devuelto (normalmente: aplicarlo vía el mismo handleValueChange que un tecleo
 * manual, para que entre al flujo de borrador/confirmar ya existente).
 */
export function useLlenadoTablaIA(ejemploId: Ref<string>) {
  const cargandoPorCampo = ref<Record<string, boolean>>({});
  const erroresPorCampo = ref<Record<string, string>>({});

  /** @returns el `valor` propuesto (ya serializado a JSON, mismo formato que `Campo.valorEjemplo`) +
   * su fuente + advertencias (ej. una fila cuyo UBIGEO no se pudo resolver — revisar a mano), o null
   * si falló. */
  async function llenarTabla(campoId: string, identificador: string, seccionId: string, opciones?: OpcionesLlenadoTabla): Promise<{ valorJson: string; fuente: string; advertencias: string[] } | null> {
    cargandoPorCampo.value = { ...cargandoPorCampo.value, [campoId]: true };
    const { [campoId]: _omitido, ...sinError } = erroresPorCampo.value;
    erroresPorCampo.value = sinError;

    try {
      const resultado = await llenadoTablaIAHttp.llenarTabla(ejemploId.value, identificador, seccionId, opciones);
      return { valorJson: JSON.stringify(resultado.valor), fuente: resultado.fuente, advertencias: resultado.advertencias };
    } catch (e) {
      erroresPorCampo.value = {
        ...erroresPorCampo.value,
        [campoId]: e instanceof Error ? e.message : 'No se pudo llenar la tabla con IA',
      };
      return null;
    } finally {
      const { [campoId]: _c, ...sinCarga } = cargandoPorCampo.value;
      cargandoPorCampo.value = sinCarga;
    }
  }

  return { cargandoPorCampo, erroresPorCampo, llenarTabla };
}
