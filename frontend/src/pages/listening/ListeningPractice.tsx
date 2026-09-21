import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  fetchNext,
  fetchPassage,
  GENERAL_LEVELS,
  submitAnswers,
  type ListeningPassage,
  type ListeningSubmitResult,
} from '../../api/listening'
import { GeneralLevelRedirect } from '../../components/GeneralLevelRedirect'
import { QuestionCard } from '../../components/QuestionCard'
import { isAnswered, type AnswerValue } from '../../lib/answers'
import { getSeen, markSeen } from '../../lib/seen'
import { AudioPlayer } from './AudioPlayer'

// /listening/general/:level - random 1 bài chưa xem của cấp đó rồi chuyển sang trang làm bài
export function ListeningGeneralRedirect() {
  return <GeneralLevelRedirect module="listening" levels={GENERAL_LEVELS} fetchNext={fetchNext} />
}

// /listening/:id
export function ListeningPractice() {
  const { id } = useParams()
  const passageId = Number(id)
  return Number.isInteger(passageId) && passageId > 0 ? <Practice key={passageId} passageId={passageId} /> : <Navigate to="/listening" replace />
}

function Practice({ passageId }: { passageId: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [passage, setPassage] = useState<ListeningPassage | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({})
  const [result, setResult] = useState<ListeningSubmitResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startedAt] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    fetchPassage(passageId)
      .then((p) => {
        if (cancelled) return
        markSeen(p.topic, p.level, passageId)
        setPassage(p)
      })
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof ApiError ? e.message : t('listening.load_failed')))
    return () => {
      cancelled = true
    }
  }, [passageId, t])

  if (loadError) return <p className="mt-6 text-katta-accent">{loadError}</p>
  if (!passage) return <p className="mt-6 text-gray-400">{t('listening.loading')}</p>

  const total = passage.questions.length
  const answeredCount = passage.questions.filter((q) => isAnswered(answers[q.id])).length
  const canSubmit = answeredCount === total && total > 0 && !submitting

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      setResult(await submitAnswers(passage.id, answers, Math.max(1, Math.round((Date.now() - startedAt) / 1000))))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('listening.submit_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const nextClip = async () => {
    try {
      const { passageId: next } = await fetchNext(passage.topic, passage.level, {
        exclude: passage.id,
        seen: getSeen(passage.topic, passage.level),
      })
      navigate(next ? `/listening/${next}` : '/listening')
    } catch {
      navigate('/listening')
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <Link to="/listening" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-katta-primary">
          {t('listening.back_to_passages')}
        </Link>
        {!result && <span className="text-xs text-gray-400">{t('reading.answered_count', { answered: answeredCount, total })}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden lg:sticky lg:top-6">
          <div className="bg-linear-to-br from-indigo-900 to-katta-primary px-6 py-5">
            <p className="text-[11px] font-bold tracking-widest text-white/70 uppercase">
              {t(`listening.topics.${passage.topic}`, { defaultValue: passage.topic })}
            </p>
            <h1 className="text-xl font-bold text-white mt-1">{passage.title}</h1>
          </div>
          <div className="p-6">
            <AudioPlayer passageId={passage.id} initialPlaysLeft={passage.playsLeft} transcript={result?.transcript} />

            {!result ? (
              <p className="text-xs text-gray-400 text-center mt-4">{t('listening.transcript_hint')}</p>
            ) : (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{t('listening.transcript_heading')}</p>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{result.transcript}</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {passage.questions.map((q, i) => {
            const r = result?.results.find((x) => x.questionId === q.id)
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
              {submitting ? t('listening.submitting') : `${t('listening.submit_button')} (${answeredCount}/${total})`}
            </button>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between sticky bottom-4">
              <p className="font-bold text-gray-800">
                {result.score}/{result.total}
              </p>
              <button
                type="button"
                onClick={() => void nextClip()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
              >
                {t('listening.next_article')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
