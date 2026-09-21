import { Menu } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Logo } from './Logo'
import { Sidebar } from './Sidebar'

// Khung chính sau đăng nhập: sidebar cố định bên trái (desktop) hoặc ngăn kéo (mobile) + header + nội dung
export function AppLayout() {
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-katta-bg">
      <div className="hidden lg:block sticky top-0 h-screen shrink-0">
        <Sidebar />
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-[280px] h-full">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 relative">
        {/* Watermark trang trí phía sau nội dung */}
        <div className="pointer-events-none select-none absolute inset-0 overflow-hidden opacity-[0.03]">
          <span className="absolute top-10 -left-10 text-[10rem] font-extrabold -rotate-12 text-katta-primary">Katta</span>
          <span className="absolute bottom-0 right-0 text-[9rem] font-extrabold rotate-[8deg] text-katta-primary">Anh</span>
        </div>

        <div className="relative z-10">
          <div className="lg:hidden flex items-center gap-3 px-4 pt-4">
            <button type="button" aria-label={t('header.open_menu')} onClick={() => setDrawerOpen(true)} className="text-katta-sidebar">
              <Menu className="w-6 h-6" />
            </button>
            <Logo className="h-8" />
          </div>

          <Header />

          <main className="px-6 lg:px-10 pb-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
