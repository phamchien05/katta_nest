import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { GuestLayout } from './components/GuestLayout'
import { GuestOnly, RequireAuth } from './components/RouteGuards'
import { NAV_ITEMS } from './config/nav'
import { AuthForm } from './pages/AuthForm'
import { Home } from './pages/Home'
import { Placeholder } from './pages/Placeholder'
import { TranslateHome } from './pages/translate/TranslateHome'
import { TranslatePractice } from './pages/translate/TranslatePractice'
import { VocabularyLevels } from './pages/vocabulary/VocabularyLevels'
import { VocabularyQuiz } from './pages/vocabulary/VocabularyQuiz'

// Các module đã chuyển xong (có trang thật) - phần còn lại vẫn là trang giữ chỗ
const MIGRATED_PATHS = new Set(['/', '/vocabulary', '/translate'])

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
          <Route path="/vocabulary" element={<VocabularyLevels />} />
          <Route path="/vocabulary/:level" element={<VocabularyQuiz />} />
          <Route path="/translate" element={<TranslateHome />} />
          <Route path="/translate/:level" element={<TranslatePractice />} />
          {/* Các module còn lại: giữ chỗ cho tới khi được chuyển từng cái sang hệ thống mới */}
          {NAV_ITEMS.filter((item) => !MIGRATED_PATHS.has(item.path)).map((item) => (
            <Route key={item.path} path={`${item.path}/*`} element={<Placeholder />} />
          ))}
        </Route>
      </Route>
    </Routes>
  )
}
