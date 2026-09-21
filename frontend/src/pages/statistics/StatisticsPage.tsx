import { Book, Bookmark, Clock, Flame, GraduationCap, Hourglass, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchStatistics, type StatisticsOverview } from '../../api/statistics'
import { formatDuration } from '../../lib/time'
import { Calendar } from './Calendar'

// Ngưỡng màu độ chính xác - cùng quy ước với trang Tiến trình
const barColor = (p: number) => (p >= 70 ? 'bg-emerald-500' : p >= 40 ? 'bg-amber-500' : 'bg-katta-accent')
const textColor = (p: number) => (p >= 70 ? 'text-emerald-600' : p >= 40 ? 'text-amber-600' : 'text-katta-accent')

// Thống kê: 6 ô số liệu, lịch ngày học, từ vựng theo cấp độ, độ chính xác từng module
export function StatisticsPage() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<StatisticsOverview | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchStatistics()
      .then((d) => !cancelled && setStats(d))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  if (failed) return <p className="mt-6 text-katta-accent">{t('statistics.load_failed')}</p>
  if (!stats) return <p className="mt-6 text-gray-400">{t('statistics.loading')}</p>

  const tiles: { key: string; icon: LucideIcon; value: string | number }[] = [
    { key: 'streak', icon: Flame, value: stats.streak },
    { key: 'sessions', icon: GraduationCap, value: stats.sessionsCompleted },
    { key: 'words_mastered', icon: Book, value: stats.vocabMastered },
    { key: 'reading', icon: Bookmark, value: stats.articlesRead },
    { key: 'today', icon: Clock, value: `${stats.minutesToday}m` },
    { key: 'total', icon: Hourglass, value: formatDuration(stats.totalStudySeconds) },
  ]

  return (
    <div className="max-w-4xl mx-auto mt-6">
      <h1 className="text-2xl font-bold text-gray-800">{t('statistics.page_title')}</h1>
      <p className="text-gray-400 mt-1">{t('statistics.page_subtitle')}</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
        {tiles.map(({ key, icon: Icon, value }) => (
          <div key={key} className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-gray-400 uppercase">
              <Icon className="w-3.5 h-3.5" />
              {t(`statistics.tile_${key}`)}
            </div>
            <p className="text-3xl font-semibold text-gray-800 mt-2">{value}</p>
            <p className="text-xs text-gray-400 mt-1">{t(`statistics.tile_${key}_caption`)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Calendar today={stats.today} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 mt-6">
        <h2 className="font-semibold text-gray-800 mb-4">{t('statistics.vocabulary_by_level_title')}</h2>
        {stats.vocabByLevel.length === 0 ? (
          <p className="text-sm text-gray-400">{t('statistics.vocabulary_by_level_empty')}</p>
        ) : (
          <div className="space-y-4">
            {stats.vocabByLevel.map((row) => (
              <div key={row.level}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{row.level}</span>
                  <span className="text-gray-500">{t('statistics.words_mastered_count', { mastered: row.mastered, total: row.total })}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-katta-primary rounded-full" style={{ width: `${Math.min(100, Math.round((row.mastered / Math.max(1, row.total)) * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 mt-6 mb-10">
        <h2 className="font-semibold text-gray-800 mb-4">{t('statistics.accuracy_title')}</h2>
        {stats.accuracy.length === 0 ? (
          <p className="text-sm text-gray-400">{t('statistics.accuracy_empty')}</p>
        ) : (
          <div className="space-y-4">
            {stats.accuracy.map((row) => (
              <div key={row.type}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{t(`statistics.type_${row.type}`)}</span>
                  <span className={`font-semibold ${textColor(row.percent)}`}>{row.percent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${barColor(row.percent)}`} style={{ width: `${row.percent}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{t('statistics.accuracy_sessions', { count: row.sessions })}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
