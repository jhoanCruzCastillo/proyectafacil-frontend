<script setup lang="ts">
import { computed, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import {
  faCrown, faBriefcase, faCheck, faShieldHalved,
  faComments, faPhone, faEnvelope, faArrowRotateLeft, faHeadset, faLockOpen,
} from '@/lib/icons';
import PageShell from '@/components/PageShell.vue';
import PlanIcono from './PlanIcono.vue';
import PlanDetalleModal from './PlanDetalleModal.vue';
import { useSessionStore } from '@/stores/session';
import { useCheckoutPlan } from '@/composables/usePagos';
import { useFacturacionQuery } from '@/composables/useFacturacion';
import { useUsuariosQuery } from '@/composables/useUsuarios';
import { useUiStore } from '@/stores/ui';
import { cuentaEfectivaDe } from '@/lib/permisos';
import { planes } from '@/data/planes';
import type { Plan } from '@/types';

// Sirve tanto para un cliente que todavía no eligió ningún plan (Sesion.tienePlan === false — ver
// el guard en router/index.ts) como para uno que ya tiene uno activo (accesible desde el sidebar,
// "Planes y servicios") y quiere ver/cambiar su plan.
const session = useSessionStore();
const ui = useUiStore();
const checkoutPlan = useCheckoutPlan();

// Sin plan todavía: NO consultar facturación — ese endpoint auto-asigna Plan Nivel 1 + tarjeta de
// mentira la primera vez que se consulta (FacturacionController::crearDefault()), lo que le daría
// un plan "gratis" a cualquiera con solo abrir esta pantalla. Con un plan real ya no hay ese
// riesgo (la fila ya existe) — mismo guard que UserMenu.vue/useEstadoEntrenamiento.ts.
const { data: usuariosData } = useUsuariosQuery();
const cuentaIdFacturacion = computed(() => {
  if (!session.sesion || session.sesion.tienePlan === false) return '';
  return cuentaEfectivaDe(usuariosData.value ?? [], session.sesion);
});
const { data: facturacion } = useFacturacionQuery(cuentaIdFacturacion);

function esPlanActual(p: Plan): boolean {
  return facturacion.value?.planId === p.id;
}

const planDetalleAbierto = ref<Plan | null>(null);
function verDetalle(p: Plan) {
  planDetalleAbierto.value = p;
}
async function elegirDesdeModal(p: Plan) {
  await elegir(p);
  planDetalleAbierto.value = null;
}

const tab = ref<'membresia' | 'adicionales'>('membresia');

// Estilo por nivel — no por posición: si el catálogo agrega/reordena planes, sigue enganchando por
// numeroNivel en vez de romperse. Nivel 1 (Profesional) es el recomendado, igual criterio que
// cualquier tabla de precios de 3 franjas (entrada / recomendado / premium).
const ESTILO_POR_NIVEL: Record<number, { iconoClase: string; tarjetaClase: string; oleajeClase: string }> = {
  0: { iconoClase: 'bg-gray-100 text-gray-500', tarjetaClase: 'border-gray-200', oleajeClase: 'text-gray-100' },
  1: { iconoClase: 'bg-brand-100 text-brand-600', tarjetaClase: 'border-brand-300 shadow-lg shadow-brand-100/60', oleajeClase: 'text-brand-100' },
  2: { iconoClase: 'bg-purple-100 text-purple-600', tarjetaClase: 'border-purple-200', oleajeClase: 'text-purple-100' },
};
const ESTILO_DEFECTO = { iconoClase: 'bg-gray-100 text-gray-500', tarjetaClase: 'border-gray-200', oleajeClase: 'text-gray-100' };

function estiloDe(p: Plan) {
  return ESTILO_POR_NIVEL[p.numeroNivel] ?? ESTILO_DEFECTO;
}

function esRecomendado(p: Plan): boolean {
  return p.numeroNivel === 1;
}

function subtitulo(p: Plan): string {
  if (p.numeroNivel === 0) return 'Para practicar antes de tu proyecto real';
  if (p.numeroNivel === 1) return 'Para tu proyecto de inversión real';
  return 'Para equipos con varios proyectos a la vez';
}

async function elegir(p: Plan) {
  const usuarioId = session.sesion?.usuarioId;
  if (!usuarioId) return;
  try {
    await checkoutPlan.mutateAsync({ usuarioId, planId: p.id });
  } catch (e) {
    ui.toast(e instanceof Error ? e.message : 'No se pudo iniciar el pago', 'error');
  }
}

function cargando(p: Plan): boolean {
  return checkoutPlan.isPending.value && checkoutPlan.variables.value?.planId === p.id;
}

// Fila de confianza dentro de la cabecera (pedido explícito del usuario, replica el mockup) —
// "sellos" cortos tipo trust-badge.
const CONFIANZA: { icono: IconDefinition; titulo: string; texto: string }[] = [
  { icono: faArrowRotateLeft, titulo: 'Actualizaciones constantes', texto: 'Nuevas funciones cada mes' },
  { icono: faHeadset, titulo: 'Soporte prioritario 24/7', texto: 'Te ayudamos siempre' },
  { icono: faLockOpen, titulo: 'Sin permanencia', texto: 'Cancela cuando quieras' },
  { icono: faShieldHalved, titulo: 'Pago seguro', texto: 'Tus datos siempre protegidos' },
];
</script>

<template>
  <PageShell
    icon-color="#ffffff"
    icon-box-class="w-16 h-16"
    compact
    title="Planes y servicios"
    title-class="text-[3.375rem] sm:text-[3.75rem]"
    description="Elige el plan que mejor se adapte a tu proyecto y accede a herramientas, formatos profesionales y asesorías para impulsar tus inversiones."
    description-class="mt-2 text-[0.8rem]"
    header-full-bleed
    header-class="bg-[linear-gradient(90deg,#0a1120_0%,#23ab9f_100%)] px-6 sm:px-8 lg:px-10 py-4 sm:py-5"
    stats-class="flex flex-wrap items-center divide-x-2 divide-white/25 gap-y-3 mt-4"
  >
    <template #decoration>
      <!-- Mismo lenguaje de olas que las tarjetas de planes de abajo, pedido explícito del usuario
           para la cabecera: varias capas apiladas con la paleta a medida, cada una transparente a
           la izquierda y llegando a su color pleno a la derecha (gradiente lineal por ola), con
           sombra para dar profundidad. Los tonos oscuros van al frente (encima) y con más opacidad
           para que "sobresalgan" sobre los claros, que quedan detrás como fondo suave. -->
      <svg class="absolute inset-0 w-full h-full" viewBox="0 0 1600 300" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="ola-verdeAzulado" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#23ab9f" stop-opacity="0" />
            <stop offset="100%" stop-color="#23ab9f" stop-opacity="0.35" />
          </linearGradient>
          <linearGradient id="ola-verdeLima" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#24965a" stop-opacity="0" />
            <stop offset="100%" stop-color="#24965a" stop-opacity="0.35" />
          </linearGradient>
          <linearGradient id="ola-azul" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#119cce" stop-opacity="0" />
            <stop offset="100%" stop-color="#119cce" stop-opacity="0.4" />
          </linearGradient>
          <linearGradient id="ola-verdeAzuladoOscuro" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0d858a" stop-opacity="0" />
            <stop offset="100%" stop-color="#0d858a" stop-opacity="0.68" />
          </linearGradient>
          <linearGradient id="ola-verdeLimaOscuro" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#158262" stop-opacity="0" />
            <stop offset="100%" stop-color="#158262" stop-opacity="0.7" />
          </linearGradient>
          <linearGradient id="ola-azulOscuro" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0a6d92" stop-opacity="0" />
            <stop offset="100%" stop-color="#0a6d92" stop-opacity="0.8" />
          </linearGradient>
        </defs>

        <!-- Capas claras, al fondo -->
        <path fill="url(#ola-verdeAzulado)" filter="drop-shadow(0 6px 10px rgba(0,0,0,0.2))"
          d="M0,190 C200,150 400,230 600,190 C800,150 1000,230 1200,190 C1400,150 1500,190 1600,190 L1600,300 L0,300 Z" />
        <path fill="url(#ola-verdeLima)" filter="drop-shadow(0 6px 10px rgba(0,0,0,0.22))"
          d="M0,220 C250,180 450,260 700,220 C900,180 1100,260 1350,220 C1500,195 1550,220 1600,220 L1600,300 L0,300 Z" />
        <path fill="url(#ola-azul)" filter="drop-shadow(0 6px 10px rgba(0,0,0,0.25))"
          d="M0,250 C220,210 480,290 720,250 C920,210 1150,290 1400,250 C1500,230 1550,250 1600,250 L1600,300 L0,300 Z" />

        <!-- Capas oscuras, al frente — más opacas para que sobresalgan -->
        <path fill="url(#ola-verdeAzuladoOscuro)" filter="drop-shadow(0 8px 14px rgba(0,0,0,0.32))"
          d="M0,265 C260,235 500,295 760,265 C980,235 1200,295 1420,265 C1520,250 1560,265 1600,265 L1600,300 L0,300 Z" />
        <path fill="url(#ola-verdeLimaOscuro)" filter="drop-shadow(0 8px 14px rgba(0,0,0,0.34))"
          d="M0,278 C280,255 520,300 780,278 C1000,255 1220,300 1440,278 C1530,266 1570,278 1600,278 L1600,300 L0,300 Z" />
        <path fill="url(#ola-azulOscuro)" filter="drop-shadow(0 8px 14px rgba(0,0,0,0.38))"
          d="M0,290 C300,272 540,300 800,290 C1020,272 1240,300 1460,290 C1540,282 1580,290 1600,290 L1600,300 L0,300 Z" />
      </svg>

      <!-- Capa azul oscuro adicional sobre todo el fondo (mismo tono que el sidebar,
           --color-sidebar #0a1120) — pedido explícito del usuario para unificar mejor con el resto
           de la app. Opacidad baja para que el degradado y las olas de abajo se sigan viendo. -->
      <div class="absolute inset-0 bg-[#0a1120]/25" />
    </template>

    <template #icon>
      <!-- La misma corona a medida del plan Premium (nivel 2) — pedido explícito del usuario, en
           vez del ícono genérico de Font Awesome. -->
      <svg class="w-9 h-9" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path opacity="0.4" fill="currentColor" d="M16.7702 18.98H7.23024C6.81024 18.98 6.43024 18.71 6.29024 18.32L2.13024 6.67004C1.80024 5.74004 2.86024 4.95004 3.65024 5.52004L7.65024 8.38004C8.18024 8.76004 8.94024 8.53004 9.17024 7.92004L11.0602 2.88004C11.3802 2.01004 12.6102 2.01004 12.9302 2.88004L14.8202 7.92004C15.0502 8.54004 15.8002 8.76004 16.3402 8.38004L20.3402 5.52004C21.1402 4.95004 22.1902 5.75004 21.8602 6.67004L17.7002 18.32C17.5702 18.71 17.1902 18.98 16.7702 18.98Z" />
        <path fill="currentColor" d="M17 22H7C6.59 22 6.25 21.66 6.25 21.25C6.25 20.84 6.59 20.5 7 20.5H17C17.41 20.5 17.75 20.84 17.75 21.25C17.75 21.66 17.41 22 17 22Z" />
        <path fill="currentColor" d="M14.5 14.75H9.5C9.09 14.75 8.75 14.41 8.75 14C8.75 13.59 9.09 13.25 9.5 13.25H14.5C14.91 13.25 15.25 13.59 15.25 14C15.25 14.41 14.91 14.75 14.5 14.75Z" />
      </svg>
    </template>

    <template #stats>
      <div v-for="c in CONFIANZA" :key="c.titulo" class="flex items-center gap-2.5 px-8 first:pl-0">
        <div class="w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center shrink-0">
          <FontAwesomeIcon :icon="c.icono" class="w-3.5 h-3.5" />
        </div>
        <div class="min-w-0">
          <p class="text-[0.8rem] font-semibold text-white leading-tight truncate">{{ c.titulo }}</p>
          <p class="text-[0.8rem] text-white/60 leading-tight truncate">{{ c.texto }}</p>
        </div>
      </div>
    </template>

    <div class="inline-flex items-center gap-1 p-1 rounded-xl bg-gray-100 mb-4">
      <button
        @click="tab = 'membresia'"
        type="button"
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-[0.8rem] font-semibold transition-colors duration-100"
        :class="tab === 'membresia' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
      >
        <FontAwesomeIcon :icon="faCrown" class="w-3.5 h-3.5" />
        Planes de membresía
      </button>
      <button
        @click="tab = 'adicionales'"
        type="button"
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-[0.8rem] font-semibold transition-colors duration-100"
        :class="tab === 'adicionales' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
      >
        <FontAwesomeIcon :icon="faBriefcase" class="w-3.5 h-3.5" />
        Servicios adicionales
      </button>
    </div>

    <div v-if="tab === 'membresia'">
      <h2 class="text-lg font-bold text-heading mb-1">Elige tu plan ideal</h2>
      <p class="text-[0.8rem] text-muted mb-6">Accede a más plantillas, asesorías y herramientas según el plan que elijas.</p>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-[1130px] mx-auto">
        <div
          v-for="p in planes"
          :key="p.id"
          class="relative flex flex-col rounded-2xl border p-6 bg-white"
          :class="[estiloDe(p).tarjetaClase, esPlanActual(p) ? 'ring-2 ring-brand-500 ring-offset-2' : '']"
        >
          <!-- Geometría ondulada decorativa detrás del encabezado de la tarjeta — un tinte muy
               suave por nivel (gris/verde/morado), nunca compite con el contenido de encima.
               Recortada en su PROPIO contenedor (no en la tarjeta entera) para que el chip "Más
               elegido" de abajo pueda seguir asomando por encima del borde superior. -->
          <div class="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
            <svg
              class="absolute top-0 left-0 w-full h-32"
              :class="estiloDe(p).oleajeClase"
              viewBox="0 0 400 160"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                fill-opacity="0.5"
                d="M0,70 C70,30 130,110 200,70 C270,30 330,110 400,70 L400,0 L0,0 Z"
              />
              <path
                fill="currentColor"
                d="M0,100 C70,130 130,60 200,100 C270,130 330,60 400,100 L400,0 L0,0 Z"
              />
            </svg>
          </div>

          <span
            v-if="esRecomendado(p)"
            class="absolute -top-3 right-6 px-3 py-1 rounded-full bg-brand-600 text-white text-[10px] font-bold uppercase tracking-wide"
          >
            Más elegido
          </span>

          <div class="relative flex flex-col flex-1">
            <div class="w-16 h-16 rounded-full flex items-center justify-center mb-4" :class="estiloDe(p).iconoClase">
              <!-- Íconos a medida (svgrepo.com) pedidos por el usuario — más "llenos" que los
                   outline de Font Awesome, se leen más grandes al mismo tamaño de caja. -->
              <PlanIcono :numero-nivel="p.numeroNivel" class="w-[3.375rem] h-[3.375rem]" />
            </div>

            <div class="flex items-center gap-2">
              <p class="text-xs font-semibold uppercase tracking-widest text-brand-600">Nivel {{ p.numeroNivel }}</p>
              <span v-if="esPlanActual(p)" class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold uppercase tracking-wide">
                <FontAwesomeIcon :icon="faCheck" class="w-2.5 h-2.5" />
                Tu plan actual
              </span>
            </div>
            <p class="text-lg font-bold text-heading">{{ p.nombre }}</p>
            <p class="text-[0.8rem] text-muted mb-4">{{ subtitulo(p) }}</p>

            <p class="text-3xl font-bold text-heading">
              S/ {{ p.precio }}
              <span class="text-[0.8rem] font-normal text-muted"> {{ p.periodicidad === 'Único' ? '· pago único' : '/ mes' }}</span>
            </p>

            <ul class="flex-1 space-y-2.5 my-6">
              <li v-for="(f, i) in p.features" :key="i" class="flex items-start gap-2 text-[0.8rem] text-gray-600 leading-snug">
                <FontAwesomeIcon :icon="faCheck" class="w-3 h-3 text-brand-500 mt-1 shrink-0" />
                {{ f }}
              </li>
            </ul>

            <div class="flex items-center gap-2">
              <button
                v-if="esPlanActual(p)"
                type="button"
                disabled
                class="flex-1 px-4 py-2.5 rounded-lg text-[0.8rem] font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
              >
                Tu plan actual
              </button>
              <button
                v-else
                @click="elegir(p)"
                :disabled="cargando(p)"
                type="button"
                class="flex-1 px-4 py-2.5 rounded-lg text-[0.8rem] font-medium disabled:opacity-60 transition-colors duration-75"
                :class="esRecomendado(p) ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-gray-900 text-white hover:bg-gray-800'"
              >
                {{ cargando(p) ? 'Procesando…' : 'Elegir plan' }}
              </button>
              <button
                @click="verDetalle(p)"
                type="button"
                class="px-4 py-2.5 rounded-lg text-[0.8rem] font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors duration-75"
              >
                Ver detalles
              </button>
            </div>
          </div>
        </div>
      </div>

      <PlanDetalleModal
        :is-open="!!planDetalleAbierto"
        :plan="planDetalleAbierto"
        :subtitulo="planDetalleAbierto ? subtitulo(planDetalleAbierto) : ''"
        :es-actual="planDetalleAbierto ? esPlanActual(planDetalleAbierto) : false"
        :es-recomendado="planDetalleAbierto ? esRecomendado(planDetalleAbierto) : false"
        :cargando="planDetalleAbierto ? cargando(planDetalleAbierto) : false"
        @close="planDetalleAbierto = null"
        @elegir="elegirDesdeModal"
      />

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10">
        <div class="rounded-2xl bg-purple-50 border border-purple-100 p-6 flex items-start gap-4">
          <div class="w-11 h-11 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
            <FontAwesomeIcon :icon="faHeadset" class="w-5 h-5" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[0.8rem] font-bold text-heading">¿Necesitas algo más?</p>
            <p class="text-[0.8rem] text-muted mt-0.5 leading-snug">Completa tu experiencia contratando servicios adicionales según lo que necesites.</p>
            <button
              @click="tab = 'adicionales'"
              type="button"
              class="mt-3 px-4 py-2 rounded-lg bg-purple-600 text-white text-[0.8rem] font-semibold hover:bg-purple-700 transition-colors duration-75"
            >
              Ver servicios adicionales →
            </button>
          </div>
        </div>

        <div class="rounded-2xl bg-brand-50 border border-brand-100 p-6">
          <div class="flex items-start gap-4">
            <div class="w-11 h-11 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
              <FontAwesomeIcon :icon="faComments" class="w-5 h-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[0.8rem] font-bold text-heading">¿Tienes dudas o necesitas asesoría?</p>
              <p class="text-[0.8rem] text-muted mt-0.5 leading-snug">Habla con nuestro equipo de ventas y recibe orientación personalizada.</p>
            </div>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3 mt-4 pl-[60px]">
            <div class="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.8rem] text-gray-600">
              <span class="flex items-center gap-1.5"><FontAwesomeIcon :icon="faPhone" class="w-3 h-3 text-gray-400" /> +51 987 654 321</span>
              <span class="flex items-center gap-1.5"><FontAwesomeIcon :icon="faEnvelope" class="w-3 h-3 text-gray-400" /> ventas@proyectafacil.com</span>
              <span class="text-gray-400">Lun. a vie., 9:00–18:00</span>
            </div>
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-brand-600 text-white text-[0.8rem] font-semibold hover:bg-brand-700 transition-colors duration-75 shrink-0"
            >
              Contactar ventas
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center text-center py-16 text-muted">
      <div class="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mb-4">
        <FontAwesomeIcon :icon="faBriefcase" class="w-5 h-5" />
      </div>
      <p class="text-[0.8rem] font-medium text-heading">Servicios adicionales</p>
      <p class="text-[0.8rem] text-muted mt-1 max-w-xs">Muy pronto vas a poder contratar consultoría 1 a 1 y otros servicios adicionales desde aquí.</p>
    </div>
  </PageShell>
</template>
