import { Bell, LogOut, User as UserIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { findNavItem, HEADER_TAGLINES } from '../config/nav'
import { applyLanguage } from '../i18n'
import { Avatar } from './Avatar'

// "Thứ hai, ngày 21 tháng 9" (vi) / "Monday, September 21" (en)
function formatToday(lang: string): string {
  const now = new Date()
  if (lang === 'vi') {
    const weekday = new Intl.DateTimeFormat('vi', { weekday: 'long' }).format(now)
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ngày ${now.getDate()} tháng ${now.getMonth() + 1}`
  }
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(now)
}

// Câu nhắn ngẫu nhiên, chọn 1 lần mỗi lần tải trang (giống bản Laravel), không đổi khi re-render
const TAGLINE = HEADER_TAGLINES[Math.floor(Math.random() * HEADER_TAGLINES.length)]

export function Header() {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [bellOpen, setBellOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)

  const current = findNavItem(pathname)
  const Icon = current?.icon
  const lang = i18n.language === 'vi' ? 'vi' : 'en'

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-6 lg:px-10 py-5">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="w-5 h-5 text-katta-primary shrink-0" />}
        <h1 className="text-lg font-semibold text-gray-800 truncate">{current ? t(`nav.${current.key}`) : 'Katta'}</h1>
        <span className="text-sm text-gray-400 hidden sm:inline">· {formatToday(lang)}</span>
      </div>

      <p className="hidden md:block flex-1 text-center text-sm italic font-semibold text-katta-primary truncate px-4">
        {TAGLINE}
      </p>

      <div className="flex items-center gap-4 shrink-0">
        <button
          type="button"
          onClick={() => applyLanguage(lang === 'vi' ? 'en' : 'vi')}
          className="text-xs font-bold px-2.5 py-1 rounded-full border border-katta-primary/30 text-katta-primary hover:bg-katta-primary/10 transition"
        >
          {lang === 'vi' ? 'EN' : 'VI'}
        </button>

        <div className="relative">
          <button
            type="button"
            aria-label={t('nav.notifications')}
            onClick={() => setBellOpen((o) => !o)}
            className="relative text-gray-400 hover:text-katta-primary transition"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-katta-accent rounded-full" />
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-lg border border-gray-100 p-4 text-sm text-gray-500 z-50">
              {t('header.no_notifications')}
            </div>
          )}
        </div>

        <div className="relative">
          <button type="button" onClick={() => setUserOpen((o) => !o)} aria-label={t('nav.profile')}>
            <Avatar name={user?.name ?? '?'} />
          </button>
          {userOpen && (
            <div className="absolute right-0 mt-3 w-48 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-50">
              <button
                type="button"
                onClick={() => {
                  setUserOpen(false)
                  navigate('/profile')
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-katta-bg"
              >
                <UserIcon className="w-4 h-4" /> {t('nav.profile')}
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-katta-accent hover:bg-katta-bg"
              >
                <LogOut className="w-4 h-4" /> {t('nav.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
