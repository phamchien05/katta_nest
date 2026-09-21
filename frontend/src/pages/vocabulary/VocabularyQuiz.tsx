import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { fetchQuiz, isLevel, submitQuiz, type Level, type QuizResult, type QuizWord } from '../../api/vocabulary'

function BackLink() {
  const { t } = useTranslation()
  return (
    <Link to="/vocabulary" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-katta-primary mb-4">
      {t('vocabulary.back_to_levels')}
    </Link>
  )
}

// Trang làm bài: /vocabulary/:level
export function VocabularyQuiz() {
  const { level } = useParams()
  const { t } = useTranslation()
  const [attempt, setAttempt] = useState(0) // đổi key -> QuizRunner được dựng lại từ đầu -> bốc bộ từ mới

  return (
    <div className="mt-4">
      <BackLink />
      {isLevel(level) ? (
        <QuizRunner key={`${level}-${attempt}`} level={level} onRetry={() => setAttempt((n) => n + 1)} />
      ) : (
        <p className="text-gray-500">{t('vocabulary.unknown_level')}</p>
      )}
    </div>
  )
}

function QuizRunner({ level, onRetry }: { level: Level; onRetry: () => void }) {
  const { t } = useTranslation()
  const [questions, setQuestions] = useState<QuizWord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [result, setResult] = useState<QuizResult | null>(null)

  useEffect(() => {
    let cancelled = false // StrictMode chạy effect 2 lần ở dev - chỉ nhận kết quả của lần cuối
    fetchQuiz(level)
      .then((data) => !cancelled && setQuestions(data.questions))
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof ApiError ? e.message : t('vocabulary.load_failed')))
    return () => {
      cancelled = true
    }
  }, [level, t])

  if (loadError) return <p className="text-katta-accent">{loadError}</p>
  if (!questions) return <p className="text-gray-400">{t('vocabulary.loading')}</p>
  if (questions.length === 0) return <p className="text-gray-500">{t('vocabulary.no_words', { level })}</p>

  if (result) return <QuizResultView result={result} onRetry={onRetry} />
  return <QuizForm level={level} questions={questions} onFinished={setResult} />
}

function QuizForm({ level, questions, onFinished }: { level: Level; questions: QuizWord[]; onFinished: (r: QuizResult) => void }) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({}) // id từ -> câu trả lời đã lưu
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startedAt] = useState(() => Date.now())

  const question = questions[current]
  // Câu đang gõ dở (chưa bấm Enter) cũng tính là đã trả lời - đỡ phải bấm thêm 1 lần ở câu cuối
  const allAnswered = questions.every((q) => q.id in answers || (q.id === question.id && input.trim() !== ''))

  // Lưu đáp án đang gõ (kể cả để trống - giống bản Laravel, coi như đã trả lời) rồi trả về map mới
  const saveCurrent = useCallback(() => ({ ...answers, [question.id]: input.trim() }), [answers, question.id, input])

  const goTo = (index: number) => {
    // Rời câu đang gõ dở: giữ lại nếu đã có chữ, để không mất công người dùng
    const next = input.trim() ? saveCurrent() : answers
    setAnswers(next)
    setCurrent(index)
    setInput(next[questions[index].id] ?? '')
  }

  const submitAnswer = () => {
    const next = saveCurrent()
    setAnswers(next)
    if (current < questions.length - 1) {
      setCurrent(current + 1)
      setInput(next[questions[current + 1].id] ?? '')
    }
  }

  const finish = async () => {
    const finalAnswers = input.trim() ? saveCurrent() : answers
    setSubmitting(true)
    setError(null)
    try {
      const result = await submitQuiz(
        level,
        questions.map((q) => ({ vocabularyId: q.id, answer: finalAnswers[q.id] ?? '' })),
        Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      )
      onFinished(result)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('vocabulary.submit_failed'))
      setSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Cột trái: lưới câu hỏi */}
      <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm p-5">
        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              onClick={() => goTo(i)}
              className={`aspect-square rounded-xl flex items-center justify-center text-sm font-semibold transition ${
                i === current
                  ? 'ring-2 ring-katta-primary text-katta-primary bg-white'
                  : q.id in answers
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void finish()}
          disabled={!allAnswered || submitting}
          className={`w-full mt-4 py-3 rounded-xl text-sm font-semibold transition ${
            allAnswered && !submitting ? 'bg-katta-primary text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {submitting ? t('vocabulary.submitting') : allAnswered ? t('vocabulary.submit_test') : t('vocabulary.please_answer_all')}
        </button>
        {error && <p className="text-sm text-katta-accent mt-3">{error}</p>}
      </div>

      {/* Cột phải: câu hỏi hiện tại */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-8 text-center">
        <h2 className="text-xl font-bold text-gray-800">{t('vocabulary.quiz_title', { level })}</h2>
        <p className="text-gray-400 text-sm mt-1">
          {t('vocabulary.question_progress', { current: current + 1, total: questions.length })}
        </p>

        <h3 className="text-4xl font-extrabold text-gray-900 mt-6 break-words">{question.word}</h3>
        <div className="flex items-center justify-center gap-3 mt-3">
          {question.partOfSpeech && (
            <span className="px-3 py-1 rounded-full bg-katta-bg text-katta-primary text-xs font-semibold">{question.partOfSpeech}</span>
          )}
          {question.ipa && <span className="text-gray-400 italic">{question.ipa}</span>}
        </div>

        <div className="max-w-md mx-auto mt-6">
          <input
            key={question.id}
            type="text"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitAnswer()
              }
            }}
            placeholder={t('vocabulary.input_placeholder')}
            maxLength={255}
            className="w-full rounded-xl border-gray-300 focus:border-katta-primary focus:ring-katta-primary text-lg"
          />
        </div>

        <button
          type="button"
          onClick={submitAnswer}
          className="max-w-md w-full mx-auto mt-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition block"
        >
          {t('vocabulary.submit_next')}
        </button>
      </div>
    </div>
  )
}

function QuizResultView({ result, onRetry }: { result: QuizResult; onRetry: () => void }) {
  const { t } = useTranslation()

  return (
    <>
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-800">{t('vocabulary.result_title', { level: result.level })}</h2>
        <p className="text-5xl font-extrabold text-gray-900 mt-3">
          {result.score}/{result.total}
        </p>

        <div className="max-w-xl mx-auto mt-6 bg-white rounded-2xl shadow-sm p-5">
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {result.results.map((r, i) => (
              <div
                key={r.vocabularyId}
                className={`aspect-square rounded-xl flex items-center justify-center text-sm font-semibold text-white ${
                  r.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onRetry}
          className="mt-6 px-6 py-3 rounded-xl bg-katta-primary text-white text-sm font-semibold hover:bg-purple-700 transition"
        >
          {t('vocabulary.try_again')}
        </button>
      </div>

      <div className="max-w-2xl mx-auto mt-6 space-y-3">
        {result.results.map((r, i) => (
          <div
            key={r.vocabularyId}
            className={`rounded-xl p-4 border-l-4 ${r.isCorrect ? 'bg-emerald-50 border-emerald-500' : 'bg-rose-50 border-katta-accent'}`}
          >
            <p className="font-semibold text-gray-800">
              {i + 1}. {r.word}
            </p>
            {r.ipa && <p className="text-sm text-gray-400 italic">{r.ipa}</p>}
            <p className="text-sm mt-1">
              <span className="font-medium text-gray-600">{t('vocabulary.your_answer')} </span>
              <span className={`font-semibold ${r.isCorrect ? 'text-emerald-600' : 'text-katta-accent'}`}>
                {r.userAnswer !== '' ? r.userAnswer : '—'}
              </span>
            </p>
            <p className="text-sm text-gray-700">{r.correctAnswer}</p>
          </div>
        ))}
      </div>
    </>
  )
}
