<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faGear, faHeadset, faCircleInfo, faRightFromBracket } from '@/lib/icons';
import { useSessionStore } from '@/stores/session';
import { rolUsuarioLabels } from '@/lib/icons';
import { useUsuariosQuery } from '@/composables/useUsuarios';
import { useFacturacionQuery } from '@/composables/useFacturacion';
import { cuentaEfectivaDe } from '@/lib/permisos';
import { planes } from '@/data/planes';
import SimpleInfoModal from '@/components/SimpleInfoModal.vue';
import SettingsModal from './SettingsModal.vue';
import Avatar from '@/components/Avatar.vue';
import type { RolUsuario } from '@/types';

const rolColor: Record<RolUsuario, string> = {
  superusuario: 'text-amber-300',
  administrador: 'text-brand-400',
  cliente: 'text-sky-300',
  administrativo_asesorias: 'text-teal-300',
  asesor: 'text-fuchsia-300',
};

const props = defineProps<{ collapsed?: boolean }>();
const session = useSessionStore();
const router = useRouter();
const menuAbierto = ref(false);
const showAjustes = ref(false);
const showContacto = ref(false);
const showInfo = ref(false);
const rootEl = ref<HTMLElement | null>(null);
const menuEl = ref<HTMLElement | null>(null);

// El menú se teletransporta a <body>: el <aside> del sidebar tiene overflow-hidden (necesario para
// la animación de ancho al colapsar/expandir), así que un dropdown posicionado dentro de él quedaba
// recortado en vez de flotar por encima. Al vivir fuera, hay que calcular su posición a mano a
// partir del botón que lo abre en vez de depender de CSS relativo al padre.
const menuStyle = ref<Record<string, string>>({});
function actualizarPosicionMenu() {
  const el = rootEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (props.collapsed) {
    // +16 en vez de calzar el borde inferior justo con el del avatar: así el menú queda un poco
    // más arriba, con aire respecto al borde inferior de la ventana, en vez de pegado a él.
    menuStyle.value = {
      left: `${rect.right + 8}px`,
      bottom: `${window.innerHeight - rect.bottom + 16}px`,
      width: '224px',
    };
  } else {
    menuStyle.value = {
      left: `${rect.left + 12}px`,
      right: `${window.innerWidth - rect.right + 12}px`,
      bottom: `${window.innerHeight - rect.top + 8}px`,
    };
  }
}
function toggleMenu() {
  if (!menuAbierto.value) actualizarPosicionMenu();
  menuAbierto.value = !menuAbierto.value;
}
function handleResize() {
  if (menuAbierto.value) actualizarPosicionMenu();
}

const { data: usuariosData } = useUsuariosQuery();
const fotoUrl = computed(() => usuariosData.value?.find((u) => u.id === session.sesion?.usuarioId)?.fotoUrl ?? null);
const cuentaId = computed(() => {
  if (session.sesion?.rol !== 'cliente') return '';
  return cuentaEfectivaDe(usuariosData.value ?? [], session.sesion);
});
const { data: facturacionData } = useFacturacionQuery(cuentaId);
const plan = computed(() => planes.find((p) => p.id === facturacionData.value?.planId));

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  // El menú vive teletransportado a <body>, ya no es descendiente de rootEl — hay que revisar
  // ambos para no cerrarlo al hacer clic en una de sus propias opciones.
  if (rootEl.value?.contains(target)) return;
  if (menuEl.value?.contains(target)) return;
  menuAbierto.value = false;
}
onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
  window.addEventListener('resize', handleResize);
});
onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
  window.removeEventListener('resize', handleResize);
});

function handleLogout() {
  session.logout();
  router.replace({ name: 'login' });
}
</script>

<template>
  <div
    v-if="session.sesion"
    ref="rootEl"
    class="relative border-t border-white/10"
    :class="collapsed ? 'px-2 py-4' : 'px-4 py-4'"
  >
    <Teleport to="body">
      <Transition name="pop">
        <div
          v-if="menuAbierto"
          ref="menuEl"
          :style="menuStyle"
          class="fixed bg-sidebar rounded-2xl border border-brand-500/40 shadow-[0_0_0_1px_rgba(34,197,94,0.15),0_10px_15px_-3px_rgba(0,0,0,0.5),0_0_24px_-4px_rgba(34,197,94,0.35)] overflow-hidden z-50"
        >
          <button
            @click="menuAbierto = false; showAjustes = true"
            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/85 hover:bg-white/10 hover:text-white transition-colors duration-75"
          >
            <FontAwesomeIcon :icon="faGear" class="w-4 text-center" />
            Ajustes
          </button>
          <button
            @click="menuAbierto = false; showContacto = true"
            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/85 hover:bg-white/10 hover:text-white transition-colors duration-75"
          >
            <FontAwesomeIcon :icon="faHeadset" class="w-4 text-center" />
            Contacto
          </button>
          <button
            @click="menuAbierto = false; showInfo = true"
            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/85 hover:bg-white/10 hover:text-white transition-colors duration-75"
          >
            <FontAwesomeIcon :icon="faCircleInfo" class="w-4 text-center" />
            Más información
          </button>
          <div class="border-t border-white/10" />
          <button
            @click="handleLogout"
            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/85 hover:bg-white/10 hover:text-white transition-colors duration-75"
          >
            <FontAwesomeIcon :icon="faRightFromBracket" class="w-4 text-center" />
            Cerrar sesión
          </button>
        </div>
      </Transition>
    </Teleport>

    <button
      @click="toggleMenu"
      :title="collapsed ? session.sesion.nombre : undefined"
      class="w-full flex items-center text-left rounded-lg hover:bg-white/5 transition-colors duration-75 -mx-1 px-1 py-1"
      :class="collapsed ? 'justify-center' : 'gap-3'"
    >
      <Avatar :nombre="session.sesion.nombre" :foto-url="fotoUrl" size="w-8 h-8" />
      <div v-if="!collapsed" class="flex-1 min-w-0">
        <div class="text-sm font-medium truncate text-white">{{ session.sesion.nombre }}</div>
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-[11px] shrink-0" :class="rolColor[session.sesion.rol]">{{ rolUsuarioLabels[session.sesion.rol] }}</span>
          <span
            v-if="session.sesion.rol === 'cliente' && plan"
            class="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/70 truncate"
            :title="`Plan Nivel ${plan.numeroNivel} — ${plan.nombre}`"
          >
            Nivel {{ plan.numeroNivel }}
          </span>
        </div>
      </div>
    </button>

    <Teleport to="body">
      <SettingsModal :is-open="showAjustes" @close="showAjustes = false" />

      <SimpleInfoModal :is-open="showContacto" @close="showContacto = false" :icon="faHeadset" title="Contacto">
        <p>¿Tienes dudas o encontraste un problema en el editor de plantillas?</p>
        <p>Comunícate con el equipo técnico de Proyecta Fácil a través de tu canal interno habitual.</p>
      </SimpleInfoModal>

      <SimpleInfoModal :is-open="showInfo" @close="showInfo = false" :icon="faCircleInfo" title="Más información">
        <p class="font-medium text-heading">Proyecta Fácil — Editor de plantillas</p>
        <p>
          Panel de administración para convertir fichas técnicas oficiales de inversión pública
          (Invierte.pe) en plantillas digitales, y cargar ejemplos resueltos que alimentan a la IA
          asistente del formulador.
        </p>
      </SimpleInfoModal>
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
