import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { formatRelative } from '../lib/time'
import { scoreTone } from '../pages/translate/shared'
import { styleFor } from './passageStyles'

export interface PassageSummary {
  id: number
  topic: string
  title: string
}

export interface PassageHistoryItem {
  id: number
  passageId: number
  topic: string
  title: string
  score: number
  total: number
  createdAt: string
}

interface Props {
  // Tiền tố đường dẫn và khoá i18n: 'reading' | 'listening'
  module: 'reading' | 'listening'
  // Thứ tự các chủ đề ("general" đầu tiên = mục lục theo cấp CEFR)
  topics: readonly string[]
  generalLevels: readonly string[]
  fetchPassages: () => Promise<{ items: PassageSummary[] }>
  fetchHistory: () => Promise<{ items: PassageHistoryItem[] }>
}

// Trang danh sách bài (Đọc hiểu / Nghe): tab "Tất cả" (nhóm theo chủ đề, tìm kiếm + lọc) và tab lịch sử
export function PassageBrowser({ module, topics, generalLevels, fetchPassages, fetchHistory }: Props) {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<'all' | 'history'>('all')
  const [topicFilter, setTopicFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [passages, setPassages] = useState<PassageSummary[] | null>(null)
  const [history, setHistory] = useState<PassageHistoryItem[] | null>(null)
  const [now] = useState(() => new Date())
  const lang = i18n.language === 'vi' ? 'vi' : 'en'

  useEffect(() => {
    let cancelled = false
    fetchPassages()
      .then((d) => !cancelled && setPassages(d.items))
      .catch(() => !cancelled && setPassages([]))
    fetchHistory()
      .then((d) => !cancelled && setHistory(d.items))
      .catch(() => !cancelled && setHistory([]))
    return () => {
      cancelled = true
    }
  }, [fetchPassages, fetchHistory])

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

  // Thứ tự nhóm theo `topics`; chỉ hiện chủ đề đang lọc ("general" luôn hiện vì là mục lục theo cấp độ)
  const visibleTopics = topics.filter(
    (topic) => (topicFilter === 'all' || topicFilter === topic) && (topic === 'general' || byTopic.has(topic)),
  )

  return (
    <div className="max-w-6xl mx-auto mt-6">
      <div className="flex items-center gap-2 mb-5">
        <button type="button" onClick={() => setTab('all')} className={tabClass(tab === 'all')}>
          {t(`${module}.tab_all`)}
        </button>
        <button type="button" onClick={() => setTab('history')} className={tabClass(tab === 'history')}>
          {t(`${module}.tab_history`)} ({history?.length ?? 0})
        </button>
      </div>

      {tab === 'all' ? (
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t(`nav.${module}`)}</h1>
          <p className="text-gray-400 mt-1">{t(`${module}.subtitle`)}</p>

          <div className="relative mt-4 max-w-md">
            <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(`${module}.search_placeholder`)}
              className="w-full pl-9 rounded-xl border-gray-200 text-sm focus:border-katta-primary focus:ring-katta-primary"
            />
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button type="button" onClick={() => setTopicFilter('all')} className={pillClass(topicFilter === 'all')}>
              {t(`${module}.tab_all`)}
            </button>
            {topics.map((topic) => (
              <button key={topic} type="button" onClick={() => setTopicFilter(topic)} className={pillClass(topicFilter === topic)}>
                {t(`${module}.topics.${topic}`)}
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
                    <h2 className="font-semibold text-gray-700">{t(`${module}.topics.${topic}`)}</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {topic === 'general'
                      ? // Tổng quan: theo cấp độ CEFR, bấm vào sẽ random 1 bài của cấp đó (giống Từ vựng/Dịch)
                        generalLevels.map((level) => (
                          <Card key={level} module={module} to={`/${module}/general/${level}`} topic={topic} title={`${level} ${t(`nav.${module}`)}`} subtitle={level} />
                        ))
                      : byTopic.get(topic)?.map((p) => <Card key={p.id} module={module} to={`/${module}/${p.id}`} topic={topic} title={p.title} />)}
                  </div>
                </div>
              )
            })}
            {passages && passages.length === 0 && topicFilter !== 'general' && (
              <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">{t(`${module}.no_results`)}</div>
            )}
          </div>
        </div>
      ) : history && history.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">{t(`${module}.history_empty`)}</div>
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
                  {t(`${module}.topics.${item.topic}`, { defaultValue: item.topic })} · {formatRelative(new Date(item.createdAt), now, lang)}
                </p>
                <p className="text-sm text-gray-700 font-semibold truncate">{item.title}</p>
              </div>
              <Link
                to={`/${module}/${item.passageId}`}
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-katta-bg text-katta-primary hover:bg-katta-primary hover:text-white transition"
              >
                {t(`${module}.retry`)}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Card({ module, to, topic, title, subtitle }: { module: string; to: string; topic: string; title: string; subtitle?: string }) {
  const { t } = useTranslation()
  const style = styleFor(topic)
  return (
    <Link to={to} className={`rounded-2xl border p-4 hover:shadow-md hover:-translate-y-0.5 transition ${style.bg}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${style.icon}`}>
        <style.Icon className="w-4 h-4" />
      </div>
      <p className="font-semibold text-gray-800 text-sm leading-snug">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      <p className="text-xs text-katta-primary font-semibold mt-3">{t(`${module}.start`)}</p>
    </Link>
  )
}
