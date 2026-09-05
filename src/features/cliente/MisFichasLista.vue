<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faPlus, faTrash, faInbox, faGraduationCap, faHeadset, faUserGroup, faChevronRight, instrumentoIcons, instrumentoLabels, instrumentoLabelsPlural } from '@/lib/icons';
import { fechaEdicionFalsa } from '@/lib/fichasDemoFake';
import { useEjemplosQuery, useEliminarEjemplo, useActualizarEjemplo } from '@/composables/useEjemplos';
import { usePlantillasQuery } from '@/composables/usePlantillas';
import { useSectoresQuery } from '@/composables/useSectores';
import { useUsuariosQuery } from '@/composables/useUsuarios';
import { useHistorialCambiosQuery } from '@/composables/useHistorialCambios';
import { usePushActividad } from '@/composables/useActividad';
import { useEstadoEntrenamiento } from '@/composables/useEstadoEntrenamiento';
import { useMisSolicitudesQuery } from '@/composables/useAsesoria';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import { cuentaEfectivaDe, puedeVerFicha } from '@/lib/permisos';
import { puedeVerHistorial } from '@/lib/planAcceso';
import { validarValoresPlantilla, calcularProgresoValores } from '@/lib/valorValidation';
import { tiempoRelativo } from '@/lib/tiempoRelativo';
import ConfirmModal from '@/components/ConfirmModal.vue';
import NuevaFichaClienteModal from './NuevaFichaClienteModal.vue';
import type { Ejemplo, TipoInstrumento } from '@/types';

// Reusa exactamente la lógica de negocio de la antigua MisFichasPage.vue (límites de plan,
// colaboradores, historial, compartir) — lo único nuevo es el filtro opcional por tipo de
// instrumento, para que InstrumentoPage.vue pueda mostrar "Mis Formatos"/"Mis IOARR"/etc. sin
// duplicar nada. Sin PageShell propio: el título/ícono de cabecera vive en el componente padre.
const props = defineProps<{ tipo?: TipoInstrumento }>();
const emit = defineEmits<{ 'ver-mas': [] }>();

const estadoBadge: Record<string, string> = {
  'En progreso': 'bg-amber-50 text-amber-700 border border-amber-200',
  Completo: 'bg-brand-50 text-brand-700 border border-brand-200',
};

// Concordancia de género para "¿Quieres trabajar en un nuevo/una nueva X?" — puramente de
// redacción, no amerita meterlo en icons.ts junto a los labels.
const ARTICULO_NUEVO: Record<TipoInstrumento, string> = {
  formato: 'un nuevo formato',
  ficha_tecnica: 'una nueva ficha técnica',
  ioarr: 'un nuevo IOARR',
  perfil: 'un nuevo perfil',
};

const showModal = ref(false);
const eliminarFicha = ref<Ejemplo | null>(null);

const session = useSessionStore();
const ui = useUiStore();
const router = useRouter();
const { data: ejemplosData } = useEjemplosQuery();
const { data: plantillasData } = usePlantillasQuery();
const { data: usuariosData } = useUsuariosQuery();
const { data: sectoresData } = useSectoresQuery();
const { data: historialData } = useHistorialCambiosQuery();
const eliminarEjemplo = useEliminarEjemplo();
const actualizarEjemplo = useActualizarEjemplo();
const pushActividad = usePushActividad();
const { esNivel0, vencido, diasRestantes, limiteFichas, limiteConsultas, numeroNivel } = useEstadoEntrenamiento();
const clienteId = computed(() => session.sesion?.usuarioId ?? '');
const { data: misSolicitudes } = useMisSolicitudesQuery(clienteId, 'cliente');
const consultasUsadas = computed(() => (misSolicitudes.value ?? []).length);
const consultasAgotadas = computed(() => consultasUsadas.value >= limiteConsultas.value);

const plantillas = computed(() => plantillasData.value ?? []);
const sectores = computed(() => sectoresData.value ?? []);
const usuarios = computed(() => usuariosData.value ?? []);
const historialCambios = computed(() => historialData.value ?? []);
const muestraHistorial = computed(() => puedeVerHistorial(numeroNivel.value));

const cuentaId = computed(() => (session.sesion ? cuentaEfectivaDe(usuarios.value, session.sesion) : null));
const esTitular = computed(() => !!session.sesion && session.sesion.usuarioId === cuentaId.value);
const hayColaboradoresActivos = computed(() => usuarios.value.some((u) => u.cuentaClienteId === cuentaId.value && u.estado !== 'inactivo'));

// El límite del plan (banner de arriba) sigue contando TODAS las plantillas simultáneas del
// cliente, sin importar el tipo — un plan "3 plantillas simultáneas" no es "3 por tipo".
const todasMisFichas = computed(() => {
  if (!cuentaId.value || !session.sesion) return [];
  return (ejemplosData.value ?? [])
    .filter((e) => e.propietarioId === cuentaId.value)
    .filter((e) => puedeVerFicha(e, session.sesion!.usuarioId, esTitular.value));
});

const misFichas = computed(() =>
  todasMisFichas.value
    .map((ejemplo) => {
      const plantilla = plantillas.value.find((p) => p.id === ejemplo.plantillaId);
      const sector = plantilla ? sectores.value.find((s) => s.id === plantilla.sectorId) : undefined;
      const completo = plantilla ? Object.keys(validarValoresPlantilla(plantilla, ejemplo.valores)).length === 0 : false;
      const progreso = plantilla ? calcularProgresoValores(plantilla, ejemplo.valores) : null;
      return { ejemplo, plantilla, sector, completo, progreso };
    })
    .filter((f) => !!f.plantilla)
    .filter((f) => !props.tipo || f.plantilla!.instrumento === props.tipo),
);

async function handleToggleCompartida(ejemplo: Ejemplo) {
  const nuevoValor = !ejemplo.compartida;
  await actualizarEjemplo.mutateAsync({ id: ejemplo.id, data: { compartida: nuevoValor } });
  ui.toast(nuevoValor ? `"${ejemplo.nombre}" ahora es visible para tu equipo` : `"${ejemplo.nombre}" dejó de compartirse`);
}

const limiteAlcanzado = computed(() => todasMisFichas.value.length >= limiteFichas.value);
const nuevaFichaBloqueada = computed(() => vencido.value || limiteAlcanzado.value);

async function handleEliminar() {
  if (!eliminarFicha.value) return;
  await eliminarEjemplo.mutateAsync(eliminarFicha.value.id);
  await pushActividad.mutateAsync({ mensaje: `Se eliminó la ficha "${eliminarFicha.value.nombre}"`, color: 'red' });
  ui.toast(`Ficha "${eliminarFicha.value.nombre}" eliminada`);
  eliminarFicha.value = null;
}

function ultimoCambioDe(ejemploId: string) {
  return historialCambios.value.find((c) => c.ejemploId === ejemploId);
}
</script>

<template>
  <div>
    <div class="flex justify-end mb-4">
      <button
        @click="showModal = true"
        :disabled="nuevaFichaBloqueada"
        :title="vencido ? 'Tu plan de entrenamiento venció' : limiteAlcanzado ? `Alcanzaste el límite de ${limiteFichas} ${esNivel0 ? 'ejercicios' : 'plantillas simultáneas'} de tu plan` : undefined"
        type="button"
        class="px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        <FontAwesomeIcon :icon="faPlus" class="w-3.5 h-3.5" />
        Nueva ficha
      </button>
    </div>

    <div
      class="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs mb-4"
      :class="vencido ? 'bg-red-50 border-red-200 text-red-700' : limiteAlcanzado ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-blue-50 border-blue-200 text-blue-700'"
    >
      <FontAwesomeIcon :icon="faGraduationCap" class="w-3.5 h-3.5 shrink-0" />
      <template v-if="esNivel0">
        <template v-if="vencido">Tu plan de entrenamiento venció — tus ejercicios quedaron en modo solo lectura.</template>
        <template v-else>
          Modo entrenamiento — Plan Pedagógico · {{ todasMisFichas.length }}/{{ limiteFichas }} ejercicios · {{ diasRestantes }} día{{ diasRestantes === 1 ? '' : 's' }} restantes
        </template>
      </template>
      <template v-else>
        {{ todasMisFichas.length }}/{{ limiteFichas }} plantillas simultáneas{{ limiteAlcanzado ? ' — compra "Plantilla adicional" en Facturación para sumar más' : '' }}
      </template>
    </div>

    <div
      class="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs mb-6"
      :class="consultasAgotadas ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-violet-50 border-violet-200 text-violet-700'"
    >
      <FontAwesomeIcon :icon="faHeadset" class="w-3.5 h-3.5 shrink-0" />
      {{ consultasUsadas }}/{{ limiteConsultas }} consulta{{ limiteConsultas === 1 ? '' : 's' }} con docente{{ consultasAgotadas ? ' — compra "Consultoría 1 a 1" en Facturación para sumar más' : ' disponibles' }}
    </div>

    <div class="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
      <div v-if="misFichas.length === 0" class="flex flex-col items-center justify-center py-16 text-center px-6">
        <div class="w-12 h-12 rounded-full bg-gray-50 text-gray-300 flex items-center justify-center mb-3">
          <FontAwesomeIcon :icon="faInbox" class="w-5 h-5" />
        </div>
        <p class="text-sm font-medium text-heading">Todavía no tienes {{ tipo ? instrumentoLabelsPlural[tipo].toLowerCase() : 'fichas' }}</p>
        <p class="text-xs text-muted mt-1">Crea la primera para empezar a llenarla</p>
      </div>
      <div
        v-for="{ ejemplo, plantilla, sector, completo, progreso } in misFichas"
        :key="ejemplo.id"
        @click="router.push(`/mis-fichas/${ejemplo.id}`)"
        class="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-gray-50/60 transition-colors group"
      >
        <div class="w-14 h-14 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <FontAwesomeIcon :icon="instrumentoIcons[plantilla!.instrumento]" class="w-6 h-6" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-sm font-semibold text-heading truncate">{{ ejemplo.nombre }}</p>
            <span v-if="plantilla!.disponibleNivel0" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-medium shrink-0">
              <FontAwesomeIcon :icon="faGraduationCap" class="w-2.5 h-2.5" />
              Práctica
            </span>
            <span v-if="ejemplo.compartida" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 text-[10px] font-medium shrink-0">
              <FontAwesomeIcon :icon="faUserGroup" class="w-2.5 h-2.5" />
              Compartida
            </span>
          </div>
          <p class="text-xs text-muted">{{ sector?.nombre ?? '—' }} · {{ instrumentoLabels[plantilla!.instrumento] }}</p>
          <p class="text-[11px] text-gray-400 mt-0.5">
            Última edición:
            <template v-if="muestraHistorial && ultimoCambioDe(ejemplo.id)">
              {{ usuarios.find((u) => u.id === ultimoCambioDe(ejemplo.id)!.usuarioId)?.nombre ?? 'Usuario eliminado' }} · {{ tiempoRelativo(ultimoCambioDe(ejemplo.id)!.fecha) }}
            </template>
            <template v-else>{{ fechaEdicionFalsa(ejemplo.id) }}</template>
          </p>
        </div>
        <div v-if="progreso && progreso.total > 0" class="w-32 shrink-0">
          <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div class="h-full rounded-full" :class="completo ? 'bg-brand-500' : 'bg-amber-400'" :style="{ width: `${progreso.porcentaje}%` }" />
          </div>
          <p class="text-[11px] text-muted mt-1 text-right">{{ progreso.llenos }}/{{ progreso.total }} campos</p>
        </div>
        <span class="text-xs font-medium px-2.5 py-1 rounded-full shrink-0" :class="estadoBadge[completo ? 'Completo' : 'En progreso']">
          {{ completo ? 'Completo' : 'En progreso' }}
        </span>
        <button
          @click.stop="router.push(`/mis-fichas/${ejemplo.id}`)"
          type="button"
          class="px-4 py-2 rounded-lg border border-brand-200 text-brand-700 text-sm font-medium hover:bg-brand-50 transition-colors duration-75 flex items-center gap-1.5 shrink-0"
        >
          {{ completo ? 'Detalles' : 'Continuar' }}
          <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3" />
        </button>
        <button
          v-if="esTitular && hayColaboradoresActivos"
          @click.stop="handleToggleCompartida(ejemplo)"
          :title="ejemplo.compartida ? 'Dejar de compartir con tu equipo' : 'Compartir con tu equipo'"
          type="button"
          class="w-8 h-8 rounded-md flex items-center justify-center transition-colors shrink-0"
          :class="ejemplo.compartida ? 'text-violet-600 hover:bg-violet-50' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'"
        >
          <FontAwesomeIcon :icon="faUserGroup" class="w-3.5 h-3.5" />
        </button>
        <button
          @click.stop="eliminarFicha = ejemplo"
          title="Eliminar ficha"
          type="button"
          class="w-8 h-8 rounded-md flex items-center justify-center text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
        >
          <FontAwesomeIcon :icon="faTrash" class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <button
      v-if="misFichas.length > 0"
      @click="emit('ver-mas')"
      type="button"
      class="w-full flex items-center gap-3 mt-6 pt-8 pb-4 px-6 rounded-xl border border-dashed border-gray-200 text-left hover:border-brand-300 hover:bg-brand-50/30 transition-colors duration-75"
    >
      <div class="w-11 h-11 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
        <FontAwesomeIcon :icon="faInbox" class="w-5 h-5" />
      </div>
      <div>
        <p class="text-sm font-medium text-heading">¿Quieres trabajar en {{ ARTICULO_NUEVO[tipo ?? 'ficha_tecnica'] }}?</p>
        <p class="text-xs text-muted">Explora <span class="text-brand-600 font-medium">Más {{ tipo ? instrumentoLabelsPlural[tipo] : '' }}</span> y elige el que mejor se adapte a tu proyecto.</p>
      </div>
    </button>

    <NuevaFichaClienteModal :is-open="showModal" :preset-tipo="tipo" @close="showModal = false" />

    <ConfirmModal
      :is-open="!!eliminarFicha"
      title="Eliminar ficha"
      :message="`¿Seguro que deseas eliminar &quot;${eliminarFicha?.nombre}&quot;? Se perderá todo lo que hayas llenado. Esta acción no se puede deshacer.`"
      @confirm="handleEliminar"
      @close="eliminarFicha = null"
    />
  </div>
</template>
