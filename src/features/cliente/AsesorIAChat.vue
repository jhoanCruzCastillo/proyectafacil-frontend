<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faRobot, faXmark, faPaperPlane, faCheck, faPaperclip, faFilePdf } from '@/lib/icons';
import { renderMarkdown } from '@/lib/markdown';
import { buscarEnGlosario, buscarEnAyudas } from '@/lib/glosarioIA';
import { consultarAsistenteIA, pedirAyudaCampo, type ArchivoContextoIA } from '@/api/http/asistenteIA.http';
import { useGuardarArchivoFuente } from '@/composables/useFuenteVerdad';
import { esCampoAyudableConIA } from '@/lib/camposAyudaIA';
import PdfsContextoFichaModal from './PdfsContextoFichaModal.vue';
import type { Plantilla, TipoCampo } from '@/types';

const props = defineProps<{
  plantilla: Plantilla;
  seccionActivaId: string | null;
  permitido: boolean;
  /** Para traer la fuente de la verdad real de esta ficha en "ayúdame a llenar el campo X". */
  ejemploId: string;
  /** editedValores de la ficha — solo para pasarle a la IA "lo que el usuario ya escribió" como
   * contexto de un campo puntual, nunca para escribir directamente. */
  valoresActuales?: Record<string, string>;
}>();

const emit = defineEmits<{
  /** Identificador del campo a resaltar (outline morado) en el editor, o null para apagarlo. */
  'resaltar-campo': [identificador: string | null];
  /** El usuario eligió una de las opciones recomendadas — el padre la escribe con el mismo camino
   * borrador→confirmado que usa cualquier otra edición (ver onAplicarValorDesdeChat). */
  'aplicar-valor-campo': [payload: { campoId: string; identificador: string; valor: string }];
}>();

interface CampoCandidato {
  campoId: string;
  identificador: string;
  etiqueta: string;
  tipo: TipoCampo;
  opciones?: string[];
  /** Subsección a la que pertenece — se muestra junto al identificador para ayudar a distinguir
   * candidatos con la misma etiqueta (ver desambiguación más abajo). */
  contexto: string;
}

interface Mensaje {
  id: string;
  autor: 'asesor' | 'usuario';
  texto: string;
  fuente?: string;
  /** Desambiguación: más de un campo con nombre parecido en la sección actual. */
  candidatos?: CampoCandidato[];
  /** Candidato resaltado en pantalla mientras el usuario todavía no confirma cuál quiso decir. */
  candidatoElegidoId?: string | null;
  /** Valores recomendados por la IA para un campo ya identificado. */
  opciones?: string[];
  /** Cuál de esas opciones ya se aplicó al campo — null = ninguna todavía. */
  opcionAplicada?: string | null;
  /** A qué campo escribir cuando se elija una opción. */
  campoDestino?: { campoId: string; identificador: string } | null;
  /** Modo "verificar": true = el valor actual ya está bien, false = conviene mejorarlo (ver
   * `opciones`), undefined = no es una respuesta de verificación. */
  correcto?: boolean | null;
  /** Ni la fuente de la verdad ni los PDF de "Contexto general" bastaron — se ofrece la lista de
   * esos PDF para que el usuario los revise él mismo (ver PdfsContextoFichaModal). */
  archivosContexto?: ArchivoContextoIA[];
}

let contadorMsg = 0;
const idMensaje = () => `msg-${++contadorMsg}`;

const abierto = ref(false);
const mensajes = ref<Mensaje[]>([]);
const escribiendo = ref(false);
const input = ref('');
const scrollRef = ref<HTMLElement | null>(null);

// Adjuntar documentos desde el chat — pedido explícito del usuario: en vez de obligarlo a abrir el
// modal "Fuente de la verdad" aparte, reusa exactamente el mismo endpoint/composable de ahí
// (mismos formatos y límite: PDF/TXT/MD, 10 MB), así el archivo queda disponible tanto para el
// llenado automático de la ficha como para "ayúdame a llenar el campo X" en el acto.
const EXTENSIONES_ARCHIVO_PERMITIDAS = ['pdf', 'txt', 'md'];
const TAMANO_MAXIMO_ARCHIVO = 10 * 1024 * 1024;
const guardarArchivoFuente = useGuardarArchivoFuente();
const inputArchivoRef = ref<HTMLInputElement | null>(null);
const subiendoArchivo = ref(false);

const seccionActiva = computed(() => props.plantilla.secciones.find((s) => s.id === props.seccionActivaId));

watch([mensajes, escribiendo], () => {
  nextTick(() => {
    scrollRef.value?.scrollTo({ top: scrollRef.value.scrollHeight, behavior: 'smooth' });
  });
}, { deep: true });

function agregarMensaje(autor: Mensaje['autor'], texto: string, fuente?: string) {
  mensajes.value.push({ id: idMensaje(), autor, texto, fuente });
}

function responderConRetraso(extra: Partial<Omit<Mensaje, 'id' | 'autor'>> & { texto: string }) {
  escribiendo.value = true;
  setTimeout(() => {
    escribiendo.value = false;
    mensajes.value.push({ id: idMensaje(), autor: 'asesor', ...extra });
  }, 600);
}

function handleAbrir() {
  abierto.value = true;
  if (mensajes.value.length === 0) {
    const nombreSeccion = seccionActiva.value ? `${seccionActiva.value.numero} — ${seccionActiva.value.nombre}` : 'tu ficha';
    agregarMensaje('asesor', `Hola, soy tu asesor de llenado. Veo que estás en la sección **${nombreSeccion}**. Elige una subsección de abajo, pídeme "ayúdame a llenar el campo X", o escríbeme tu duda.`);
  }
}

function abrirSelectorArchivo() {
  inputArchivoRef.value?.click();
}

function handleArchivoChat(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = ''; // permite volver a elegir el mismo archivo después de un error
  if (!file) return;

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!EXTENSIONES_ARCHIVO_PERMITIDAS.includes(extension)) {
    agregarMensaje('asesor', 'Por ahora solo puedo recibir archivos PDF, TXT o MD.');
    return;
  }
  if (file.size > TAMANO_MAXIMO_ARCHIVO) {
    agregarMensaje('asesor', `"${file.name}" supera los 10 MB permitidos.`);
    return;
  }

  agregarMensaje('usuario', `📎 ${file.name}`);
  subiendoArchivo.value = true;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await guardarArchivoFuente.mutateAsync({ ejemploId: props.ejemploId, nombre: file.name, dataUrl: reader.result as string });
      subiendoArchivo.value = false;
      agregarMensaje('asesor', `Agregué "${file.name}" a la fuente de la verdad de esta ficha — ya puedo usar su contenido para ayudarte a llenar campos o responder tus preguntas.`);
    } catch (err) {
      subiendoArchivo.value = false;
      agregarMensaje('asesor', err instanceof Error ? err.message : `No pude subir "${file.name}". Inténtalo de nuevo.`);
    }
  };
  reader.onerror = () => {
    subiendoArchivo.value = false;
    agregarMensaje('asesor', `No pude leer "${file.name}".`);
  };
  reader.readAsDataURL(file);
}

function preguntarPorSubseccion(subId: string) {
  const sub = seccionActiva.value?.subsecciones.find((s) => s.id === subId);
  if (!sub) return;
  agregarMensaje('usuario', `¿Cómo lleno "${sub.codigo} — ${sub.nombre}"?`);
  responderConRetraso({
    texto: sub.ayuda?.trim() || 'Todavía no hay ayuda cargada para esta subsección. Revisa el ejemplo de referencia arriba, o consúltalo con tu asesor humano en las mentorías grupales.',
    fuente: sub.ayuda?.trim() ? `Ayuda de ${sub.codigo} — ${sub.nombre}` : undefined,
  });
}

// --- "Ayúdame a llenar el campo X" ------------------------------------------------------------

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!'".,:]/g, '').trim();
}

const PATRONES_AYUDA_CAMPO: RegExp[] = [
  /^ay[uú]dame a llenar(?:\s+el campo)?\s+(.+)$/i,
  /^ay[uú]da(?:me)?\s+con(?:\s+el campo)?\s+(.+)$/i,
  /^c[oó]mo (?:lleno|completo|relleno)(?:\s+el campo)?\s+(.+)$/i,
  /^quiero llenar(?:\s+el campo)?\s+(.+)$/i,
  /^llena(?:r)?(?:\s+el campo)?\s+(.+)$/i,
  // Preguntas en forma de duda ("qué pongo en X", "qué va en el campo X") — mismo intento que
  // "ayúdame a llenar", solo que fraseado como pregunta en vez de pedido directo.
  /^(?:una pregunta,?\s*)?qu[eé]\s+(?:pongo|coloco|escribo|debo\s+poner|debo\s+escribir|debo\s+colocar|va)\s+en\s+(?:el campo\s+)?(.+)$/i,
];

/** null = el mensaje no pide ayuda para un campo puntual (sigue el chat libre de siempre). */
function extraerNombreCampo(mensaje: string): string | null {
  const limpio = mensaje.trim().replace(/[.?!]+$/, '');
  const entreComillas = limpio.match(/["“”']([^"“”']{2,})["“”']/) ?? limpio.match(/<([^>]{2,})>/);
  if (entreComillas) return entreComillas[1].trim();

  for (const patron of PATRONES_AYUDA_CAMPO) {
    const m = limpio.match(patron);
    if (m) return m[1].trim();
  }
  return null;
}

/** Busca SOLO en la sección activa (pedido explícito del usuario). Prioriza coincidencias exactas
 * de etiqueta — si hay alguna, descarta las parciales (evita que "Nombre" dispare una lista enorme
 * cuando en realidad hay un "Nombre" exacto en la sección). */
function buscarCandidatos(nombre: string): CampoCandidato[] {
  if (!seccionActiva.value) return [];
  const buscado = normalizar(nombre);
  const candidatos: CampoCandidato[] = [];

  for (const sub of seccionActiva.value.subsecciones) {
    for (const campo of sub.campos) {
      if (!esCampoAyudableConIA(campo)) continue;
      const etiqueta = normalizar(campo.etiqueta);
      if (etiqueta === buscado || etiqueta.includes(buscado) || buscado.includes(etiqueta)) {
        candidatos.push({
          campoId: campo.id,
          identificador: campo.identificador,
          etiqueta: campo.etiqueta,
          tipo: campo.tipo,
          opciones: campo.opciones,
          contexto: `${sub.codigo} ${sub.nombre}`,
        });
      }
    }
  }

  const exactos = candidatos.filter((c) => normalizar(c.etiqueta) === buscado);
  return exactos.length > 0 ? exactos : candidatos;
}

function resaltarCampo(identificador: string | null) {
  emit('resaltar-campo', identificador);
}

async function manejarAyudaCampo(nombreCampo: string) {
  if (!seccionActiva.value) {
    responderConRetraso({ texto: 'No pude identificar en qué sección estás — ve a la sección de la ficha e inténtalo de nuevo.' });
    return;
  }

  const candidatos = buscarCandidatos(nombreCampo);
  if (candidatos.length === 0) {
    responderConRetraso({
      texto: `No encontré un campo llamado "${nombreCampo}" en la sección **${seccionActiva.value.numero} — ${seccionActiva.value.nombre}**. Revisa el nombre o navega a la sección correcta e inténtalo de nuevo.`,
    });
    return;
  }

  if (candidatos.length === 1) {
    resaltarCampo(candidatos[0].identificador);
    await pedirAyudaParaCampo(candidatos[0], 'llenar');
    return;
  }

  escribiendo.value = true;
  setTimeout(() => {
    escribiendo.value = false;
    mensajes.value.push({
      id: idMensaje(),
      autor: 'asesor',
      texto: `Encontré ${candidatos.length} campos parecidos en esta sección. ¿A cuál te refieres?`,
      candidatos,
      candidatoElegidoId: null,
    });
  }, 400);
}

/** Solo previsualiza (resalta + scrollea) — no dispara la consulta a la IA todavía. */
function previsualizarCandidato(mensaje: Mensaje, candidato: CampoCandidato) {
  mensaje.candidatoElegidoId = candidato.campoId;
  resaltarCampo(candidato.identificador);
}

async function confirmarCandidato(mensaje: Mensaje) {
  const candidato = mensaje.candidatos?.find((c) => c.campoId === mensaje.candidatoElegidoId);
  if (!candidato) return;
  await pedirAyudaParaCampo(candidato, 'llenar');
}

/** Valores que el usuario ya confirmó en OTROS campos de la sección activa — le da a la IA contexto
 * situacional (ej. el distrito ya indicado en un campo anterior) sin repetirlo en cada pregunta. */
function construirContextoSeccion(excluirIdentificador: string): Record<string, string> {
  if (!seccionActiva.value) return {};
  const contexto: Record<string, string> = {};
  for (const sub of seccionActiva.value.subsecciones) {
    for (const campo of sub.campos) {
      if (campo.identificador === excluirIdentificador) continue;
      const valor = props.valoresActuales?.[campo.identificador]?.trim();
      if (valor) contexto[campo.identificador] = valor;
    }
  }
  return contexto;
}

async function pedirAyudaParaCampo(candidato: CampoCandidato, modo: 'llenar' | 'verificar') {
  escribiendo.value = true;
  try {
    const respuesta = await pedirAyudaCampo({
      plantillaId: props.plantilla.id,
      seccionId: seccionActiva.value!.id,
      ejemploId: props.ejemploId,
      modo,
      contextoSeccion: construirContextoSeccion(candidato.identificador),
      campo: {
        identificador: candidato.identificador,
        etiqueta: candidato.etiqueta,
        tipo: candidato.tipo,
        opciones: candidato.opciones,
        valorActual: props.valoresActuales?.[candidato.identificador],
      },
    });
    escribiendo.value = false;
    mensajes.value.push({
      id: idMensaje(),
      autor: 'asesor',
      texto: respuesta.explicacion,
      opciones: respuesta.opciones,
      opcionAplicada: null,
      campoDestino: { campoId: candidato.campoId, identificador: candidato.identificador },
      correcto: respuesta.correcto,
      archivosContexto: respuesta.sinInformacionSuficiente ? (respuesta.archivosContexto ?? []) : undefined,
    });
  } catch (err) {
    escribiendo.value = false;
    agregarMensaje('asesor', err instanceof Error ? err.message : 'No pude consultar al asesor de IA para este campo. Inténtalo de nuevo en un momento.');
  }
}

// --- Botón "?" de cada campo (ver FieldCard.vue) ----------------------------------------------
// A diferencia de manejarAyudaCampo() (chat libre, busca por nombre y puede desambiguar), acá el
// campo ya viene resuelto por identificador exacto desde el propio editor — se abre el chat, se
// resalta el campo y se dispara la MISMA consulta a la IA, sin pasar por la búsqueda difusa.
const pdfsContextoAbierto = ref(false);
const pdfsContextoArchivos = ref<ArchivoContextoIA[]>([]);

function abrirPdfsContexto(archivos: ArchivoContextoIA[]) {
  pdfsContextoArchivos.value = archivos;
  pdfsContextoAbierto.value = true;
}

async function solicitarAyudaCampo(identificador: string, modo: 'llenar' | 'verificar') {
  if (!seccionActiva.value) return;
  let candidato: CampoCandidato | null = null;
  for (const sub of seccionActiva.value.subsecciones) {
    const campo = sub.campos.find((c) => c.identificador === identificador);
    if (campo) {
      candidato = {
        campoId: campo.id,
        identificador: campo.identificador,
        etiqueta: campo.etiqueta,
        tipo: campo.tipo,
        opciones: campo.opciones,
        contexto: `${sub.codigo} ${sub.nombre}`,
      };
      break;
    }
  }
  if (!candidato) return;

  handleAbrir();
  resaltarCampo(candidato.identificador);
  agregarMensaje(
    'usuario',
    modo === 'llenar' ? `Ayúdame a llenar el campo ${candidato.identificador}` : `Ayúdame a verificar el campo ${candidato.identificador}`,
  );
  await pedirAyudaParaCampo(candidato, modo);
}

defineExpose({ solicitarAyudaCampo });

/** Aplica la opción elegida — las demás quedan visibles (el usuario las puede copiar a mano) pero
 * dejan de ser botones clicables, pedido explícito del usuario. */
function elegirOpcion(mensaje: Mensaje, opcion: string) {
  if (!mensaje.campoDestino || mensaje.opcionAplicada) return;
  mensaje.opcionAplicada = opcion;
  emit('aplicar-valor-campo', { campoId: mensaje.campoDestino.campoId, identificador: mensaje.campoDestino.identificador, valor: opcion });
}

// --- Chat libre (sin cambios respecto a la versión anterior) ----------------------------------

async function enviarPregunta() {
  const pregunta = input.value.trim();
  if (!pregunta || escribiendo.value) return;
  agregarMensaje('usuario', pregunta);
  input.value = '';

  const nombreCampo = extraerNombreCampo(pregunta);
  if (nombreCampo) {
    await manejarAyudaCampo(nombreCampo);
    return;
  }

  escribiendo.value = true;
  try {
    const { texto } = await consultarAsistenteIA({
      plantillaId: props.plantilla.id,
      seccionId: props.seccionActivaId ?? '',
      pregunta,
      // Los turnos previos, sin incluir el que se acaba de agregar.
      historial: mensajes.value
        .slice(-7, -1)
        .map((m) => ({ autor: m.autor === 'usuario' ? ('usuario' as const) : ('ia' as const), texto: m.texto })),
    });
    escribiendo.value = false;
    agregarMensaje('asesor', texto);
  } catch {
    escribiendo.value = false;
    const respuesta = buscarEnGlosario(pregunta) ?? buscarEnAyudas(pregunta, props.plantilla.secciones);
    agregarMensaje(
      'asesor',
      respuesta?.texto ?? 'No pude consultar al asesor de IA en este momento. Prueba de nuevo en un momento, pídeme "ayúdame a llenar el campo X", o consúltalo con tu asesor humano.',
      respuesta?.fuente,
    );
  }
}

function handleEnter(e: KeyboardEvent) {
  if (e.key === 'Enter') enviarPregunta();
}
</script>

<template>
  <button
    v-if="!permitido"
    title="Asesor de IA 24/7 — disponible desde Nivel 1, actualiza tu plan"
    type="button"
    class="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gray-300 text-white flex items-center justify-center shadow-lg cursor-not-allowed z-40"
  >
    <FontAwesomeIcon :icon="faRobot" class="w-5 h-5" />
  </button>

  <template v-else>
    <button
      v-if="!abierto"
      @click="handleAbrir"
      title="Asesor de IA 24/7"
      type="button"
      class="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-lg hover:bg-violet-700 transition-colors z-40"
    >
      <FontAwesomeIcon :icon="faRobot" class="w-5 h-5" />
      <span class="absolute top-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
    </button>

    <div v-else class="fixed bottom-6 right-6 w-96 h-[520px] bg-white rounded-2xl shadow-modal border border-gray-200 flex flex-col z-40 overflow-hidden">
      <div class="shrink-0 px-4 py-3 bg-violet-600 text-white flex items-center justify-between">
        <div class="flex items-center gap-2">
          <FontAwesomeIcon :icon="faRobot" class="w-4 h-4" />
          <div>
            <p class="text-sm font-bold leading-tight">Asesor de IA</p>
            <p class="text-[10px] text-violet-100 leading-tight">Disponible 24/7</p>
          </div>
        </div>
        <button @click="abierto = false" type="button" class="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors duration-75">
          <FontAwesomeIcon :icon="faXmark" class="w-3.5 h-3.5" />
        </button>
      </div>

      <div ref="scrollRef" class="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50">
        <div v-for="m in mensajes" :key="m.id" class="flex" :class="m.autor === 'usuario' ? 'justify-end' : 'justify-start'">
          <div
            class="max-w-[85%] rounded-xl px-3 py-2 text-xs"
            :class="m.autor === 'usuario' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-700'"
          >
            <div v-if="m.autor === 'asesor'" v-html="renderMarkdown(m.texto)" />
            <template v-else>{{ m.texto }}</template>
            <p v-if="m.fuente" class="mt-1 text-[10px] text-violet-500 font-medium">📎 {{ m.fuente }}</p>

            <!-- Desambiguación: más de un campo con nombre parecido en la sección actual. -->
            <div v-if="m.candidatos && m.candidatos.length" class="mt-2 space-y-1.5">
              <button
                v-for="c in m.candidatos"
                :key="c.campoId"
                type="button"
                @click="previsualizarCandidato(m, c)"
                class="w-full text-left px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors duration-75"
                :class="m.candidatoElegidoId === c.campoId
                  ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'"
              >
                {{ c.identificador }} — {{ c.etiqueta }}
                <span class="block text-[10px] text-muted font-normal">{{ c.contexto }}</span>
              </button>
              <button
                type="button"
                :disabled="!m.candidatoElegidoId"
                @click="confirmarCandidato(m)"
                class="w-full px-2.5 py-1.5 rounded-lg bg-fuchsia-600 text-white text-[11px] font-semibold hover:bg-fuchsia-700 transition-colors duration-75 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirmar
              </button>
            </div>

            <!-- Modo "verificar": el valor actual ya está bien, no hay nada que recomendar. -->
            <div v-if="m.correcto === true" class="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium">
              <FontAwesomeIcon :icon="faCheck" class="w-3 h-3 shrink-0" />
              Tu valor actual se ve correcto
            </div>

            <!-- Ni la fuente de la verdad ni las guías bastaron — se ofrecen los PDF de referencia. -->
            <div v-if="m.archivosContexto" class="mt-2">
              <button
                v-if="m.archivosContexto.length"
                type="button"
                @click="abrirPdfsContexto(m.archivosContexto)"
                class="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 text-[11px] font-medium hover:bg-violet-100 transition-colors duration-75"
              >
                <FontAwesomeIcon :icon="faFilePdf" class="w-3 h-3 shrink-0" />
                Ver documentos de referencia de esta ficha
              </button>
            </div>

            <!-- Valores recomendados para un campo ya identificado. -->
            <div v-if="m.opciones && m.opciones.length" class="mt-2 space-y-1.5">
              <p class="text-[10px] font-semibold text-fuchsia-600 uppercase tracking-wide">Valores recomendados</p>
              <template v-for="op in m.opciones" :key="op">
                <button
                  v-if="!m.opcionAplicada"
                  type="button"
                  @click="elegirOpcion(m, op)"
                  class="w-full text-left px-2.5 py-1.5 rounded-lg border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 text-[11px] font-medium hover:bg-fuchsia-100 transition-colors duration-75"
                >
                  {{ op }}
                </button>
                <div
                  v-else
                  class="w-full text-left px-2.5 py-1.5 rounded-lg border text-[11px] select-text"
                  :class="op === m.opcionAplicada ? 'border-emerald-300 bg-emerald-50 text-emerald-700 font-medium' : 'border-gray-100 bg-gray-50 text-gray-400'"
                >
                  <FontAwesomeIcon v-if="op === m.opcionAplicada" :icon="faCheck" class="w-3 h-3 inline mr-1" />
                  {{ op }}
                </div>
              </template>
              <p v-if="m.opcionAplicada" class="text-[10px] text-muted">Los demás valores ya no se aplican con un clic, pero puedes copiarlos a mano si prefieres otro.</p>
            </div>
          </div>
        </div>
        <div v-if="escribiendo" class="flex justify-start">
          <div class="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-400 italic">Escribiendo…</div>
        </div>
        <div v-if="subiendoArchivo" class="flex justify-start">
          <div class="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-400 italic">Subiendo archivo…</div>
        </div>
        <div v-if="!escribiendo && seccionActiva && mensajes.length <= 1" class="flex flex-wrap gap-1.5 pt-1">
          <button
            v-for="sub in seccionActiva.subsecciones"
            :key="sub.id"
            @click="preguntarPorSubseccion(sub.id)"
            type="button"
            class="px-2.5 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 text-[11px] font-medium hover:bg-violet-100 transition-colors duration-75"
          >
            {{ sub.codigo }} {{ sub.nombre }}
          </button>
        </div>
      </div>

      <div class="shrink-0 border-t border-gray-100 p-2 flex items-center gap-2">
        <input ref="inputArchivoRef" type="file" accept=".pdf,.txt,.md" class="hidden" @change="handleArchivoChat" />
        <button
          @click="abrirSelectorArchivo"
          :disabled="subiendoArchivo"
          type="button"
          title="Adjuntar PDF, TXT o MD a la fuente de la verdad de esta ficha"
          class="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-50 transition-colors duration-75 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FontAwesomeIcon :icon="faPaperclip" class="w-3.5 h-3.5" />
        </button>
        <input
          v-model="input"
          @keydown="handleEnter"
          type="text"
          placeholder="Escribe tu duda, o &quot;ayúdame a llenar el campo X&quot;..."
          class="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <button @click="enviarPregunta" type="button" class="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 transition-colors duration-75 shrink-0">
          <FontAwesomeIcon :icon="faPaperPlane" class="w-3 h-3" />
        </button>
      </div>
    </div>
  </template>

  <PdfsContextoFichaModal :is-open="pdfsContextoAbierto" :archivos="pdfsContextoArchivos" @close="pdfsContextoAbierto = false" />
</template>
