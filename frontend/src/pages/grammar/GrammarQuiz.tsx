import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { fetchSet, submitSet, type QuestionOutcome, type QuestionSet } from '../../api/grammar'
import { QuestionCard } from '../../components/QuestionCard'
import { isAnswered, type AnswerValue } from '../../lib/answers'

// /grammar/practice/set/:id - làm 1 bộ đề (30-50 câu) hoặc xem lại bộ đã nộp
export function GrammarQuiz() {
  const { id } = useParams()
  const setId = Number(id)
  return Number.isInteger(setId) && setId > 0 ? <Quiz key={setId} setId={setId} /> : <Navigate to="/grammar/practice" replace />
}

function Quiz({ setId }: { setId: number }) {
  const { t } = useTranslation()
  const [set, setSet] = useState<QuestionSet | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({})
  const [outcome, setOutcome] = useState<{ score: number; total: number; results: QuestionOutcome[] } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startedAt] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    fetchSet(setId)
      .then((s) => {
        if (cancelled) return
        setSet(s)
        // Bộ đã nộp trước đó (xem lại): hiện luôn kết quả đã lưu
        if (s.status === 'completed' && s.results) {
          setAnswers(Object.fromEntries(Object.entries(s.answers ?? {}).map(([k, v]) => [Number(k), v])))
          setOutcome({ score: s.score ?? 0, total: s.total ?? s.questions.length, results: s.results })
        }
      })
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof ApiError ? e.message : t('grammar.load_failed')))
    return () => {
      cancelled = true
    }
  }, [setId, t])

  if (loadError) return <p className="mt-6 text-katta-accent">{loadError}</p>
  if (!set) return <p className="mt-6 text-gray-400">{t('grammar.loading')}</p>

  const total = set.questions.length
  const answeredCount = set.questions.filter((q) => isAnswered(answers[q.id])).length
  const canSubmit = answeredCount === total && total > 0 && !submitting
  const topicTitle = t(`grammar.practice_topics.${set.topicKey}.title`, { defaultValue: set.topicKey })

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      setOutcome(await submitSet(set.id, answers, Math.max(1, Math.round((Date.now() - startedAt) / 1000))))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('grammar.submit_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-6">
      <Link to="/grammar/practice" className="text-sm text-gray-400 hover:text-katta-primary transition">
        {t('grammar.back_to_topics')}
      </Link>
      <h1 className="text-2xl font-bold text-gray-800 text-center mt-4 mb-6">{t('grammar.quiz_title', { topic: topicTitle })}</h1>

      {!outcome && (
        <div className="flex justify-end mb-3">
          <span className="text-xs text-gray-400">{t('reading.answered_count', { answered: answeredCount, total })}</span>
        </div>
      )}

      <div className="space-y-4">
        {set.questions.map((q, i) => {
          const r = outcome?.results.find((x) => x.questionId === q.id)
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

        {!outcome ? (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition sticky bottom-4 ${
              canSubmit ? 'bg-katta-accent text-white hover:bg-rose-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? t('grammar.submitting') : `${t('grammar.submit_button')} (${answeredCount}/${total})`}
          </button>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between sticky bottom-4">
            <p className="font-bold text-gray-800">
              {outcome.score}/{outcome.total}
            </p>
            <Link to="/grammar/practice" className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition">
              {t('grammar.back_to_topics')}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
