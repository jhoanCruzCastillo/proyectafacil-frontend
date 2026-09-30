<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faBell } from '@/lib/icons';
import { useSessionStore } from '@/stores/session';
import { useNotificacionesQuery, useMarcarNotificacionLeida } from '@/composables/useNotificaciones';
import { tiempoRelativo } from '@/lib/tiempoRelativo';
import { tituloNotificacion } from '@/lib/notificacionUI';

// Campanita visible en todo el admin (montada en Sidebar) — hoy solo la llena el flujo de
// asesoría (ver AsesoriaController::notificar en el backend), pero el inbox es genérico por si se
// reutiliza para otra cosa más adelante.
const props = defineProps<{ collapsed?: boolean }>();
const session = useSessionStore();
const router = useRouter();
const usuarioId = computed(() => session.sesion?.usuarioId ?? '');

const { data: notificaciones } = useNotificacionesQuery(usuarioId);
const marcarLeida = useMarcarNotificacionLeida();

const abierto = ref(false);
const rootEl = ref<HTMLElement | null>(null);
const panelEl = ref<HTMLElement | null>(null);

const noLeidas = computed(() => (notificaciones.value ?? []).filter((n) => !n.leidaEn).length);
const noLeidasTexto = computed(() => (noLeidas.value > 9 ? '9+' : String(noLeidas.value)));

// El panel se teletransporta a <body>: el <aside> del sidebar tiene overflow-x-hidden (necesario
// para la animación de ancho al colapsar/expandir, ver UserMenu.vue), así que con el sidebar
// colapsado el panel — que se abre hacia la derecha, fuera del ancho angosto del riel — quedaba
// recortado (invisible) en vez de flotar por encima. Al vivir fuera hay que calcular su posición a
// mano a partir del botón que lo abre, igual que ya hace UserMenu.vue.
const panelStyle = ref<Record<string, string>>({});
function actualizarPosicion() {
  const el = rootEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (props.collapsed) {
    panelStyle.value = {
      left: `${rect.right + 8}px`,
      bottom: `${window.innerHeight - rect.bottom}px`,
      width: '288px',
    };
  } else {
    panelStyle.value = {
      left: `${rect.left}px`,
      right: `${window.innerWidth - rect.right}px`,
      bottom: `${window.innerHeight - rect.top + 8}px`,
    };
  }
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  // El panel vive teletransportado a <body>, ya no es descendiente de rootEl — hay que revisar
  // ambos para no cerrarlo al hacer clic en una notificación de su propia lista.
  if (rootEl.value?.contains(target)) return;
  if (panelEl.value?.contains(target)) return;
  abierto.value = false;
}
function handleResize() {
  if (abierto.value) actualizarPosicion();
}
onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
  window.addEventListener('resize', handleResize);
});
onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
  window.removeEventListener('resize', handleResize);
});

function toggle() {
  if (!abierto.value) actualizarPosicion();
  abierto.value = !abierto.value;
}

// Lo que aparece a la vista al abrir el panel se marca como leído automáticamente — sin esto, el
// contador se quedaba en rojo aunque el usuario ya hubiera visto la lista completa (solo bajaba al
// hacer clic en una notificación puntual, que además navega fuera).
watch(abierto, (open) => {
  if (!open) return;
  for (const n of notificaciones.value ?? []) {
    if (!n.leidaEn) marcarLeida.mutate(n.id);
  }
});

function abrir() {
  abierto.value = false;
  router.push({ name: 'home' });
}
</script>

<template>
  <div ref="rootEl" class="relative" :class="collapsed ? 'px-2' : 'px-4'">
    <button
      @click="toggle"
      type="button"
      :title="collapsed ? 'Notificaciones' : undefined"
      class="w-full flex items-center px-1 py-2.5 rounded-lg text-sm font-medium text-white/65 hover:bg-sidebar-hover hover:text-white transition-colors relative"
      :class="collapsed ? 'justify-center' : 'gap-3'"
    >
      <span class="relative shrink-0">
        <FontAwesomeIcon :icon="faBell" class="w-4 text-center" />
        <span
          v-if="noLeidas > 0 && collapsed"
          class="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none"
        >
          {{ noLeidasTexto }}
        </span>
      </span>
      <span v-if="!collapsed" class="flex-1 text-left">Notificaciones</span>
      <span v-if="noLeidas > 0 && !collapsed" class="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
        {{ noLeidasTexto }}
      </span>
    </button>

    <Teleport to="body">
      <Transition name="pop">
        <div
          v-if="abierto"
          ref="panelEl"
          :style="panelStyle"
          class="fixed bg-white rounded-2xl shadow-modal border border-gray-100 overflow-hidden z-50 flex flex-col"
        >
          <div class="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 shrink-0">
            <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FontAwesomeIcon :icon="faBell" class="w-3.5 h-3.5" />
            </div>
            <h3 class="flex-1 min-w-0 font-heading font-semibold text-sm text-heading">Notificaciones</h3>
            <span v-if="noLeidas > 0" class="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              {{ noLeidasTexto }}
            </span>
          </div>

          <div class="overflow-y-auto max-h-80">
            <p v-if="(notificaciones ?? []).length === 0" class="px-4 py-6 text-xs text-muted text-center">Sin notificaciones</p>
            <button
              v-for="n in notificaciones"
              :key="n.id"
              @click="abrir()"
              type="button"
              class="w-full flex flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors duration-75 border-b border-gray-100 last:border-0"
            >
              <span class="flex items-baseline justify-between gap-3">
                <span class="font-semibold text-xs text-heading">{{ tituloNotificacion(n.tipo) }}</span>
                <span class="text-[10px] text-muted shrink-0">{{ tiempoRelativo(n.creadoEn) }}</span>
              </span>
              <span class="text-xs text-muted leading-snug">{{ n.mensaje }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.pop-enter-active,
.pop-leave-active {
  transition: all 0.1s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
