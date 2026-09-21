import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'

// Dùng chung cho Đăng nhập và Đăng ký (khác nhau đúng 1 trường "Tên" và vài nhãn)
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useTranslation()
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const isRegister = mode === 'register'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErrors([])
    setBusy(true)
    try {
      if (isRegister) await register(name, email, password)
      else await login(email, password)
      void navigate(from, { replace: true })
    } catch (err) {
      setErrors(err instanceof ApiError && err.messages.length > 0 ? err.messages : ['Something went wrong.'])
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'block w-full mt-1 rounded-xl border-gray-300 focus:border-katta-primary focus:ring-katta-primary'
  const labelClass = 'block text-sm font-medium text-gray-700'

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
      <h2 className="text-xl font-bold text-gray-800">{t(isRegister ? 'auth.register_title' : 'auth.login_title')}</h2>

      {errors.length > 0 && (
        <ul role="alert" className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-katta-accent space-y-1">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {isRegister && (
        <div>
          <label htmlFor="name" className={labelClass}>{t('auth.name')}</label>
          <input id="name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
      )}

      <div>
        <label htmlFor="email" className={labelClass}>{t('auth.email')}</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>{t('auth.password')}</label>
        <input
          id="password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        {isRegister && <p className="mt-1 text-xs text-gray-400">{t('auth.password_hint')}</p>}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full py-2.5 rounded-xl bg-katta-primary text-white text-sm font-semibold hover:bg-purple-700 transition disabled:opacity-60"
      >
        {busy ? t('auth.working') : t(isRegister ? 'auth.register_button' : 'auth.login_button')}
      </button>

      <p className="text-sm text-gray-500 text-center">
        {t(isRegister ? 'auth.have_account' : 'auth.no_account')}{' '}
        <Link to={isRegister ? '/login' : '/register'} className="font-semibold text-katta-primary hover:underline">
          {t(isRegister ? 'auth.login_button' : 'auth.register_button')}
        </Link>
      </p>
    </form>
  )
}
