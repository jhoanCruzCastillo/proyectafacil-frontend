// Persiste el progreso del wizard público /registro-especialista en localStorage — mismo patrón
// que lib/llenadoIASesion.ts (versión + try/catch por cuota/modo privado). Nunca se guarda la
// contraseña (password/password2) ni el archivo del CV: un password en texto plano no debe vivir
// en localStorage indefinidamente, y un File no es serializable — al recargar, el postulante debe
// volver a adjuntar el CV (el paso "Documentos" ya lo exige de nuevo).
export interface SesionPostulacionEspecialistaGuardada {
  version: 1;
  paso: number;
  campos: {
    nombre: string;
    dni: string;
    correo: string;
    telefono: string;
    profesion: string;
    profesionOtra: string;
    nivelAcademico: string;
    experiencia: string;
    otrosTemas: string;
    linkedin: string;
    otrasRedes: string;
    comentarios: string;
  };
  nivelEspecialidad: string;
  temasSeleccionados: number[];
  otrosTemasSeleccionado: boolean;
  actividadesSeleccionadas: string[];
  bloques: Record<string, boolean>;
  aceptaTerminos: boolean;
  guardadoEn: string;
}

const KEY = 'pf_postulacion_especialista_sesion';
const VERSION = 1 as const;

export function leerSesionPostulacion(): SesionPostulacionEspecialistaGuardada | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SesionPostulacionEspecialistaGuardada;
    if (data?.version !== VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function guardarSesionPostulacion(sesion: Omit<SesionPostulacionEspecialistaGuardada, 'version' | 'guardadoEn'>): void {
  try {
    const payload: SesionPostulacionEspecialistaGuardada = {
      ...sesion,
      version: VERSION,
      guardadoEn: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* cuota / modo privado */
  }
}

export function borrarSesionPostulacion(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
