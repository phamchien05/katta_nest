import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'

// Tạm thời chỉ có lời chào - trang chủ đầy đủ (banner, streak, lưới tính năng...) sẽ chuyển ở bước sau
export function Home() {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <div className="max-w-2xl mx-auto mt-10 bg-linear-to-br from-indigo-900 to-katta-primary text-white rounded-3xl p-8 shadow-sm">
      <h2 className="text-2xl font-bold">{t('home.welcome', { name: user?.name })}</h2>
    </div>
  )
}
