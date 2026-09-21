import { CircleHelp, Clock, LayoutGrid, List, Play, Puzzle, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { fetchSetHistory, PRACTICE_TOPICS, startPractice, type SetHistoryItem } from '../../api/grammar'
import { formatRelative } from '../../lib/time'
import { scoreTone } from '../translate/shared'

// Icon + màu theo từng chủ đề - class viết nguyên văn để Tailwind quét thấy
const STYLE: Record<string, { bg: string; icon: string; Icon: LucideIcon }> = {
  'parts-of-speech': { bg: 'bg-indigo-50 border-indigo-100', icon: 'bg-indigo-100 text-indigo-600', Icon: List },
  tenses: { bg: 'bg-sky-50 border-sky-100', icon: 'bg-sky-100 text-sky-600', Icon: Clock },
  'sentence-structures': { bg: 'bg-emerald-50 border-emerald-100', icon: 'bg-emerald-100 text-emerald-600', Icon: LayoutGrid },
  'question-forms': { bg: 'bg-amber-50 border-amber-100', icon: 'bg-amber-100 text-amber-600', Icon: CircleHelp },
  'common-structures': { bg: 'bg-rose-50 border-rose-100', icon: 'bg-rose-100 text-katta-accent', Icon: Puzzle },
}

// Phần B: chọn chủ đề luyện tập (5 thẻ) + tab "Các đề đã làm"
export function GrammarPractice() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'topics' | 'history'>('topics')
  const [history, setHistory] = useState<SetHistoryItem[] | null>(null)
  const [starting, setStarting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now] = useState(() => new Date())
  const lang = i18n.language === 'vi' ? 'vi' : 'en'

  useEffect(() => {
    let cancelled = false
    fetchSetHistory()
      .then((d) => !cancelled && setHistory(d.items))
      .catch(() => !cancelled && setHistory([]))
    return () => {
      cancelled = true
    }
  }, [])

  // Nhận 1 bộ đề từ kho (thường tức thì; kho rỗng thì server sinh mới nên có thể lâu hơn)
  const start = async (topicKey: string) => {
    if (starting) return
    setStarting(topicKey)
    setError(null)
    try {
      const { setId } = await startPractice(topicKey)
      navigate(`/grammar/practice/set/${setId}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('grammar.start_failed'))
      setStarting(null)
    }
  }

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-semibold transition ${active ? 'bg-katta-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`

  return (
    <div className="max-w-5xl mx-auto mt-6">
      <Link to="/grammar" className="text-sm text-gray-400 hover:text-katta-primary transition">
        {t('grammar.back_to_grammar')}
      </Link>
      <h1 className="text-2xl font-bold text-gray-800 mt-2">{t('grammar.practice_select_title')}</h1>
      <p className="text-gray-400 mt-1">{t('grammar.practice_select_subtitle')}</p>

      <div className="flex items-center gap-2 mt-5 mb-6">
        <button type="button" onClick={() => setTab('topics')} className={tabClass(tab === 'topics')}>
          {t('grammar.practice_tab_topics')}
        </button>
        <button type="button" onClick={() => setTab('history')} className={tabClass(tab === 'history')}>
          {t('grammar.practice_tab_history')} ({history?.length ?? 0})
        </button>
      </div>
      {error && <p className="text-sm text-katta-accent mb-4">{error}</p>}

      {tab === 'topics' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {PRACTICE_TOPICS.map((key) => {
            const style = STYLE[key]
            const busy = starting === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => void start(key)}
                disabled={starting !== null}
                className={`group relative text-left rounded-2xl border p-5 hover:shadow-md hover:-translate-y-0.5 transition disabled:opacity-60 disabled:hover:translate-y-0 ${style.bg}`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${style.icon}`}>
                    <style.Icon className="w-5 h-5" />
                  </div>
                  <span className="w-9 h-9 rounded-full bg-katta-bg text-katta-primary flex items-center justify-center group-hover:bg-katta-primary group-hover:text-white transition shrink-0">
                    <Play className="w-4 h-4 ml-0.5" />
                  </span>
                </div>
                <p className="font-bold text-base text-gray-800 mt-4 uppercase tracking-wide">{t(`grammar.practice_topics.${key}.title`)}</p>
                <p className="text-xs text-gray-400 mt-1 truncate">{busy ? t('grammar.preparing') : t(`grammar.practice_topics.${key}.desc`)}</p>
              </button>
            )
          })}
        </div>
      ) : history && history.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">{t('grammar.practice_history_empty')}</div>
      ) : (
        <div className="space-y-3">
          {history?.map((set) => (
            <div key={set.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4">
              <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${scoreTone(set.total ? ((set.score ?? 0) / set.total) * 100 : 0).badge}`}>
                {set.score}/{set.total}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">
                  {t(`grammar.practice_topics.${set.topicKey}.title`, { defaultValue: set.topicKey })}
                  {set.completedAt && ` · ${formatRelative(new Date(set.completedAt), now, lang)}`}
                </p>
                <p className="text-sm text-gray-700 font-semibold truncate">
                  {t('grammar.quiz_title', { topic: t(`grammar.practice_topics.${set.topicKey}.title`, { defaultValue: set.topicKey }) })}
                </p>
              </div>
              <Link
                to={`/grammar/practice/set/${set.id}`}
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-katta-bg text-katta-primary hover:bg-katta-primary hover:text-white transition"
              >
                {t('grammar.practice_review')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
