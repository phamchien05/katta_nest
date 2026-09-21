import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import vi from './locales/vi.json'

export const SUPPORTED_LANGUAGES = ['en', 'vi'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

const STORAGE_KEY = 'katta_lang'

function isLanguage(value: string | null | undefined): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language)
}

function readSavedLanguage(): Language | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return isLanguage(saved) ? saved : null
  } catch {
    return null // trình duyệt chặn localStorage (chế độ riêng tư...) - dùng mặc định
  }
}

export function hasSavedLanguage(): boolean {
  return readSavedLanguage() !== null
}

/** Đổi ngôn ngữ hiển thị và nhớ lại lựa chọn trên máy này. */
export function applyLanguage(lang: string): void {
  if (!isLanguage(lang)) return
  void i18n.changeLanguage(lang)
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // không lưu được thì thôi - lần sau về mặc định
  }
  document.documentElement.lang = lang
}

// Mặc định tiếng Anh (đúng quyết định của bản Laravel: APP_LOCALE=en) - ai muốn tiếng Việt tự bấm nút EN/VI.
const initial: Language = readSavedLanguage() ?? 'en'
document.documentElement.lang = initial

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, vi: { translation: vi } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React đã tự escape
})

export default i18n
