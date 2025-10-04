import { useI18n } from 'vue-i18n'

export const useI18nTranslations = () => {
  const { t, te, tm } = useI18n()

  return {
    t,
    te,
    tm,
  }
}
