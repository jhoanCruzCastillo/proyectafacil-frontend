import type { SesionesApi } from './contracts/sesiones';
import { sesionesMock } from './mock/sesiones.mock';
import { sesionesHttp } from './http/sesiones.http';

const useMock = import.meta.env.VITE_MOCK_SESIONES !== 'false';

export const sesionesApi: SesionesApi = useMock ? sesionesMock : sesionesHttp;
