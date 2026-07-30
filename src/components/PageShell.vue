<script setup lang="ts">
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';

// Estructura estándar de página sobre el fondo oscuro: un panel de cabecera semitransparente
// ("glass" — ícono + título + descripción + acciones + fila opcional de métricas) seguido de un
// contenedor blanco donde vive todo el contenido principal de la sección. Aplica a todas las
// pantallas del admin — ver CLAUDE.md.
withDefaults(
  defineProps<{
    icon?: IconDefinition;
    /** Color del ícono y su fondo tintado — por defecto el verde de marca; una página de detalle
     * de sector puede pasar el colorAccent propio del sector. */
    iconColor?: string;
    title: string;
    description?: string;
    /** Clases del <div> de contenido (el contenedor blanco) — por defecto padding estándar;
     * pasar '' para contenido que necesita ir al borde (tablas, paneles con su propio scroll). */
    contentClass?: string;
    /** true = el slot por defecto ya trae su propio contenedor blanco (ej. una tabla con su
     * propio bg-surface-card) — PageShell no agrega uno encima, solo deja el margen superior. */
    bare?: boolean;
    /** true = cabecera más baja (menos padding, título/ícono más chicos) — para páginas donde los
     * indicadores viven en el contenido blanco en vez de dentro de la cabecera oscura. */
    compact?: boolean;
  }>(),
  { contentClass: 'p-6 sm:p-8 lg:px-12 xl:px-16' },
);
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <div class="px-6 sm:px-8 pt-6 sm:pt-8">
      <div v-if="$slots.breadcrumb" class="mb-4">
        <slot name="breadcrumb" />
      </div>

      <div class="rounded-2xl bg-glass border border-glass-border" :class="compact ? 'p-4 sm:p-5' : 'p-6 sm:p-8'">
        <div class="flex flex-wrap items-start justify-between gap-6">
          <div class="min-w-0">
            <div class="flex items-center gap-3">
              <div
                v-if="icon"
                class="rounded-xl flex items-center justify-center shrink-0"
                :class="[compact ? 'w-9 h-9' : 'w-11 h-11', iconColor ? '' : 'bg-brand-500/15 text-brand-400']"
                :style="iconColor ? { backgroundColor: iconColor + '26', color: iconColor } : undefined"
              >
                <FontAwesomeIcon :icon="icon" :class="compact ? 'w-4 h-4' : 'w-5 h-5'" />
              </div>
              <h1 class="font-bold text-white" :class="compact ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl'">{{ title }}</h1>
            </div>
            <p v-if="description" class="text-white/60 max-w-xl" :class="compact ? 'mt-1 text-xs' : 'mt-2 text-sm'">{{ description }}</p>
            <div class="rounded-full bg-brand-500" :class="compact ? 'mt-2 h-0.5 w-8' : 'mt-3 h-1 w-10'" />
          </div>
          <div v-if="$slots.actions" class="flex items-center gap-3 shrink-0">
            <slot name="actions" />
          </div>
        </div>

        <div v-if="$slots.stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4" :class="compact ? 'mt-5' : 'mt-8'">
          <slot name="stats" />
        </div>
      </div>
    </div>

    <!-- Contenedor blanco: ancho completo sin márgenes laterales, cubre todo el resto de la
         página hacia abajo — solo la cabecera de arriba queda fuera de él. -->
    <div v-if="bare" class="flex-1 mt-6">
      <slot />
    </div>
    <div v-else class="flex-1 mt-6 bg-surface-card rounded-t-2xl sm:rounded-t-3xl shadow-card" :class="contentClass">
      <slot />
    </div>
  </div>
</template>
