<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

interface IMenuItem {
  disabled?: boolean
  pathName: string
  target?: string
  icon?: Component
}

const { disabled, target = '_self', pathName } = defineProps<IMenuItem>()

const route = useRoute()

const menuItemClasses = computed(() => ({
  'hover:bg-primary-600 w-full py-2 px-4 rounded-xl flex items-center gap-2': true,
  'bg-primary-500': route.name === pathName,
  'cursor-not-allowed pointer-events-none opacity-20': disabled,
}))

const routerLinkTo = computed(() => ({
  name: pathName,
}))
</script>

<template>
  <RouterLink :class="menuItemClasses" :to="routerLinkTo" :target>
    <component v-if="icon" :is="icon" />

    <span>
      <slot />
    </span>
  </RouterLink>
</template>
