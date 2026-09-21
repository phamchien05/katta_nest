import { Repeat } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { fetchHistory, TRANSLATE_LEVELS, type Direction, type HistoryItem } from '../../api/translate'
import { LevelGrid } from '../../components/LevelGrid'
import { formatRelative } from '../../lib/time'
import { useStoredChoice } from '../../lib/storage'
import { DIRECTION_KEY, DIRECTIONS, directionLabel, scoreTone } from './shared'

// Trang Dịch: tab "Chọn cấp độ" (kèm đổi chiều dịch) và tab "Đã dịch" (lịch sử các lần nộp bài)
export function TranslateHome() {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<'levels' | 'history'>('levels')
  const [direction, setDirection] = useStoredChoice<Direction>(DIRECTION_KEY, DIRECTIONS, 'en_vi')
  const [history, setHistory] = useState<HistoryItem[] | null>(null)
  const [now] = useState(() => new Date())
  const lang = i18n.language === 'vi' ? 'vi' : 'en'

  useEffect(() => {
    let cancelled = false
    fetchHistory()
      .then((data) => !cancelled && setHistory(data.items))
      .catch(() => !cancelled && setHistory([]))
    return () => {
      cancelled = true
    }
  }, [])

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-semibold transition ${active ? 'bg-katta-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`

  return (
    <div className="max-w-4xl mx-auto mt-6">
      <div className="flex items-center justify-center gap-2 mb-6">
        <button type="button" onClick={() => setTab('levels')} className={tabClass(tab === 'levels')}>
          {t('translate.tab_levels')}
        </button>
        <button type="button" onClick={() => setTab('history')} className={tabClass(tab === 'history')}>
          {t('translate.tab_history')} ({history?.length ?? 0})
        </button>
      </div>

      {tab === 'levels' ? (
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">{t('translate.select_level_title')}</h1>
          <p className="text-gray-400 mt-1">{t('translate.select_level_subtitle')}</p>

          {/* Chiều dịch - bấm để đổi qua lại EN <-> VI */}
          <div className="flex items-center justify-center gap-3 mt-5">
            <span className="text-xs font-bold tracking-widest text-gray-400">{t('translate.mode_label')}</span>
            <button
              type="button"
              onClick={() => setDirection(direction === 'en_vi' ? 'vi_en' : 'en_vi')}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-sm text-sm font-semibold text-gray-700 hover:shadow-md transition"
            >
              {directionLabel(direction)}
              <Repeat className="w-3.5 h-3.5 text-katta-primary" />
            </button>
          </div>

          <LevelGrid
            levels={TRANSLATE_LEVELS}
            hrefFor={(level) => `/translate/${level}`}
            subtitleFor={(level) => t('translate.level_subtitle', { level })}
            tone="blue"
          />
        </div>
      ) : history && history.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">{t('translate.history_empty')}</div>
      ) : (
        <div className="space-y-3">
          {history?.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4">
              <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${scoreTone(item.score ?? 0).badge}`}>
                {item.score ?? '–'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">
                  {item.level} · {directionLabel(item.direction)} · {formatRelative(new Date(item.createdAt), now, lang)}
                </p>
                <p className="text-sm text-gray-700 truncate">{item.sourceText}</p>
              </div>
              <Link
                to={`/translate/${item.level}?passage=${item.passageId}&direction=${item.direction}`}
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-katta-bg text-katta-primary hover:bg-katta-primary hover:text-white transition"
              >
                {t('translate.retry')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
