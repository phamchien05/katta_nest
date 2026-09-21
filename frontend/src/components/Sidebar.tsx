import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { NAV_ITEMS } from '../config/nav'
import { Avatar } from './Avatar'
import { Logo } from './Logo'

// Sidebar trái (~300px), nền tím than đậm. onNavigate để đóng ngăn kéo trên mobile sau khi chọn mục.
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  return (
    <aside className="flex flex-col w-full lg:w-[300px] h-screen bg-katta-sidebar text-white/90">
      <NavLink to="/" onClick={onNavigate} className="flex items-center px-6 py-6 shrink-0">
        <Logo className="h-10" />
      </NavLink>

      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        {NAV_ITEMS.map(({ key, path, icon: Icon }) => (
          <NavLink
            key={key}
            to={path}
            end={path === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 mr-2 rounded-xl text-sm font-medium transition ${
                isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex-1 truncate">{t(`nav.${key}`)}</span>
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4 flex items-center gap-3 shrink-0">
        <Avatar name={user?.name ?? '?'} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{user?.name}</p>
          <p className="text-xs text-white/50 truncate">{user?.email}</p>
        </div>
        <button
          type="button"
          title={t('nav.logout')}
          onClick={() => void logout()}
          className="text-white/60 hover:text-white transition"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </aside>
  )
}
