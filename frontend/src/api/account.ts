import { api } from './client'
import type { User } from '../auth/AuthContext'

export interface Settings {
  locale: string | null
  hasOwnGeminiKey: boolean
}

export const fetchSettings = () => api<Settings>('/settings')
export const saveSettings = (locale: 'en' | 'vi', geminiApiKey: string) =>
  api<Settings>('/settings', { method: 'PUT', body: geminiApiKey ? { locale, geminiApiKey } : { locale } })
export const removeGeminiKey = () => api<Settings>('/settings/gemini-key', { method: 'DELETE' })

export const updateProfile = (name: string, email: string) => api<User>('/account/profile', { method: 'PATCH', body: { name, email } })
export const changePassword = (currentPassword: string, password: string) =>
  api('/account/password', { method: 'PUT', body: { currentPassword, password } })
export const deleteAccount = (password: string) => api('/account', { method: 'DELETE', body: { password } })
