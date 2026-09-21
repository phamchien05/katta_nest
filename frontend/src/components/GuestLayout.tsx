import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { Logo } from './Logo'

// Khung cho trang đăng nhập/đăng ký: nền gradient tím giống banner trang chủ, thẻ trắng chứa form
export function GuestLayout() {
  const { t } = useTranslation()

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10 overflow-hidden bg-linear-to-br from-indigo-900 to-purple-600">
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center gap-3 mb-6">
        <Logo className="h-20" />
        <span className="text-sm text-white/70">{t('auth.tagline')}</span>
      </div>

      <div className="relative z-10 w-full sm:max-w-md px-6 py-8 bg-white shadow-xl overflow-hidden rounded-2xl">
        <Outlet />
      </div>
    </div>
  )
}
