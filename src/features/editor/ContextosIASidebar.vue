<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faWandMagicSparkles, faChevronRight, faPlus, faGear, faEllipsisVertical, faLayerGroup, sectorIcons } from '@/lib/icons';
import { tiempoRelativo } from '@/lib/tiempoRelativo';
import type { Seccion, ContextoGeneralIA, ContextoGlobalIA } from '@/types';

// Columna izquierda del panel de Contextos IA, de más específico a más compartido:
//  - Contexto por sección: propio de una sección de ESTA ficha.
//  - Contextos generales: propios de TODA esta ficha (no se comparten con otras).
//  - Contextos globales: reutilizables por cualquier ficha de cualquier sector.
defineProps<{
  secciones: Seccion[];
  seccionActivaId: string | null;
  generales: ContextoGeneralIA[];
  generalActivoId?: string | null;
  globales: ContextoGlobalIA[];
  globalActivoId?: string | null;
}>();

defineEmits<{
  'select-seccion': [string];
  'select-general': [string];
  'nuevo-general': [];
  'select-global': [string];
  'nuevo-global': [];
}>();
</script>

<template>
  <aside class="w-72 shrink-0 bg-sidebar text-white flex flex-col overflow-y-auto">
    <div class="px-4 py-4 bg-violet-500/15 border-b border-white/10">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-violet-500/25 border border-violet-400/30 flex items-center justify-center shrink-0">
          <FontAwesomeIcon :icon="faWandMagicSparkles" class="w-3.5 h-3.5 text-violet-200" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold flex items-center gap-2">
            Contextos IA
            <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-400/25 text-violet-100 tracking-wide">BETA</span>
          </p>
        </div>
        <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3 text-white/40" />
      </div>
      <p class="text-[11px] text-white/55 leading-snug mt-2">
        Gestiona el contexto que la IA usará para ayudarte en cada sección.
      </p>
    </div>

    <div class="px-3 pt-4">
      <p class="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-2 mb-2">Contexto por sección</p>
      <ul class="space-y-0.5">
        <li v-for="(sec, i) in secciones" :key="sec.id">
          <button
            @click="$emit('select-seccion', sec.id)"
            type="button"
            class="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors duration-75 group"
            :class="seccionActivaId === sec.id ? 'bg-violet-500/20 border border-violet-400/30' : 'border border-transparent hover:bg-white/5'"
          >
            <span
              class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
              :class="seccionActivaId === sec.id ? 'bg-violet-400/30 text-violet-100' : 'bg-white/10 text-white/60'"
            >
              {{ i + 1 }}
            </span>
            <span class="flex-1 min-w-0 truncate text-xs" :class="seccionActivaId === sec.id ? 'text-white font-medium' : 'text-white/70'">
              {{ sec.nombre }}
            </span>
            <FontAwesomeIcon :icon="faEllipsisVertical" class="w-2.5 h-2.5 text-white/25 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </li>
      </ul>
    </div>

    <div class="px-3 pt-6">
      <div class="flex items-center justify-between px-2 mb-2">
        <p class="text-[10px] font-semibold uppercase tracking-widest text-white/40">Contextos generales</p>
        <button
          @click="$emit('nuevo-general')"
          type="button"
          class="px-2 py-1 rounded-md bg-white/[0.06] border border-white/10 text-[10px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1"
        >
          <FontAwesomeIcon :icon="faPlus" class="w-2 h-2" />
          Nuevo
        </button>
      </div>
      <p class="text-[10.5px] text-white/35 leading-snug px-2 mb-2">Aplican a toda esta ficha, no se comparten con otras.</p>
      <ul class="space-y-1">
        <li v-for="g in generales" :key="g.id">
          <button
            @click="$emit('select-general', g.id)"
            type="button"
            class="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg border text-left transition-colors duration-75"
            :class="generalActivoId === g.id ? 'bg-amber-400/10 border-amber-400/30' : 'border-transparent hover:bg-white/5'"
          >
            <span class="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/25 flex items-center justify-center shrink-0">
              <FontAwesomeIcon :icon="faLayerGroup" class="w-3 h-3 text-amber-300" />
            </span>
            <span class="flex-1 min-w-0">
              <span class="block text-xs font-medium text-white/85 truncate">{{ g.nombre }}</span>
              <span class="block text-[10px] text-white/40">
                {{ g.actualizadoEn ? `Actualizado ${tiempoRelativo(g.actualizadoEn)}` : 'Sin actualizar' }}
              </span>
            </span>
          </button>
        </li>
        <li v-if="generales.length === 0" class="px-2 py-1.5 text-[11px] text-white/30 italic">Todavía no hay contextos generales.</li>
      </ul>
    </div>

    <div class="px-3 pt-6 pb-4 flex-1">
      <div class="flex items-center justify-between px-2 mb-2">
        <p class="text-[10px] font-semibold uppercase tracking-widest text-white/40">Contextos globales</p>
        <button
          @click="$emit('nuevo-global')"
          type="button"
          class="px-2 py-1 rounded-md bg-white/[0.06] border border-white/10 text-[10px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1"
        >
          <FontAwesomeIcon :icon="faPlus" class="w-2 h-2" />
          Nuevo
        </button>
      </div>
      <p class="text-[10.5px] text-white/35 leading-snug px-2 mb-2">Reutilizables por cualquier ficha de cualquier sector.</p>
      <ul class="space-y-1">
        <li v-for="g in globales" :key="g.id">
          <button
            @click="$emit('select-global', g.id)"
            type="button"
            class="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg border text-left transition-colors duration-75"
            :class="globalActivoId === g.id ? 'bg-emerald-400/10 border-emerald-400/30' : 'border-transparent hover:bg-white/5'"
          >
            <span class="w-7 h-7 rounded-lg bg-emerald-400/15 border border-emerald-400/25 flex items-center justify-center shrink-0">
              <FontAwesomeIcon :icon="sectorIcons[g.icono ?? ''] ?? faWandMagicSparkles" class="w-3 h-3 text-emerald-300" />
            </span>
            <span class="flex-1 min-w-0">
              <span class="block text-xs font-medium text-white/85 truncate">{{ g.nombre }}</span>
              <span class="block text-[10px] text-white/40">
                {{ g.actualizadoEn ? `Actualizado ${tiempoRelativo(g.actualizadoEn)}` : 'Sin actualizar' }}
              </span>
            </span>
            <span class="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] font-semibold text-white/60 shrink-0">{{ g.usos }}</span>
          </button>
        </li>
      </ul>
    </div>

    <button
      type="button"
      class="flex items-center gap-3 px-5 py-4 border-t border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm"
    >
      <FontAwesomeIcon :icon="faGear" class="w-3.5 h-3.5" />
      <span class="flex-1 text-left">Configuración de IA</span>
      <FontAwesomeIcon :icon="faChevronRight" class="w-3 h-3 text-white/30" />
    </button>
  </aside>
</template>
