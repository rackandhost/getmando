<script setup lang="ts">
import { MENU } from '@/data/menu'

import { useI18nTranslations } from '@/composables/useI18nTranslations'

import MenuItem from '@/components/MenuItem/MenuItem.vue'

const { t } = useI18nTranslations()
</script>

<template>
  <aside class="py-4 px-8 w-72 h-screen flex flex-col gap-2">
    <MenuItem
      v-for="{ disabled, name, pathName, icon } in MENU"
      :key="name"
      :disabled
      :pathName
      :icon
    >
      {{ t(name) }}
    </MenuItem>
  </aside>
</template>
