import {
  BookMarked,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  GraduationCap,
  Globe,
  Inbox,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { fetchHome, type HomeSummary } from '../api/home'
import { useAuth } from '../auth/AuthContext'
import { LineChart } from '../components/LineChart'
import { FEATURE_COLORS, HOME_FEATURES } from '../config/features'
import { NAV_ITEMS } from '../config/nav'
import { formatRelative, formatStudyTime, greetingFor } from '../lib/time'

const NAV_BY_KEY = new Map(NAV_ITEMS.map((item) => [item.key, item]))

// Trang chủ: banner chào hỏi, thống kê dịch thuật, lưới tính năng, biểu đồ 7 ngày, số liệu, hoạt động gần đây
export function Home() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [summary, setSummary] = useState<HomeSummary | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchHome()
      .then((data) => !cancelled && setSummary(data))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  const [now] = useState(() => new Date())
  const greeting = greetingFor(now.getHours())
  const lang = i18n.language === 'vi' ? 'vi' : 'en'

  if (failed) return <p className="mt-6 text-katta-accent">{t('home.load_failed')}</p>

  const stats: { icon: LucideIcon; value: string | number; label: string; color: string }[] = summary
    ? [
        { icon: Flame, value: summary.streak, label: t('home.stat_streak'), color: 'text-orange-500 bg-orange-50' },
        { icon: CheckCircle2, value: summary.vocabMastered, label: t('home.stat_vocab_mastered'), color: 'text-katta-primary bg-purple-50' },
        { icon: GraduationCap, value: summary.sessionsCompleted, label: t('home.stat_sessions_completed'), color: 'text-emerald-500 bg-emerald-50' },
        { icon: BookMarked, value: summary.articlesRead, label: t('home.stat_articles_read'), color: 'text-katta-accent bg-rose-50' },
        { icon: Clock, value: formatStudyTime(summary.totalStudySeconds), label: t('home.stat_total_time'), color: 'text-blue-500 bg-blue-50' },
      ]
    : []
  const activeThisWeek = !!summary && summary.weekly.some((d) => d.count > 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
      <div className="lg:col-span-2 space-y-6">
        {/* Banner chào hỏi */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-indigo-900 to-purple-600 text-white p-8 shadow-lg">
          <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2 w-44 h-44 rounded-full bg-linear-to-br from-purple-300 to-indigo-300 opacity-70" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <p className="text-xs font-semibold tracking-widest text-white/70 uppercase">{t(`home.greeting_${greeting}`)} ,</p>
              <h2 className="text-3xl font-bold mt-1">{user?.name} 👋</h2>
              <p className="text-white/80 mt-2">{t('home.subtitle')}</p>

              <div className="flex flex-wrap gap-3 mt-5">
                <span className="px-4 py-2 rounded-full bg-white/15 text-sm font-medium">🔥 {t('home.pill_streak', { n: summary?.streak ?? 0 })}</span>
                <span className="px-4 py-2 rounded-full bg-white/15 text-sm font-medium">🎓 {t('home.pill_sessions', { n: summary?.sessionsCompleted ?? 0 })}</span>
                <span className="px-4 py-2 rounded-full bg-white/15 text-sm font-medium">🕐 {t('home.pill_minutes', { n: summary?.minutesToday ?? 0 })}</span>
              </div>
            </div>

            {/* Khung nổi: thống kê dịch thuật */}
            <div className="relative z-10 w-full md:w-60 shrink-0 bg-white/95 text-gray-800 rounded-2xl shadow-xl p-4">
              <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-2">{t('home.translation_stats_title')}</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none">{summary?.translation.count ?? 0}</p>
                  <p className="text-xs text-gray-400">{t('home.translation_stats_count')}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
                <span>{t('home.translation_stats_avg')}</span>
                <span className="font-semibold text-gray-700">{t('home.translation_stats_points', { n: summary?.translation.averageScore ?? 0 })}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-100 mt-1.5 overflow-hidden">
                <div className="h-full bg-katta-primary" style={{ width: `${Math.min(100, summary?.translation.averageScore ?? 0)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Tất cả các tính năng */}
        <div>
          <h3 className="font-semibold text-gray-700 mb-3">{t('home.features_title')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {HOME_FEATURES.map(({ key, color }) => {
              const nav = NAV_BY_KEY.get(key)
              if (!nav) return null
              const Icon = nav.icon
              return (
                <Link key={key} to={nav.path} className="relative bg-white rounded-2xl shadow-sm p-5 transition hover:shadow-md hover:-translate-y-0.5">
                  <ChevronRight className="absolute top-4 right-4 w-4 h-4 text-gray-300" />
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${FEATURE_COLORS[color]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="font-semibold text-gray-800">{t(`nav.${key}`)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t(`home.feature_${key}_desc`)}</p>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Hành trình học tập của bạn */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-700">{t('home.journey_title')}</h3>
              <p className="text-xs text-gray-400">{t('home.journey_subtitle')}</p>
            </div>
            <span
              className={`text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full ${
                activeThisWeek ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {activeThisWeek ? t('home.badge_active') : t('home.badge_inactive')}
            </span>
          </div>
          <LineChart points={(summary?.weekly ?? []).map((d) => ({ label: d.day, value: d.count }))} />
        </div>

        {/* Hàng thống kê nhỏ */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {stats.map(({ icon: Icon, value, label, color }) => (
            <div key={label} className="bg-white rounded-2xl shadow-sm p-4">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-2 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-gray-800">{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cột phụ: hoạt động gần đây */}
      <div className="lg:col-span-1">
        <div className="lg:sticky lg:top-6 bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">{t('home.recent_activity_title')}</h3>
            <Link to="/progress" className="text-xs font-bold text-katta-primary hover:underline">
              {t('home.recent_activity_view_all')}
            </Link>
          </div>

          {summary && summary.recentActivity.length === 0 && (
            <div className="text-center py-8">
              <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{t('home.recent_activity_empty')}</p>
            </div>
          )}
          <ul className="space-y-3">
            {summary?.recentActivity.map((activity) => (
              <li key={`${activity.type}-${activity.completedAt}`} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-katta-bg text-katta-primary flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {NAV_BY_KEY.has(activity.type) ? t(`nav.${activity.type}`) : activity.type}
                  </p>
                  <p className="text-xs text-gray-400">{formatRelative(new Date(activity.completedAt), now, lang)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
