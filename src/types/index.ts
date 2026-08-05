export type TipoCampo =
  | 'texto_corto'
  | 'texto_largo'
  | 'numero'
  | 'fecha'
  | 'decimal'
  | 'booleano'
  | 'catalogo_simple'
  | 'catalogo_encadenado'
  | 'seleccion'
  | 'tabla'
  | 'tabla_jerarquica'
  | 'calculado'
  | 'imagen'
  | 'firma'
  | 'mapa_coordenadas';

export type TipoSector = 'Sectorial' | 'General';

export type VersionTab = 'estructura' | 'ejemplos' | 'proyecto';

export type SubtipoTabla = 'filas_dinamicas' | 'matriz_por_periodos' | 'jerarquica' | 'jerarquica_dinamica';

// Primitivos documentados (esquema oficial) + catalogo/catalogo_encadenado/auto_numerico,
// que se mantienen por compatibilidad con datos existentes pero ya no se ofrecen en el selector de tipo.
export type TipoColumna =
  | 'texto_corto'
  | 'texto_largo'
  | 'numero'
  | 'decimal'
  | 'fecha'
  | 'booleano'
  | 'coordenadas'
  | 'calculado'
  | 'catalogo'
  | 'catalogo_encadenado'
  | 'auto_numerico';

export type NivelColumna = 'padre' | 'hijo';

export interface ColumnaTabla {
  id: string;
  nombre: string;
  tipo: TipoColumna;
  nivel?: NivelColumna;
  ancho?: number;
  requerido?: boolean;
  fuenteCatalogo?: string;
  encadenaA?: string;
  formula?: string;
  /** Letra de columna Excel donde inicia esta columna (captura) */
  columnaExcel?: string;
  /** Cantidad de columnas Excel que abarca esta columna (captura) */
  abarcaColumnasExcel?: number;
  /** Lista fija de opciones (ej. validación de datos por lista en Excel) — cuando está presente,
   * la celda se edita con un <select> en vez de texto libre. No requiere un catálogo externo. */
  opciones?: string[];
  /** Cómo se ve un valor booleano en el Excel oficial, por columna (ver Campo.etiquetasBooleano) */
  etiquetasBooleano?: { true: string; false: string };
  /** Cantidad de decimales con que se muestra/escribe el valor numérico de esta columna */
  decimales?: number;
  /** Celdas partidas (convención 4.8): el ancho de esta columna guarda dos o más datos en celdas
   * separadas de Excel. La partición se declara acá, una sola vez; qué filas van partidas y cuáles
   * fusionadas lo decide la forma del valor de cada fila (objeto = partida, plano = fusionada). */
  subcolumnas?: SubcolumnaTabla[];
}

/** Una parte de una columna partida — misma forma que ColumnaTabla pero sin anidamiento propio. */
export interface SubcolumnaTabla {
  id: string;
  nombre: string;
  tipo: TipoColumna;
  /** Letra de columna Excel donde inicia esta parte */
  columnaExcel?: string;
  /** Cantidad de columnas Excel que abarca esta parte */
  abarcaColumnasExcel?: number;
}

export interface CapturaTabla {
  /** Letra de columna Excel donde inicia la tabla (referencia — cada columna puede pisarla con la suya) */
  columnaInicial?: string;
  /** Primera fila de Excel donde empieza el primer registro de datos (no la cabecera) */
  filaInicial?: number;
  /** Cantidad de filas que ocupa la tabla en su estado base/ejemplo */
  filasBase?: number;
}

export interface CabeceraGrupo {
  titulo: string;
  /** Ids de ColumnaTabla que quedan agrupados bajo este título (incluye columnaDinamicaId si aplica) */
  hijoIds: string[];
}

export interface ConfigTabla {
  subtipo: SubtipoTabla;
  columnas: ColumnaTabla[];
  filasIniciales?: number;
  maxFilas?: number;
  /** Lista editable de nombres de las columnas dinámicas generadas, cada una insertable/editable individualmente (solo subtipo matriz_por_periodos) */
  periodos?: string[];
  /** Filas planas agrupadas bajo un encabezado de grupo (no aplica a jerárquica) */
  agrupador?: boolean;
  /** Cantidad de columnas que abarca (fusiona) la fila de título de cada grupo, contando desde la primera columna (solo si agrupador=true; por defecto, todas las columnas) */
  agrupadorAbarcaColumnas?: number;
  /** Solo tablas JERÁRQUICAS con agrupador: nivel del árbol (índice de columna) donde viven las
   * filas de título de grupo. La fila abarca desde esa columna hasta la última. Se elige con el
   * botón "Agregar grupo" del panel central, debajo de la columna correspondiente. Si no está
   * definido, se deduce de los flags Padre/Hijo (comportamiento anterior). */
  agrupadorNivel?: number;
  /** Id de la columna cuyo valor se repite por período (solo subtipo matriz_por_periodos) */
  columnaDinamicaId?: string;
  /** Encabezados que agrupan columnas existentes bajo un título común (equivalente a "cabecera" del esquema oficial) */
  cabeceras?: CabeceraGrupo[];
  /** Posición de arranque de la tabla en el Excel */
  captura?: CapturaTabla;
}

export interface Sector {
  id: string;
  nombre: string;
  codigo: string;
  icono: string;
  colorAccent: string;
  descripcion?: string;
  tipoSector: TipoSector;
  activo: boolean;
  cantidadPlantillas: number;
  cantidadEjemplos: number;
}

export type TipoInstrumento = 'formato' | 'ioarr' | 'ficha_tecnica' | 'perfil';

export type TipologiaIoarr = 'optimizacion' | 'ampliacion_marginal' | 'reposicion' | 'rehabilitacion';

export interface Plantilla {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  sectorId: string;
  instrumento: TipoInstrumento;
  /** Tipologías IOARR que este documento cubre internamente (no son excluyentes entre sí — un mismo
   * formato como el 07-C trae las 4 como secciones propias). */
  tipologiasIoarr?: TipologiaIoarr[];
  cantidadSecciones: number;
  cantidadEjemplos: number;
  fechaActualizacion: string;
  secciones: Seccion[];
  /** Ruta pública (bajo /fichas_oficiales) del archivo Excel oficial que se asigna automáticamente
   * al catálogo de esta plantilla la primera vez que se carga la app */
  archivoDefaultUrl?: string;
  /** true = forma parte del catálogo curado de "ejercicios de práctica" del plan Nivel 0
   * (Pedagógico) — debe tener al menos un Ejemplo de referencia (solucionario) cargado por el admin */
  disponibleNivel0?: boolean;
  /** Nace 'archivado' — el admin decide explícitamente cuándo publicarla. Independiente del
   * estado de sus Ejemplos (ver Ejemplo.estado). */
  estado?: 'publicado' | 'archivado';
}

// Bloque de contenido de un apartado de Perfil
export interface BloqueContenido {
  id: string;
  numeral: string;
  titulo: string;
  pauta: string; // Texto guía del Anexo 07 — qué debe contener
  tipoBloqueContenido: 'texto_largo' | 'tabla' | 'imagen';
  valorEjemplo?: string;
}

export interface Seccion {
  id: string;
  numero: string;
  nombre: string;
  cantidadCampos: number;
  subsecciones: Subseccion[];
  /** Pestaña de Excel donde se ubican todos los campos de esta sección (captura) */
  hoja?: string;
}

export interface Subseccion {
  id: string;
  codigo: string;
  nombre: string;
  campos: Campo[];
  /** Guía de cómo llenar esta subsección, autorada por el admin — se muestra al cliente vía el botón "?" */
  ayuda?: string;
}

export interface CapturaCampo {
  columna: string;
  fila: number;
  abarcaColumnas?: number;
  abarcaFilas?: number;
}

export interface Campo {
  id: string;
  identificador: string;
  etiqueta: string;
  tipo: TipoCampo;
  editable: boolean;
  /** El cliente debe llenarlo obligatoriamente — lo usa el validador del lado cliente */
  requerido?: boolean;
  descripcion?: string;
  fuenteCatalogo?: string;
  cadena?: string[];
  valorEjemplo?: string;
  configTabla?: ConfigTabla;
  config?: Record<string, unknown>;
  /** Ubicación de este campo en el Excel (captura) — no aplica a campos tipo tabla */
  captura?: CapturaCampo;
  /** Lista fija de opciones (equivalente a `opciones` de ColumnaTabla, pero para un campo suelto):
   * la celda del Excel se llena eligiendo de esta lista, no con texto libre. */
  opciones?: string[];
  /** Cómo se ve un valor booleano en el Excel oficial: `{ "true": "Sí", "false": "No" }`.
   * Lo declara la plantilla porque cada formato usa sus propias palabras ("Sí"/"No", "X"/""), y
   * tanto el volcado desde Excel como la inserción hacia Excel deben respetarlas. */
  etiquetasBooleano?: { true: string; false: string };
  /** Cantidad de decimales con que se muestra/escribe el valor numérico de este campo */
  decimales?: number;
}

export interface Ejemplo {
  id: string;
  nombre: string;
  subtitulo: string;
  detalle: string;
  plantillaId: string;
  activo?: boolean;
  valores: Record<string, string>;
  /** Solo relevante si la plantilla es IOARR: qué tipología(s) representa ESTE caso puntual
   * (a diferencia de Plantilla.tipologiasIoarr, que describe la cobertura del documento completo). */
  tipologiasIoarr?: TipologiaIoarr[];
  /** usuarioId del cliente titular dueño de esta ficha — solo presente en fichas creadas por un
   * cliente ("Mis fichas"). Los ejemplos que arma el admin como caso de referencia para la IA no
   * llevan este campo. Un colaborador crea/ve fichas bajo el `cuentaClienteId` de su titular. */
  propietarioId?: string;
  /** usuarioId específico (titular o colaborador) que creó esta ficha — a diferencia de
   * `propietarioId` (la cuenta), esto identifica a la persona dentro del equipo. Si falta (fichas
   * creadas antes de que existieran colaboradores), se asume que la creó el titular. */
  creadoPorUsuarioId?: string;
  /** true = visible para todo el equipo de la cuenta, no solo para quien la creó. Solo el titular
   * puede activarlo (ver puedeVerFicha en permisos.ts). */
  compartida?: boolean;
  /** Nace 'archivado' — el admin decide explícitamente cuándo publicarlo. Independiente del
   * estado de la Plantilla. Solo se gestiona en el catálogo de ejemplos de referencia del admin
   * (propietarioId ausente) — las fichas de cliente no muestran este control. */
  estado?: 'publicado' | 'archivado';
}

export type RolUsuario = 'superusuario' | 'administrador' | 'cliente' | 'administrativo_asesorias' | 'asesor';

// Solo aplica a rol 'cliente' — de dónde viene la cuenta (alumno de un curso vs. cliente externo
// que se registró directo). null/ausente para el resto de roles.
export type OrigenCliente = 'alumno' | 'externo';

// Etiqueta de rol personalizada (ej. "Soporte Técnico", "Coordinador") que el admin puede crear
// desde "Gestionar roles" — hereda el nivel de permisos de Administrador o Cliente (nivelBase), no
// define permisos propios. Superusuario y Docente no admiten etiquetas personalizadas: son roles
// de primera clase, no etiquetas.
export interface TipoUsuario {
  id: string;
  nombre: string;
  nivelBase: 'administrador' | 'cliente';
}

export type TemaPreferencia = 'claro' | 'oscuro' | 'sistema';

export type EstadoUsuario = 'activo' | 'inactivo';

// Catálogo de permisos individuales — el rol es solo una etiqueta visual; el control de acceso
// real se basa (o se basará) en esta lista granular por usuario.
export type PermisoId =
  | 'sectores.ver'
  | 'sectores.gestionar'
  | 'plantillas.ver'
  | 'plantillas.gestionar'
  | 'plantillas.importar_json'
  | 'estructura.editar'
  | 'ejemplos.gestionar'
  | 'excel.asignar'
  | 'json.ver'
  | 'usuarios.gestionar'
  | 'roles.gestionar'
  | 'fichas.crear'
  | 'fichas.compartir'
  | 'fichas.ver_historial'
  | 'colaboradores.gestionar'
  | 'ia.mejora_texto'
  | 'ia.asesor'
  | 'facturacion.gestionar'
  | 'asesoria.solicitar'
  | 'asesoria.atender_chat'
  | 'asesoria.atender_video'
  | 'asesoria.marcar_disponibilidad'
  | 'asesoria.autorizar_pagos'
  | 'asesoria.configurar_sla'
  | 'asesoria.tickets_gestionar'
  | 'asesoria.cobertura_horarios'
  | 'asesoria.matchmaking';

export interface Usuario {
  id: string;
  nombre: string;
  usuario: string;
  password: string;
  rol: RolUsuario;
  apodo?: string;
  tema?: TemaPreferencia;
  estado?: EstadoUsuario;
  /** Solo presente en colaboradores creados como "usuario adicional" — apunta al `usuarioId` del cliente titular de la cuenta. */
  cuentaClienteId?: string;
  /** Permisos individuales asignados — si falta, se calculan por defecto según rol (y nivel de
   * plan si es cliente). */
  permisos?: PermisoId[];
  /** Etiqueta personalizada (ver TipoUsuario) que reemplaza el nombre del rol al mostrarlo — el
   * control de acceso real sigue basado en `rol`, esto es solo la etiqueta visible. */
  tipoUsuarioId?: string;
  /** Solo tiene sentido cuando rol === 'cliente'. */
  origen?: OrigenCliente | null;
  correo?: string;
  /** Avatar generado (DiceBear) o subido — ilustrado, no una foto real. */
  fotoUrl?: string | null;
  /** Solo tiene sentido cuando rol === 'cliente' y origen === 'alumno' — fecha ISO (YYYY-MM-DD). */
  vigenciaAlumnoHasta?: string | null;
  /** Rastro de auditoría cuando un admin cambió `origen` a mano — lo setea el backend, nunca el cliente. */
  origenCambiadoPorNombre?: string | null;
  origenCambiadoEn?: string | null;
  /** Solo tiene sentido cuando rol === 'asesor' — toggle propio de disponibilidad para recibir solicitudes. */
  disponible?: boolean;
}

// Sesión activa — nunca guarda la contraseña
export interface Sesion {
  usuarioId: string;
  nombre: string;
  usuario: string;
  rol: RolUsuario;
  iniciadaEn?: string;
}

export type EstadoFactura = 'Pagado' | 'Pendiente';

export interface FacturaMock {
  id: string;
  fecha: string;
  total: string;
  estado: EstadoFactura;
}

// Catálogo de planes por nivel (Nivel 0 Pedagógico, Nivel 1 Profesional, Nivel 2 Premium).
export interface Plan {
  id: string;
  numeroNivel: number;
  nombre: string;
  precio: number;
  periodicidad: string;
  features: string[];
  /** Cantidad base de fichas simultáneas permitidas (ejercicios en Nivel 0, proyectos reales en Nivel 1+),
   * antes de sumar el add-on "Plantilla adicional". */
  limiteFichasBase: number;
  /** Cantidad base de consultas de asesoría 1:1 con un docente incluidas en el plan, antes de sumar
   * el add-on "Consultoría 1 a 1" (cada unidad comprada = 1 consulta extra). */
  limiteConsultasBase: number;
  /** Cantidad de usuarios (titular + colaboradores) incluidos en el plan, antes de sumar el add-on
   * "Usuario adicional". Nivel 0 y 1 solo incluyen al titular (1); Nivel 2 incluye hasta 3. */
  limiteUsuariosBase: number;
}

// Servicio extra que se contrata por separado del plan (se paga aparte, cantidad variable).
export interface AddOn {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  /** true si se cobra cada periodo de facturación (suma al total mensual del plan); false si es un cargo único (ej. una consultoría puntual). */
  recurrente: boolean;
  /** Números de nivel de plan que pueden contratar este add-on — si no está, aplica a cualquier nivel. */
  nivelesDisponibles?: number[];
}

// Métodos de pago ofrecidos — tarjeta vía Stripe, billeteras locales (Yape/Plin) y pasarelas
// peruanas (Mercado Pago/360Pay).
export type MetodoPago = 'tarjeta' | 'yape' | 'plin' | 'mercado_pago' | '360pay';

// Datos de facturación de muestra — no hay pasarela de pago real ni backend;
// esto solo alimenta la UI de Ajustes > Facturación con datos ilustrativos.
export interface FacturacionMock {
  planId: string;
  plan: string;
  precio: string;
  periodicidad: string;
  cancelada: boolean;
  fechaRenovacion: string;
  /** ISO date — cuándo se activó el plan actual. Solo se usa para calcular vencimiento del Nivel 0 (4 semanas). */
  fechaInicioPlan?: string;
  metodoPago: MetodoPago;
  tarjetaMarca: string;
  tarjetaUltimos4: string;
  /** Número asociado a la billetera — solo si metodoPago es 'yape' o 'plin' */
  telefonoPago?: string;
  facturas: FacturaMock[];
  /** Add-ons contratados: id del add-on → cantidad */
  addons: Record<string, number>;
}

export interface ActividadReciente {
  id: string;
  mensaje: string;
  fecha: string;
  color: 'blue' | 'green' | 'orange' | 'gray' | 'red';
}

// Catálogo de archivos Excel de referencia asignables a una plantilla (para previsualización)
export interface ArchivoExcel {
  id: string;
  nombre: string;
  /** Contenido del archivo como data URL (localStorage no soporta blobs) */
  dataUrl: string;
  fechaSubida: string;
}

export interface CatalogoExcelPlantilla {
  archivos: ArchivoExcel[];
  /** Id del archivo actualmente asignado a la plantilla (se previsualiza en el editor) */
  asignadoId?: string;
}

// Histórico de cambios en una ficha llenada (ventaja del plan Nivel 2) — ayuda a un equipo con
// colaboradores a ver quién editó qué. Se registra una entrada por cada vez que se presiona
// "Guardar" y hubo campos con valores distintos, no por cada tecla.
export interface CampoCambio {
  identificador: string;
  etiqueta: string;
  valorAnterior: string;
  valorNuevo: string;
}

export interface CambioFicha {
  id: string;
  ejemploId: string;
  /** usuarioId de quien guardó el cambio — puede ser el titular o un colaborador */
  usuarioId: string;
  /** ISO datetime */
  fecha: string;
  campos: CampoCambio[];
}

// Asesoría 1:1 cliente↔docente (chat o videollamada por link externo). diaSemana: 1=lunes .. 7=domingo.
export interface HorarioDocente {
  id: string;
  diaSemana: number;
  /** "HH:MM" */
  horaInicio: string;
  /** "HH:MM" */
  horaFin: string;
}

export interface Docente {
  id: string;
  nombre: string;
  fotoUrl?: string | null;
  /** Bloques semanales de referencia — no es un calendario de citas, solo indica cuándo suele estar disponible */
  horario: HorarioDocente[];
}

// --- Contextos IA ---

/** Contexto reutilizable por cualquier ficha (ej. "Invierte.pe", "Finanzas"). */
export interface ContextoGlobalIA {
  id: string;
  nombre: string;
  /** Clave de `sectorIcons`, o null */
  icono?: string | null;
  markdown: string;
  /** Cuántas secciones lo tienen asociado */
  usos: number;
  actualizadoEn?: string | null;
}

/** Contexto propio de UNA sección de UNA ficha. */
export interface ContextoSeccionIA {
  seccionId: string;
  markdown: string;
  /** IDs de los contextos globales asociados */
  globales: string[];
  actualizadoEn?: string | null;
}

export interface ContextosIAPlantilla {
  secciones: ContextoSeccionIA[];
  globales: ContextoGlobalIA[];
}

// --- Mi Liquidación (asesor) ---

/** Una consulta completada, como la ve el asesor en su liquidación. */
export interface LiquidacionDetalle {
  id: string;
  clienteNombre: string;
  clienteFotoUrl?: string | null;
  sectorNombre?: string | null;
  /** Puede venir vacío: el flujo que crea solicitudes todavía no pide subtema. */
  subtemaNombre?: string | null;
  tipo: TipoAsesoria;
  /** ISO — fecha real de cierre de la asesoría. */
  atendidoEn: string;
  pagado: boolean;
  monto: number;
}

export type GranularidadLiquidacion = 'dia' | 'semana' | 'mes' | 'anio';

export interface PuntoSerieLiquidacion {
  clave: string;
  etiqueta: string;
  consultas: number;
  monto: number;
}

export interface LiquidacionHistorico {
  granularidad: GranularidadLiquidacion;
  periodo: string;
  periodoClave: string;
  periodoLabel: string;
  honorario: number;
  kpis: {
    consultasAtendidas: number;
    ingresoHistorico: number;
    promedioMensual: number;
    pagadoALaFecha: number;
  };
  serie: PuntoSerieLiquidacion[];
  detalle: LiquidacionDetalle[];
  totalPeriodo: number;
}

export interface LiquidacionPendiente {
  honorario: number;
  kpis: {
    consultasPorCobrar: number;
    montoPendiente: number;
    diasMasAntigua: number;
    tarifaPorConsulta: number;
  };
  detalle: LiquidacionDetalle[];
  totalPendiente: number;
}

export interface LiquidacionMes {
  periodo: string;
  periodoLabel: string;
  honorario: number;
  kpis: {
    consultasDelMes: number;
    ingresoDelMes: number;
    videollamadas: number;
    chats: number;
  };
  porSemana: { etiqueta: string; consultas: number }[];
  detalle: LiquidacionDetalle[];
  totalMes: number;
}

// Por qué una solicitud que le llegó al asesor terminó sin ser suya.
export type MotivoNoAceptada = 'tomada_por_otro' | 'vencida_sin_respuesta' | 'cancelada_por_alumno';

export interface SolicitudNoAceptada extends SolicitudAsesoria {
  motivo: MotivoNoAceptada;
}

// Las dos listas de la pantalla "No atendidas / reasignadas" del asesor.
export interface NoAtendidasAsesor {
  /** Le llegaron por broadcast pero nunca fueron suyas. */
  noAceptadas: SolicitudNoAceptada[];
  /** Eran suyas y con hora fijada, pero la hora pasó sin cerrarse. */
  agendadasNoAtendidas: SolicitudAsesoria[];
}

// Segundo nivel de las especialidades del asesor: dentro de un sector MEF ("tema"), un subtema
// específico — ej. dentro de Formatos Generales, "Liquidación por contrata".
export interface SubtemaEspecialidad {
  id: string;
  sectorId: string;
  nombre: string;
}

// Excepción puntual sobre el horario recurrente — marca una FECHA real (no un día de la semana)
// como ocupada, ej. "este sábado 15 en particular no tengo tiempo" aunque el patrón recurrente
// normalmente diga que sí. No se repite.
export interface ExcepcionHorarioDocente {
  id: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  /** "HH:MM" */
  horaInicio: string;
  /** "HH:MM" */
  horaFin: string;
}

export type TipoAsesoria = 'chat' | 'video';

// Vocabulario final del documento (docs/proyectafacil-asesorias.md §3.2): Pendiente → Asignado
// (chat) / Agendado (video) — el matchmaking por broadcast del Módulo 3 asigna un asesor — →
// Completado | Cancelado | En espera (sin cobertura para reasignar, Módulo 4).
export type EstadoSolicitudAsesoria = 'pendiente' | 'asignado' | 'agendado' | 'completado' | 'cancelado' | 'en_espera';

// Los 4 tipos de documento del Formato 6A (docs/proyectafacil-asesorias.md §3.3) — paso 2 del
// chatbot guiado, misma categorización que la asesor autogestiona en Mis especialidades.
export type TipoDocumento = 'formatos' | 'ioarr' | 'fichas_tecnicas' | 'perfiles';

export interface SolicitudAsesoria {
  id: string;
  clienteId: string;
  clienteNombre?: string | null;
  clienteFotoUrl?: string | null;
  /** null hasta que el matchmaking (broadcast) asigna un asesor — ver docs §4 Fase 2 */
  docenteId: string | null;
  docenteNombre?: string | null;
  docenteFotoUrl?: string | null;
  /** Ficha que el cliente estaba llenando al pedir ayuda, si aplica */
  ejemploId?: string | null;
  /** Sector MEF elegido en el paso 1 del chatbot guiado */
  sectorId?: string | null;
  sectorNombre?: string | null;
  tipoDocumento?: TipoDocumento | null;
  tipo: TipoAsesoria;
  estado: EstadoSolicitudAsesoria;
  mensajeInicial?: string | null;
  /** Horario elegido en la ruta Video — ISO date (YYYY-MM-DD) */
  horarioFecha?: string | null;
  /** "HH:MM" */
  horarioHoraInicio?: string | null;
  /** "HH:MM" */
  horarioHoraFin?: string | null;
  /** Link externo (Zoom/Meet) que el docente pega al aceptar una solicitud de tipo 'video' */
  linkReunion?: string | null;
  /** ISO datetime — plazo para que algún asesor acepte antes de requerir intervención manual (Módulo 4) */
  slaVenceEn?: string | null;
  /** 1-5, solo presente cuando estado='completado' y el alumno ya calificó (Módulo 6) */
  calificacion?: number | null;
  calificacionComentario?: string | null;
  /** ISO datetime */
  creadoEn: string;
  /** ISO datetime */
  actualizadoEn?: string | null;
}

// Módulo 4 — vista del Administrativo de Asesorías.
export interface DocenteNotificado {
  id: string;
  nombre: string;
  fotoUrl?: string | null;
  /** ISO datetime */
  notificadoEn: string;
}

export interface TicketAsesoriaDetalle extends SolicitudAsesoria {
  clienteCorreo?: string | null;
  docentesNotificados: DocenteNotificado[];
}

export interface DocenteDisponibleAhora {
  id: string;
  nombre: string;
  fotoUrl?: string | null;
  /** Especialidad representativa (el docente puede tener varias) para la tarjeta del modal de intervención manual. */
  especialidad?: string | null;
  /** Promedio de calificación (1-5) de sus consultas completadas de siempre — null si aún no tiene ninguna calificada. */
  calificacionPromedio?: number | null;
  /** Total de consultas completadas de siempre (no solo del mes). */
  consultasAtendidas?: number;
}

export interface DashboardAsesoria {
  pendientes: number;
  enEspera: number;
  completadosHoy: number;
  slaPorVencer: number;
}

// Módulo 6 — honorarios y Liquidaciones (Administrativo de Asesorías).
export interface LiquidacionAsesor {
  asesorId: string;
  asesorNombre: string;
  asesorFotoUrl?: string | null;
  ticketsCompletados: number;
  ticketsPendientes: number;
  honorarioTotal: number;
  honorarioPendiente: number;
  todoPagado: boolean;
}

export interface Liquidaciones {
  /** "YYYY-MM" */
  periodo: string;
  honorarioPorTicket: number;
  asesores: LiquidacionAsesor[];
}

// Módulo 5 — mapa de calor de cobertura de horarios y gestión de docentes.
export interface CeldaCobertura {
  /** ISO date (YYYY-MM-DD) */
  fecha: string;
  /** "HH:MM" */
  horaInicio: string;
  docentes: DocenteDisponibleAhora[];
  /** true si hay un ticket de video pendiente/en espera sin resolver para esta fecha+hora exacta */
  pendiente: boolean;
}

export interface CoberturaHorarios {
  /** ISO date del lunes de la semana mostrada */
  lunes: string;
  /** ISO date del domingo de la semana mostrada */
  domingo: string;
  dias: string[];
  franjas: string[];
  celdas: CeldaCobertura[];
}

export interface EspecialidadDocente {
  id: string;
  nombre: string;
}

export interface DocenteAdmin {
  id: string;
  nombre: string;
  correo?: string | null;
  fotoUrl?: string | null;
  disponible: boolean;
  estado: EstadoUsuario;
  especialidades: EspecialidadDocente[];
  consultasAtendidasMes: number;
}

export type OrigenTicketConsulta = 'plan' | 'addon';
export type EstadoTicketConsulta = 'disponible' | 'reservado' | 'consumido' | 'liberado' | 'expirado';

export interface TicketConsulta {
  id: string;
  usuarioId: string;
  origen: OrigenTicketConsulta;
  estado: EstadoTicketConsulta;
  /** Ficha de chat o de videoconferencia — son dos tipos separados, un ticket de una modalidad
   * nunca se puede usar para solicitar la otra (ver AsesoriaController::reservarTicket). */
  modalidad: TipoAsesoria;
  /** Duración en minutos de la consulta que da el asesor — fija según la modalidad al momento
   * en que se emitió esta ficha. */
  duracionMinutos: number;
  /** ISO date (YYYY-MM-DD), solo aplica a tickets origen 'plan' */
  fechaExpira?: string | null;
  solicitudAsesoriaId?: string | null;
  /** ISO datetime */
  creadoEn: string;
}

export interface MensajeAsesoria {
  id: string;
  solicitudId: string;
  autorId: string;
  texto: string;
  /** ISO datetime */
  creadoEn: string;
}

// Inbox simple por usuario, leído vía polling — hoy solo lo llena el flujo de asesoría.
export interface NotificacionUsuario {
  id: string;
  usuarioId: string;
  tipo: string;
  mensaje: string;
  referenciaTipo?: string | null;
  referenciaId?: string | null;
  /** ISO datetime — null si no se ha leído */
  leidaEn?: string | null;
  /** ISO datetime */
  creadoEn: string;
}
