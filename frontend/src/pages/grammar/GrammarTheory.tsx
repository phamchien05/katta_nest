import { ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { fetchTopic, fetchTopics, type TopicContent, type TopicNode } from '../../api/grammar'
import { ancestorIds, buildTree, defaultSlug, type TreeNode } from './tree'

// Phần A: /grammar/theory/:slug? - sidebar accordion phân cấp bên trái, nội dung bài học bên phải
export function GrammarTheory() {
  const { slug } = useParams()
  const { t, i18n } = useTranslation()
  const [flat, setFlat] = useState<TopicNode[] | null>(null)
  const [loaded, setLoaded] = useState<{ slug: string; topic: TopicContent | null } | null>(null)
  const [error, setError] = useState(false)
  // Người dùng tự mở/đóng nhóm: chưa đụng tới thì mặc định mở đúng đường dẫn tới bài đang xem
  const [manual, setManual] = useState<Record<number, boolean>>({})

  useEffect(() => {
    let cancelled = false
    fetchTopics()
      .then((d) => !cancelled && setFlat(d.topics))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [])

  const activeSlug = slug ?? (flat ? defaultSlug(flat) : undefined)

  useEffect(() => {
    if (!activeSlug) return
    let cancelled = false
    fetchTopic(activeSlug)
      .then((topic) => !cancelled && setLoaded({ slug: activeSlug, topic }))
      .catch(() => !cancelled && setLoaded({ slug: activeSlug, topic: null }))
    return () => {
      cancelled = true
    }
  }, [activeSlug])

  const tree = useMemo(() => (flat ? buildTree(flat) : []), [flat])
  const activePath = useMemo(() => (flat ? ancestorIds(flat, activeSlug) : new Set<number>()), [flat, activeSlug])

  if (error) return <p className="mt-6 text-katta-accent">{t('grammar.load_failed')}</p>

  const current = loaded && loaded.slug === activeSlug ? loaded : null
  const topic = current?.topic ?? null
  const isLoading = !!activeSlug && !current
  // Nội dung theo ngôn ngữ đang hiển thị; thiếu thì dùng bản còn lại
  const content = topic && (i18n.language === 'vi' ? (topic.contentVi ?? topic.contentEn) : (topic.contentEn ?? topic.contentVi))

  const renderNode = (node: TreeNode) => {
    const { topic: n, children } = node
    if (children.length === 0) {
      return (
        <li key={n.id}>
          <Link
            to={`/grammar/theory/${n.slug}`}
            className={`block px-3 py-2 rounded-lg text-sm transition ${
              n.slug === activeSlug ? 'bg-katta-bg text-katta-primary font-semibold' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {n.title}
          </Link>
        </li>
      )
    }
    const open = manual[n.id] ?? activePath.has(n.id)
    return (
      <li key={n.id}>
        <button
          type="button"
          onClick={() => setManual((m) => ({ ...m, [n.id]: !open }))}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition text-left"
          aria-expanded={open}
        >
          <span>{n.title}</span>
          <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && <ul className="pl-3 border-l border-gray-100 ml-3 mt-0.5 space-y-0.5">{children.map(renderNode)}</ul>}
      </li>
    )
  }

  return (
    <div className="max-w-6xl mx-auto mt-6">
      <Link to="/grammar" className="text-sm text-gray-400 hover:text-katta-primary transition">
        {t('grammar.back_to_grammar')}
      </Link>

      <div className="flex flex-col lg:flex-row gap-6 mt-4">
        <aside className="lg:w-[300px] shrink-0">
          <div className="bg-white rounded-2xl shadow-sm p-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] overflow-y-auto">
            <ul className="space-y-0.5">{tree.map(renderNode)}</ul>
          </div>
        </aside>

        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm p-6 lg:p-8">
          {topic && content ? (
            <>
              <h1 className="text-2xl font-bold text-gray-800">{topic.title}</h1>
              <div className="w-16 h-1.5 rounded-full bg-katta-primary -rotate-2 mt-3 mb-6" />
              {/* Nội dung HTML do chính hệ thống soạn sẵn và nạp vào DB (không phải do người dùng nhập) nên hiển thị nguyên dạng */}
              <div
                className="text-[15px] text-gray-600 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-katta-primary [&_h3]:mt-6 [&_h3]:mb-2 [&_h3:first-child]:mt-0 [&_strong]:text-gray-800 [&_strong]:font-semibold [&_em]:italic [&_em]:text-gray-500 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </>
          ) : (
            <div className="text-center text-gray-400 py-16">{isLoading || !flat ? t('grammar.loading') : t('grammar.empty_content')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
