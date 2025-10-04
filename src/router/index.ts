import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      name: 'dashboard',
      path: '/',
      component: import('@/views/DashboardView/DashboardView.vue'),
    },
    {
      name: 'services',
      path: '/services',
      component: import('@/views/ServicesView/ServicesView.vue'),
    },
    {
      name: 'settings',
      path: '/settings',
      component: import('@/views/SettingsView/SettingsView.vue'),
    },
  ],
})

export default router
