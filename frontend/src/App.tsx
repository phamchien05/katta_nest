import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { GuestLayout } from './components/GuestLayout'
import { GuestOnly, RequireAuth } from './components/RouteGuards'
import { NAV_ITEMS } from './config/nav'
import { AuthForm } from './pages/AuthForm'
import { Home } from './pages/Home'
import { Placeholder } from './pages/Placeholder'

export default function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route element={<GuestLayout />}>
          <Route path="/login" element={<AuthForm mode="login" />} />
          <Route path="/register" element={<AuthForm mode="register" />} />
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          {/* Các module còn lại: giữ chỗ cho tới khi được chuyển từng cái sang hệ thống mới */}
          {NAV_ITEMS.filter((item) => item.path !== '/').map((item) => (
            <Route key={item.path} path={`${item.path}/*`} element={<Placeholder />} />
          ))}
        </Route>
      </Route>
    </Routes>
  )
}
