import { createI18n } from 'vue-i18n'

export const i18n = createI18n({
  locale: 'es',
  fallbackLocale: 'en',
  messages: {
    en: {
      menu: {
        dashboard: 'Dashboard',
        services: 'Services',
        settings: 'Settings',
      },
    },
    es: {
      menu: {
        dashboard: 'Dashboard',
        services: 'Servicios',
        settings: 'Ajustes',
      },
    },
  },
})
