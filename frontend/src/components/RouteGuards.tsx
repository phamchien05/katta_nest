import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function Splash() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-katta-bg text-gray-400 text-sm">
      {t('auth.checking_session')}
    </div>
  )
}

// Route cần đăng nhập (tương đương middleware 'auth' của Laravel): chưa đăng nhập -> về /login,
// nhớ trang định vào để quay lại sau khi đăng nhập xong.
export function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()

  if (user === undefined) return <Splash />
  if (user === null) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

// Trang chỉ dành cho khách (login/register): đã đăng nhập rồi thì không cần vào nữa -> về trang chủ
export function GuestOnly() {
  const { user } = useAuth()

  if (user === undefined) return <Splash />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}
