<script setup lang="ts">
import { useUiStore } from '@/stores/ui';
import Sidebar from '@/components/Sidebar.vue';

const ui = useUiStore();
</script>

<template>
  <div class="min-h-screen bg-page bg-[url('/bg-cont.webp')] bg-cover bg-top bg-no-repeat bg-fixed">
    <Sidebar :collapsed="ui.sidebarCollapsed" @toggle="ui.toggleSidebar" />

    <main
      class="min-h-screen transition-[margin-left] duration-150 ease-out"
      :class="ui.sidebarCollapsed ? 'ml-16' : 'ml-56'"
    >
      <RouterView />
    </main>
  </div>
</template>
