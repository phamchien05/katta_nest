import { CheckCircle, ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { CATEGORIES, fetchFeedback, screenshotUrl, sendFeedback, type Category, type FeedbackItem } from '../../api/feedback'
import { lastPage } from '../../lib/lastPage'
import { checkScreenshot, imageFromClipboard } from '../../lib/screenshot'
import { formatRelative } from '../../lib/time'

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_review: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-katta-accent',
}

// Phản hồi: tab "Gửi phản hồi" (có thể dán/chọn ảnh chụp màn hình) và tab "Lịch sử"
export function FeedbackPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'new' | 'history'>('new')
  const [history, setHistory] = useState<FeedbackItem[] | null>(null)

  const loadHistory = () =>
    fetchFeedback()
      .then((d) => setHistory(d.items))
      .catch(() => setHistory([]))

  useEffect(() => {
    let cancelled = false
    fetchFeedback()
      .then((d) => !cancelled && setHistory(d.items))
      .catch(() => !cancelled && setHistory([]))
    return () => {
      cancelled = true
    }
  }, [])

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-semibold transition ${active ? 'bg-katta-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`

  return (
    <div className="max-w-3xl mx-auto mt-6">
      <h1 className="text-2xl font-bold text-gray-800">{t('feedback.page_title')}</h1>
      <div className="flex items-center gap-2 mt-5 mb-6">
        <button type="button" onClick={() => setTab('new')} className={tabClass(tab === 'new')}>
          {t('feedback.tab_new')}
        </button>
        <button type="button" onClick={() => setTab('history')} className={tabClass(tab === 'history')}>
          {t('feedback.tab_history')} ({history?.length ?? 0})
        </button>
      </div>

      {tab === 'new' ? <NewFeedbackForm onSent={() => void loadHistory()} /> : <History items={history} />}
    </div>
  )
}

function NewFeedbackForm({ onSent }: { onSent: () => void }) {
  const { t } = useTranslation()
  const [category, setCategory] = useState<Category>('bug')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  // Ảnh đã chọn + URL tạm để xem trước (tạo khi chọn, huỷ khi bỏ ảnh / rời trang để không rò bộ nhớ)
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null)
  const shotUrl = useRef<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [context] = useState(() => lastPage())
  const input = useRef<HTMLInputElement>(null)

  const setScreenshot = (file: File | null) => {
    if (shotUrl.current) URL.revokeObjectURL(shotUrl.current)
    shotUrl.current = file ? URL.createObjectURL(file) : null
    setShot(file && shotUrl.current ? { file, url: shotUrl.current } : null)
  }
  useEffect(() => () => {
    if (shotUrl.current) URL.revokeObjectURL(shotUrl.current)
  }, [])

  const pick = (f: File | null) => {
    if (!f) return
    const problem = checkScreenshot(f)
    setError(problem === 'type' ? t('feedback.screenshot_type_error') : problem === 'size' ? t('feedback.screenshot_size_error') : null)
    if (!problem) setScreenshot(f)
  }

  // Dán ảnh (Ctrl+V) ở bất kỳ ô nhập nào trong form
  const onPaste = (e: ClipboardEvent) => {
    const image = imageFromClipboard(e.clipboardData.items)
    if (image) {
      e.preventDefault()
      pick(image)
    }
  }

  const canSend = title.trim().length >= 3 && message.trim().length >= 10 && !sending

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSend) return
    setSending(true)
    setError(null)
    try {
      await sendFeedback({ category, title: title.trim(), message: message.trim(), contextUrl: context, screenshot: shot?.file ?? null })
      setTitle('')
      setMessage('')
      setScreenshot(null)
      setCategory('bug')
      setSent(true)
      onSent()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('feedback.send_failed'))
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
        <p className="font-bold text-gray-800 mt-3">{t('feedback.submitted_title')}</p>
        <p className="text-sm text-gray-500 mt-1">{t('feedback.submitted_message')}</p>
        <button type="button" onClick={() => setSent(false)} className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-katta-primary text-white hover:bg-purple-700 transition">
          {t('feedback.send_another')}
        </button>
      </div>
    )
  }

  const field = 'w-full rounded-xl border-gray-300 focus:border-katta-primary focus:ring-katta-primary text-sm'
  const label = 'block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5'

  return (
    <form onSubmit={(e) => void submit(e)} onPaste={onPaste} className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
      <div>
        <span className={label}>{t('feedback.label_category')}</span>
        <div className="grid grid-cols-3 gap-3">
          {CATEGORIES.map((c) => (
            <label
              key={c}
              className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer transition font-semibold text-sm text-center ${
                category === c ? 'border-katta-primary bg-katta-bg text-katta-primary' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <input type="radio" name="category" className="hidden" checked={category === c} onChange={() => setCategory(c)} />
              {t(`feedback.category_${c}`)}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="fb-title" className={label}>
          {t('feedback.label_title')}
        </label>
        <input id="fb-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder={t('feedback.title_placeholder')} className={field} />
      </div>

      <div>
        <label htmlFor="fb-message" className={label}>
          {t('feedback.label_message')}
        </label>
        <textarea id="fb-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={5000} placeholder={t('feedback.message_placeholder')} className={field} />
      </div>

      <div>
        <span className={label}>{t('feedback.label_screenshot')}</span>
        {shot ? (
          <div className="relative inline-block">
            <img src={shot.url} alt="" className="max-h-48 rounded-xl border border-gray-200" />
            <button
              type="button"
              onClick={() => setScreenshot(null)}
              aria-label={t('feedback.remove_screenshot')}
              className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-katta-accent text-white flex items-center justify-center shadow"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="w-full border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-sm text-gray-400 hover:border-katta-primary hover:text-katta-primary transition"
          >
            <ImagePlus className="w-6 h-6 mx-auto mb-1" />
            {t('feedback.screenshot_hint')}
          </button>
        )}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
      </div>

      {context && (
        <p className="text-xs text-gray-400">
          {t('feedback.context_label')} <span className="font-mono">{context}</span>
        </p>
      )}
      {error && <p className="text-sm text-katta-accent">{error}</p>}

      <button
        type="submit"
        disabled={!canSend}
        className={`px-6 py-3 rounded-xl text-sm font-semibold transition ${canSend ? 'bg-katta-primary text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
      >
        {sending ? t('feedback.submitting') : t('feedback.submit_button')}
      </button>
    </form>
  )
}

function History({ items }: { items: FeedbackItem[] | null }) {
  const { t, i18n } = useTranslation()
  const [now] = useState(() => new Date())
  const lang = i18n.language === 'vi' ? 'vi' : 'en'

  if (items === null) return <p className="text-gray-400">{t('feedback.loading')}</p>
  if (items.length === 0) return <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">{t('feedback.history_empty')}</div>

  return (
    <div className="space-y-3">
      {items.map((f) => (
        <div key={f.id} className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-katta-bg text-katta-primary">{t(`feedback.category_${f.category}`, { defaultValue: f.category })}</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[f.status] ?? STATUS_STYLE.pending}`}>{t(`feedback.status_${f.status}`, { defaultValue: f.status })}</span>
            {f.createdAt && <span className="text-xs text-gray-400 ml-auto">{formatRelative(new Date(f.createdAt), now, lang)}</span>}
          </div>
          <p className="font-semibold text-gray-800">{f.title}</p>
          <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{f.message}</p>
          {f.contextUrl && (
            <p className="text-xs text-gray-400 mt-2">
              {t('feedback.context_label')} <span className="font-mono">{f.contextUrl}</span>
            </p>
          )}
          {f.hasScreenshot && (
            <a href={screenshotUrl(f.id)} target="_blank" rel="noreferrer" className="inline-block mt-3">
              <img src={screenshotUrl(f.id)} alt="" className="max-h-40 rounded-xl border border-gray-200" loading="lazy" />
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
