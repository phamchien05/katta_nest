import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  fetchNext,
  fetchPassage,
  isGeneralLevel,
  submitAnswers,
  type Answer,
  type PassageDetail,
  type SubmitResult,
} from '../../api/reading'
import { QuestionCard } from '../../components/QuestionCard'
import { isAnswered } from '../../lib/answers'
import { getSeen, markSeen } from '../../lib/seen'

// /reading/general/:level - bấm 1 cấp độ ở mục "Tổng quan": random 1 bài chưa xem của cấp đó rồi chuyển sang trang làm bài
export function ReadingGeneralRedirect() {
  const { level } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!isGeneralLevel(level)) return
    let cancelled = false
    fetchNext('general', level, { seen: getSeen('general', level) })
      .then(({ passageId }) => {
        if (cancelled) return
        if (passageId) navigate(`/reading/${passageId}`, { replace: true })
        else setFailed(true)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [level, navigate])

  if (!isGeneralLevel(level)) return <Navigate to="/reading" replace />
  return (
    <div className="mt-6 max-w-2xl mx-auto text-center">
      {failed ? (
        <>
          <p className="text-gray-500">{t('reading.no_results')}</p>
          <Link to="/reading" className="text-katta-primary text-sm font-semibold mt-3 inline-block">
            {t('reading.back_to_passages')}
          </Link>
        </>
      ) : (
        <p className="text-gray-400">{t('reading.loading')}</p>
      )}
    </div>
  )
}

// /reading/:id - làm 1 bài đọc: bài bên trái, câu hỏi bên phải, chấm 1 lần cho tất cả câu
export function ReadingPractice() {
  const { id } = useParams()
  const passageId = Number(id)
  return Number.isInteger(passageId) && passageId > 0 ? <Practice key={passageId} passageId={passageId} /> : <Navigate to="/reading" replace />
}

function Practice({ passageId }: { passageId: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [passage, setPassage] = useState<PassageDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startedAt] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    fetchPassage(passageId)
      .then((p) => {
        if (cancelled) return
        markSeen(p.topic, p.level, passageId) // đã lấy ra xem thì nhớ lại để lần "bài tiếp theo" không trúng lại
        setPassage(p)
      })
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof ApiError ? e.message : t('reading.load_failed')))
    return () => {
      cancelled = true
    }
  }, [passageId, t])

  if (loadError) return <p className="mt-6 text-katta-accent">{loadError}</p>
  if (!passage) return <p className="mt-6 text-gray-400">{t('reading.loading')}</p>

  const total = passage.questions.length
  const answeredCount = passage.questions.filter((q) => isAnswered(answers[q.id])).length
  const canSubmit = answeredCount === total && total > 0 && !submitting
  const resultOf = (qid: number) => result?.results.find((r) => r.questionId === qid)

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      setResult(await submitAnswers(passage.id, answers, Math.max(1, Math.round((Date.now() - startedAt) / 1000))))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('reading.submit_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  // Bài tiếp theo cùng chủ đề (+ cấp độ), tránh bài đang xem và các bài vừa xem
  const nextArticle = async () => {
    try {
      const { passageId: next } = await fetchNext(passage.topic, passage.level, {
        exclude: passage.id,
        seen: getSeen(passage.topic, passage.level),
      })
      navigate(next ? `/reading/${next}` : '/reading')
    } catch {
      navigate('/reading')
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <Link to="/reading" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-katta-primary">
          {t('reading.back_to_passages')}
        </Link>
        {!result && <span className="text-xs text-gray-400">{t('reading.answered_count', { answered: answeredCount, total })}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden lg:sticky lg:top-6">
          <div className="bg-linear-to-br from-indigo-900 to-katta-primary px-6 py-5">
            <p className="text-[11px] font-bold tracking-widest text-white/70 uppercase">
              {t(`reading.topics.${passage.topic}`, { defaultValue: passage.topic })}
            </p>
            <h1 className="text-xl font-bold text-white mt-1">{passage.title}</h1>
          </div>
          <div className="p-6">
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{passage.content}</p>
          </div>
        </div>

        <div className="space-y-3">
          {passage.questions.map((q, i) => {
            const r = resultOf(q.id)
            return (
              <QuestionCard
                key={q.id}
                index={i}
                type={q.type}
                text={q.question}
                options={q.options}
                value={answers[q.id]}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                result={r && { isCorrect: r.isCorrect, correctAnswer: r.correctAnswer }}
              />
            )
          })}

          {error && <p className="text-sm text-katta-accent">{error}</p>}

          {!result ? (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition sticky bottom-4 ${
                canSubmit ? 'bg-katta-accent text-white hover:bg-rose-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {submitting ? t('reading.submitting') : `${t('reading.submit_button')} (${answeredCount}/${total})`}
            </button>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between sticky bottom-4">
              <p className="font-bold text-gray-800">
                {result.score}/{result.total}
              </p>
              <button
                type="button"
                onClick={() => void nextArticle()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
              >
                {t('reading.next_article')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
