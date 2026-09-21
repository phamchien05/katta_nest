import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { changePassword, deleteAccount, updateProfile } from '../../api/account'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'

const input = 'w-full rounded-xl border-gray-300 focus:border-katta-primary focus:ring-katta-primary text-sm'
const label = 'block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5'
const button = 'px-6 py-3 rounded-xl text-sm font-semibold bg-katta-primary text-white hover:bg-purple-700 transition disabled:opacity-60'

type Notice = { ok: boolean; text: string } | null

// Hồ sơ cá nhân: đổi tên/email, đổi mật khẩu, xoá tài khoản
export function ProfilePage() {
  const { t } = useTranslation()
  return (
    <div className="max-w-3xl mx-auto mt-6 space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t('profile.page_title')}</h1>
        <p className="text-gray-400 mt-1">{t('profile.page_subtitle')}</p>
      </div>
      <InfoForm />
      <PasswordForm />
      <DeleteForm />
    </div>
  )
}

function Card({ title, hint, children, danger }: { title: string; hint: string; children: ReactNode; danger?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm p-6 ${danger ? 'border border-rose-100' : ''}`}>
      <h2 className={`font-semibold ${danger ? 'text-katta-accent' : 'text-gray-800'}`}>{title}</h2>
      <p className="text-xs text-gray-400 mt-1 mb-4">{hint}</p>
      {children}
    </div>
  )
}

function NoticeText({ notice }: { notice: Notice }) {
  return notice ? <span className={`text-sm ${notice.ok ? 'text-emerald-600' : 'text-katta-accent'}`}>{notice.text}</span> : null
}

function InfoForm() {
  const { t } = useTranslation()
  const { user, updateUser } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      const saved = await updateProfile(name, email)
      updateUser(saved)
      setName(saved.name)
      setEmail(saved.email)
      setNotice({ ok: true, text: t('profile.saved') })
    } catch (err) {
      setNotice({ ok: false, text: err instanceof ApiError ? err.message : t('profile.save_failed') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={t('profile.info_title')} hint={t('profile.info_hint')}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div>
          <label htmlFor="p-name" className={label}>
            {t('auth.name')}
          </label>
          <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} className={input} />
        </div>
        <div>
          <label htmlFor="p-email" className={label}>
            {t('auth.email')}
          </label>
          <input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} className={input} />
        </div>
        <div className="flex items-center gap-4">
          <button type="submit" disabled={busy} className={button}>
            {t('settings.save_button')}
          </button>
          <NoticeText notice={notice} />
        </div>
      </form>
    </Card>
  )
}

function PasswordForm() {
  const { t } = useTranslation()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setNotice({ ok: true, text: t('profile.saved') })
    } catch (err) {
      setNotice({ ok: false, text: err instanceof ApiError ? err.message : t('profile.save_failed') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={t('profile.password_title')} hint={t('profile.password_hint')}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div>
          <label htmlFor="p-current" className={label}>
            {t('profile.current_password')}
          </label>
          <input id="p-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required className={input} />
        </div>
        <div>
          <label htmlFor="p-new" className={label}>
            {t('profile.new_password')}
          </label>
          <input id="p-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} maxLength={72} className={input} />
          <p className="text-xs text-gray-400 mt-1">{t('auth.password_hint')}</p>
        </div>
        <div className="flex items-center gap-4">
          <button type="submit" disabled={busy} className={button}>
            {t('settings.save_button')}
          </button>
          <NoticeText notice={notice} />
        </div>
      </form>
    </Card>
  )
}

function DeleteForm() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!window.confirm(t('profile.delete_confirm'))) return
    setBusy(true)
    setError(null)
    try {
      await deleteAccount(password)
      await logout().catch(() => undefined) // cookie đã bị server xoá; chỉ cần đưa giao diện về trạng thái chưa đăng nhập
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('profile.delete_failed'))
      setBusy(false)
    }
  }

  return (
    <Card title={t('profile.delete_title')} hint={t('profile.delete_hint')} danger>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="px-6 py-3 rounded-xl text-sm font-semibold bg-katta-accent text-white hover:bg-rose-700 transition">
          {t('profile.delete_button')}
        </button>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <div>
            <label htmlFor="p-del" className={label}>
              {t('auth.password')}
            </label>
            <input id="p-del" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className={input} />
          </div>
          {error && <p className="text-sm text-katta-accent">{error}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy || !password} className="px-6 py-3 rounded-xl text-sm font-semibold bg-katta-accent text-white hover:bg-rose-700 transition disabled:opacity-60">
              {t('profile.delete_confirm_button')}
            </button>
            <button type="button" onClick={() => { setOpen(false); setPassword(''); setError(null) }} className="px-4 py-3 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">
              {t('profile.cancel')}
            </button>
          </div>
        </form>
      )}
    </Card>
  )
}
