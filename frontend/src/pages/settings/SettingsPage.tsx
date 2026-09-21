import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { fetchSettings, removeGeminiKey, saveSettings } from '../../api/account'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { applyLanguage } from '../../i18n'

// Cài đặt: ngôn ngữ hiển thị (nhớ trong tài khoản) và API key Gemini riêng
export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { user, updateUser } = useAuth()
  const [locale, setLocale] = useState<'en' | 'vi'>(i18n.language === 'vi' ? 'vi' : 'en')
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSettings()
      .then((s) => {
        if (cancelled) return
        setHasKey(s.hasOwnGeminiKey)
        if (s.locale === 'en' || s.locale === 'vi') setLocale(s.locale)
      })
      .catch(() => !cancelled && setHasKey(false))
    return () => {
      cancelled = true
    }
  }, [])

  const errorText = (e: unknown) => (e instanceof ApiError ? e.message : t('settings.save_failed'))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const saved = await saveSettings(locale, apiKey.trim())
      setHasKey(saved.hasOwnGeminiKey)
      setApiKey('')
      applyLanguage(locale) // áp dụng ngay cho cả giao diện, giống nút EN/VI ở header
      if (user) updateUser({ ...user, locale, hasOwnGeminiKey: saved.hasOwnGeminiKey })
      setMessage({ ok: true, text: t('settings.saved') })
    } catch (err) {
      setMessage({ ok: false, text: errorText(err) })
    } finally {
      setSaving(false)
    }
  }

  const removeKey = async () => {
    if (!window.confirm(`${t('settings.remove_key_button')}?`)) return
    setMessage(null)
    try {
      const saved = await removeGeminiKey()
      setHasKey(saved.hasOwnGeminiKey)
      if (user) updateUser({ ...user, hasOwnGeminiKey: saved.hasOwnGeminiKey })
      setMessage({ ok: true, text: t('settings.saved') })
    } catch (err) {
      setMessage({ ok: false, text: errorText(err) })
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-6">
      <h1 className="text-2xl font-bold text-gray-800">{t('settings.page_title')}</h1>
      <p className="text-gray-400 mt-1">{t('settings.page_subtitle')}</p>
      <p className="text-sm text-gray-500 mt-3">
        {t('settings.profile_hint')}{' '}
        <Link to="/profile" className="text-katta-primary font-semibold hover:underline">
          {t('settings.profile_link_text')}
        </Link>
      </p>

      <form onSubmit={(e) => void save(e)} className="space-y-6 mt-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-800">{t('settings.section_language')}</h2>
          <p className="text-xs text-gray-400 mt-1 mb-4">{t('settings.language_hint')}</p>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            {(['en', 'vi'] as const).map((value) => (
              <label
                key={value}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition font-semibold text-sm ${
                  locale === value ? 'border-katta-primary bg-katta-bg text-katta-primary' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <input type="radio" name="locale" className="hidden" checked={locale === value} onChange={() => setLocale(value)} />
                {t(`settings.lang_${value}`)}
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-gray-800">{t('settings.section_api_key')}</h2>
            {hasKey !== null && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${hasKey ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {hasKey ? t('settings.api_key_saved_badge') : t('settings.api_key_none_badge')}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1 mb-4">{t('settings.api_key_hint')}</p>

          <label htmlFor="gemini-key" className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
            {t('settings.api_key_label')}
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="gemini-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              maxLength={255}
              placeholder={hasKey ? t('settings.api_key_placeholder_saved') : t('settings.api_key_placeholder_new')}
              className="flex-1 rounded-xl border-gray-300 focus:border-katta-primary focus:ring-katta-primary text-sm"
            />
            {hasKey && (
              <button
                type="button"
                onClick={() => void removeKey()}
                className="shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold border border-katta-accent text-katta-accent hover:bg-rose-50 transition"
              >
                {t('settings.remove_key_button')}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving} className="px-6 py-3 rounded-xl text-sm font-semibold bg-katta-primary text-white hover:bg-purple-700 transition disabled:opacity-60">
            {t('settings.save_button')}
          </button>
          {message && <span className={`text-sm ${message.ok ? 'text-emerald-600' : 'text-katta-accent'}`}>{message.text}</span>}
        </div>
      </form>
    </div>
  )
}
