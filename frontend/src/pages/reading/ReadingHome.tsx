import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  fetchPassages,
  fetchReadingHistory,
  GENERAL_LEVELS,
  TOPICS,
  type PassageSummary,
  type ReadingHistoryItem,
} from '../../api/reading'
import { formatRelative } from '../../lib/time'
import { scoreTone } from '../translate/shared'
import { styleFor } from './topics'

// Trang Đọc hiểu: tab "Tất cả" (nhóm theo chủ đề, có tìm kiếm + lọc) và tab "Đã đọc"
export function ReadingHome() {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<'all' | 'history'>('all')
  const [topicFilter, setTopicFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [passages, setPassages] = useState<PassageSummary[] | null>(null)
  const [history, setHistory] = useState<ReadingHistoryItem[] | null>(null)
  const [now] = useState(() => new Date())
  const lang = i18n.language === 'vi' ? 'vi' : 'en'

  useEffect(() => {
    let cancelled = false
    fetchPassages()
      .then((d) => !cancelled && setPassages(d.items))
      .catch(() => !cancelled && setPassages([]))
    fetchReadingHistory()
      .then((d) => !cancelled && setHistory(d.items))
      .catch(() => !cancelled && setHistory([]))
    return () => {
      cancelled = true
    }
  }, [])

  const byTopic = useMemo(() => {
    const q = query.trim().toLowerCase()
    const map = new Map<string, PassageSummary[]>()
    for (const p of passages ?? []) {
      if (q && !p.title.toLowerCase().includes(q)) continue
      map.set(p.topic, [...(map.get(p.topic) ?? []), p])
    }
    return map
  }, [passages, query])

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-semibold transition ${active ? 'bg-katta-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`
  const pillClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-semibold transition ${active ? 'bg-katta-sidebar text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`

  // Thứ tự nhóm theo TOPICS ("general" lên đầu); chỉ hiện chủ đề đang lọc
  const visibleTopics = TOPICS.filter(
    (topic) => (topicFilter === 'all' || topicFilter === topic) && (topic === 'general' || byTopic.has(topic)),
  )

  return (
    <div className="max-w-6xl mx-auto mt-6">
      <div className="flex items-center gap-2 mb-5">
        <button type="button" onClick={() => setTab('all')} className={tabClass(tab === 'all')}>
          {t('reading.tab_all')}
        </button>
        <button type="button" onClick={() => setTab('history')} className={tabClass(tab === 'history')}>
          {t('reading.tab_history')} ({history?.length ?? 0})
        </button>
      </div>

      {tab === 'all' ? (
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('nav.reading')}</h1>
          <p className="text-gray-400 mt-1">{t('reading.subtitle')}</p>

          <div className="relative mt-4 max-w-md">
            <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('reading.search_placeholder')}
              className="w-full pl-9 rounded-xl border-gray-200 text-sm focus:border-katta-primary focus:ring-katta-primary"
            />
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button type="button" onClick={() => setTopicFilter('all')} className={pillClass(topicFilter === 'all')}>
              {t('reading.tab_all')}
            </button>
            {TOPICS.map((topic) => (
              <button key={topic} type="button" onClick={() => setTopicFilter(topic)} className={pillClass(topicFilter === topic)}>
                {t(`reading.topics.${topic}`)}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-8">
            {visibleTopics.map((topic) => {
              const style = styleFor(topic)
              return (
                <div key={topic}>
                  <div className="flex items-center gap-2 mb-3">
                    <style.Icon className="w-4 h-4 text-gray-400" />
                    <h2 className="font-semibold text-gray-700">{t(`reading.topics.${topic}`)}</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {topic === 'general'
                      ? // Tổng quan: theo cấp độ CEFR, bấm vào sẽ random 1 bài của cấp đó (giống Từ vựng/Dịch)
                        GENERAL_LEVELS.map((level) => (
                          <Card key={level} to={`/reading/general/${level}`} topic={topic} title={`${level} Reading`} subtitle={level} />
                        ))
                      : byTopic.get(topic)?.map((p) => <Card key={p.id} to={`/reading/${p.id}`} topic={topic} title={p.title} />)}
                  </div>
                </div>
              )
            })}
            {passages && passages.length === 0 && topicFilter !== 'general' && (
              <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">{t('reading.no_results')}</div>
            )}
          </div>
        </div>
      ) : history && history.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">{t('reading.history_empty')}</div>
      ) : (
        <div className="space-y-3">
          {history?.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4">
              <div
                className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${
                  scoreTone(item.total ? (item.score / item.total) * 100 : 0).badge
                }`}
              >
                {item.score}/{item.total}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">
                  {t(`reading.topics.${item.topic}`, { defaultValue: item.topic })} · {formatRelative(new Date(item.createdAt), now, lang)}
                </p>
                <p className="text-sm text-gray-700 font-semibold truncate">{item.title}</p>
              </div>
              <Link
                to={`/reading/${item.passageId}`}
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-katta-bg text-katta-primary hover:bg-katta-primary hover:text-white transition"
              >
                {t('reading.retry')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Card({ to, topic, title, subtitle }: { to: string; topic: string; title: string; subtitle?: string }) {
  const { t } = useTranslation()
  const style = styleFor(topic)
  return (
    <Link to={to} className={`rounded-2xl border p-4 hover:shadow-md hover:-translate-y-0.5 transition ${style.bg}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${style.icon}`}>
        <style.Icon className="w-4 h-4" />
      </div>
      <p className="font-semibold text-gray-800 text-sm leading-snug">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      <p className="text-xs text-katta-primary font-semibold mt-3">{t('reading.start_reading')}</p>
    </Link>
  )
}
