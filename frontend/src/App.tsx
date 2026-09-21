import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { GuestLayout } from './components/GuestLayout'
import { GuestOnly, RequireAuth } from './components/RouteGuards'
import { NAV_ITEMS } from './config/nav'
import { AuthForm } from './pages/AuthForm'
import { Home } from './pages/Home'
import { Placeholder } from './pages/Placeholder'
import { GrammarHome } from './pages/grammar/GrammarHome'
import { GrammarPractice } from './pages/grammar/GrammarPractice'
import { GrammarQuiz } from './pages/grammar/GrammarQuiz'
import { GrammarTheory } from './pages/grammar/GrammarTheory'
import { ListeningHome } from './pages/listening/ListeningHome'
import { ListeningGeneralRedirect, ListeningPractice } from './pages/listening/ListeningPractice'
import { ProgressPage } from './pages/progress/ProgressPage'
import { ReadingHome } from './pages/reading/ReadingHome'
import { ReadingGeneralRedirect, ReadingPractice } from './pages/reading/ReadingPractice'
import { StatisticsPage } from './pages/statistics/StatisticsPage'
import { TranslateHome } from './pages/translate/TranslateHome'
import { TranslatePractice } from './pages/translate/TranslatePractice'
import { VocabularyLevels } from './pages/vocabulary/VocabularyLevels'
import { VocabularyQuiz } from './pages/vocabulary/VocabularyQuiz'

// Các module đã chuyển xong (có trang thật) - phần còn lại vẫn là trang giữ chỗ
const MIGRATED_PATHS = new Set(['/', '/vocabulary', '/translate', '/reading', '/grammar', '/listening', '/progress', '/statistics'])

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
          <Route path="/grammar" element={<GrammarHome />} />
          <Route path="/grammar/theory" element={<GrammarTheory />} />
          <Route path="/grammar/theory/:slug" element={<GrammarTheory />} />
          <Route path="/grammar/practice" element={<GrammarPractice />} />
          <Route path="/grammar/practice/set/:id" element={<GrammarQuiz />} />
          <Route path="/listening" element={<ListeningHome />} />
          <Route path="/listening/general/:level" element={<ListeningGeneralRedirect />} />
          <Route path="/listening/:id" element={<ListeningPractice />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/reading" element={<ReadingHome />} />
          <Route path="/reading/general/:level" element={<ReadingGeneralRedirect />} />
          <Route path="/reading/:id" element={<ReadingPractice />} />
          {/* Các module còn lại: giữ chỗ cho tới khi được chuyển từng cái sang hệ thống mới */}
          {NAV_ITEMS.filter((item) => !MIGRATED_PATHS.has(item.path)).map((item) => (
            <Route key={item.path} path={`${item.path}/*`} element={<Placeholder />} />
          ))}
        </Route>
      </Route>
    </Routes>
  )
}
