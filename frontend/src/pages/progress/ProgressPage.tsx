import { CheckCircle, ChevronDown, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchProgress, fetchProgressDetail, PROGRESS_TYPES, type ProgressDetail, type ProgressEntry, type ProgressType } from '../../api/progress'
import { formatDateTime } from '../../lib/time'

// Màu badge theo loại - class viết nguyên văn để Tailwind quét thấy
const TYPE_STYLE: Record<ProgressType, string> = {
  vocabulary: 'bg-indigo-100 text-indigo-700',
  grammar: 'bg-rose-100 text-katta-accent',
  reading: 'bg-emerald-100 text-emerald-700',
  listening: 'bg-pink-100 text-pink-700',
  translate: 'bg-blue-100 text-blue-700',
}

const percentColor = (p: number) => (p >= 70 ? 'text-emerald-600' : p >= 40 ? 'text-amber-600' : 'text-katta-accent')
const keyOf = (e: ProgressEntry) => `${e.type}-${e.id}`

// Tiến trình: lịch sử làm bài của mọi module trong 1 danh sách, mỗi thẻ mở ra xem chi tiết từng câu
export function ProgressPage() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<ProgressEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState<'all' | ProgressType>('all')

  useEffect(() => {
    let cancelled = false
    fetchProgress()
      .then((d) => !cancelled && setEntries(d.items))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  if (failed) return <p className="mt-6 text-katta-accent">{t('progress.load_failed')}</p>

  const visible = (entries ?? []).filter((e) => tab === 'all' || e.type === tab)
  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-semibold transition ${active ? 'bg-katta-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`

  return (
    <div className="max-w-4xl mx-auto mt-6">
      <h1 className="text-2xl font-bold text-gray-800">{t('progress.page_title')}</h1>
      <p className="text-gray-400 mt-1">{t('progress.sessions_completed', { count: entries?.length ?? 0 })}</p>

      <div className="flex flex-wrap items-center gap-2 mt-5 mb-6">
        <button type="button" onClick={() => setTab('all')} className={tabClass(tab === 'all')}>
          {t('progress.tab_all')}
        </button>
        {PROGRESS_TYPES.map((type) => (
          <button key={type} type="button" onClick={() => setTab(type)} className={tabClass(tab === type)}>
            {t(`progress.type_${type}`)}
          </button>
        ))}
      </div>

      {entries === null ? (
        <p className="text-gray-400">{t('progress.loading')}</p>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">{t('progress.empty_state')}</div>
      ) : (
        <div className="space-y-3">
          {visible.map((entry) => (
            <EntryCard key={keyOf(entry)} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

function titleOf(entry: ProgressEntry, t: (key: string, opts?: Record<string, unknown>) => string): string {
  switch (entry.type) {
    case 'vocabulary':
      return `${entry.level} Vocabulary`
    case 'translate':
      return `${entry.level} Translation`
    case 'grammar':
      return t('grammar.quiz_title', { topic: t(`grammar.practice_topics.${entry.topicKey}.title`, { defaultValue: entry.topicKey }) })
    default:
      return entry.title ?? ''
  }
}

function EntryCard({ entry }: { entry: ProgressEntry }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<ProgressDetail | null>(null)
  const [error, setError] = useState(false)

  // Chi tiết chỉ tải khi mở rộng lần đầu
  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !detail && !error) {
      fetchProgressDetail(entry.type, entry.id)
        .then(setDetail)
        .catch(() => setError(true))
    }
  }

  const percent = Math.round((entry.score / (entry.total || 1)) * 100)

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button type="button" onClick={toggle} aria-expanded={open} className="w-full flex flex-wrap items-center gap-3 p-4 text-left">
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${TYPE_STYLE[entry.type]}`}>{t(`progress.type_${entry.type}`)}</span>
        <span className="flex-1 min-w-[140px] font-semibold text-gray-800 truncate">{titleOf(entry, t)}</span>
        <span className="text-right shrink-0">
          {entry.type !== 'translate' && (
            <span className="block text-sm text-gray-500">{t('progress.correct_count', { score: entry.score, total: entry.total })}</span>
          )}
          <span className="block text-xs text-gray-400">{entry.date ? formatDateTime(new Date(entry.date)) : ''}</span>
        </span>
        <span className={`shrink-0 font-bold text-lg ${percentColor(percent)}`}>{percent}%</span>
        <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-2">
          {error && <p className="text-sm text-katta-accent">{t('progress.detail_failed')}</p>}
          {!error && !detail && <p className="text-sm text-gray-400">{t('progress.loading')}</p>}
          {detail?.kind === 'qa' &&
            detail.items.map((item, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${item.isCorrect ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                {item.isCorrect ? (
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 shrink-0 mt-0.5 text-katta-accent" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{item.question}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('progress.your_answer')}{' '}
                    <span className={`font-medium ${item.isCorrect ? 'text-emerald-700' : 'text-katta-accent'}`}>
                      {item.userAnswer !== '' ? item.userAnswer : t('progress.no_answer')}
                    </span>
                  </p>
                  {!item.isCorrect && (
                    <p className="text-xs text-gray-500">
                      {t('progress.correct_answer_label')} <span className="text-emerald-700 font-medium">{item.correctAnswer}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          {detail?.kind === 'translate' && (
            <div className="space-y-3 text-sm">
              <Block label={t('progress.original_text')} text={detail.sourceText} />
              <Block label={t('progress.your_translation')} text={detail.userTranslation} />
              {detail.feedback && <Block label={t('progress.ai_feedback')} text={detail.feedback} muted />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Block({ label, text, muted }: { label: string; text: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`whitespace-pre-line ${muted ? 'text-gray-600' : 'text-gray-700'}`}>{text}</p>
    </div>
  )
}
