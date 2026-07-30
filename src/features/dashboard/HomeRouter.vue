<script setup lang="ts">
import { useSessionStore } from '@/stores/session';
import DashboardPage from './DashboardPage.vue';
import InstrumentoPage from '@/features/cliente/InstrumentoPage.vue';
import DocenteHomePage from '@/features/docente/DocenteHomePage.vue';

const session = useSessionStore();
</script>

<template>
  <InstrumentoPage v-if="session.sesion?.rol === 'cliente'" tipo="formato" />
  <DocenteHomePage v-else-if="session.sesion?.rol === 'asesor'" />
  <DashboardPage v-else />
</template>
