<script setup lang="ts">
import AppHeader from '@/components/AppHeader/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar/AppSidebar.vue'
</script>

<template>
  <AppHeader />

  <main class="flex">
    <AppSidebar />

    <div class="pt-6 pr-8">
      <RouterView />
    </div>
  </main>
</template>

<style scoped></style>
