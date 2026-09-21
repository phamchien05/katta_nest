import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError } from '../api/client'
import { applyLanguage, hasSavedLanguage } from '../i18n'

export interface User {
  id: number
  name: string
  email: string
  locale: string | null
  hasOwnGeminiKey: boolean
}

interface AuthState {
  /** undefined = đang kiểm tra phiên đăng nhập; null = chưa đăng nhập */
  user: User | null | undefined
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Cập nhật thông tin user đang đăng nhập (sau khi đổi tên/email/cài đặt) */
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  // Khôi phục phiên khi mở/tải lại trang: cookie đăng nhập có sẵn thì /auth/me trả về user
  useEffect(() => {
    api<User>('/auth/me')
      .then(setUser)
      .catch((e: unknown) => {
        if (!(e instanceof ApiError) || e.status !== 401) console.error(e)
        setUser(null)
      })
  }, [])

  // Ngôn ngữ đã lưu trong tài khoản chỉ áp dụng khi máy này chưa từng tự chọn (giống thứ tự ưu tiên ở bản Laravel)
  useEffect(() => {
    if (user?.locale && !hasSavedLanguage()) applyLanguage(user.locale)
  }, [user])

  const login = useCallback(async (email: string, password: string) => {
    setUser(await api<User>('/auth/login', { body: { email, password } }))
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    setUser(await api<User>('/auth/register', { body: { name, email, password } }))
  }, [])

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  const updateUser = useCallback((next: User) => setUser(next), [])

  const value = useMemo(() => ({ user, login, register, logout, updateUser }), [user, login, register, logout, updateUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải được dùng bên trong <AuthProvider>')
  return ctx
}
