import { CheckCircle, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AnswerValue } from '../lib/answers'

export type QuestionKind = 'fill' | 'boolean' | 'mcq' | 'multi'

export interface QuestionResult {
  isCorrect: boolean
  correctAnswer: string[]
}

interface Props {
  index: number
  type: QuestionKind
  text: string
  options: string[]
  value: AnswerValue | undefined
  onChange: (value: AnswerValue) => void
  // Có result nghĩa là đã nộp bài: khoá input và hiện đúng/sai + đáp án đúng
  result?: QuestionResult
}

// Một câu hỏi trắc nghiệm/điền từ dùng chung cho Đọc hiểu, Ngữ pháp, Nghe (4 loại: fill, boolean, mcq, multi).
// Trạng thái nằm ở component cha (nhận `value`/`onChange`) nên cha gom được TOÀN BỘ đáp án và nộp 1 lần.
export function QuestionCard({ index, type, text, options, value, onChange, result }: Props) {
  const { t } = useTranslation()
  const locked = result !== undefined
  const selected = Array.isArray(value) ? value : []

  const toggle = (option: string) =>
    onChange(selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option])

  const optionClass = (active: boolean) =>
    `flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
      active ? 'border-katta-primary bg-katta-bg' : 'border-gray-200 hover:bg-gray-50'
    } ${locked ? 'pointer-events-none opacity-80' : ''}`

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm p-5 ${
        result ? (result.isCorrect ? 'border-l-4 border-emerald-500' : 'border-l-4 border-katta-accent') : ''
      }`}
    >
      <p className="font-semibold text-gray-800 mb-3">
        {index + 1}. {text}
      </p>

      {type === 'fill' && (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={locked}
          maxLength={500}
          placeholder={t('quiz.fill_placeholder')}
          className="w-full rounded-xl border-gray-300 focus:border-katta-primary focus:ring-katta-primary text-lg disabled:bg-gray-50"
        />
      )}

      {type === 'boolean' && (
        <div className="flex gap-3">
          {(['True', 'False'] as const).map((v) => {
            const active = value === v
            const activeColor = v === 'True' ? 'bg-katta-primary text-white border-katta-primary' : 'bg-katta-accent text-white border-katta-accent'
            return (
              <label
                key={v}
                className={`flex-1 text-center py-3 rounded-xl border cursor-pointer font-semibold text-sm transition ${
                  active ? activeColor : 'border-gray-200'
                } ${locked ? 'pointer-events-none opacity-80' : ''}`}
              >
                <input type="radio" className="hidden" checked={active} onChange={() => onChange(v)} disabled={locked} />
                {v === 'True' ? t('quiz.true') : t('quiz.false')}
              </label>
            )
          })}
        </div>
      )}

      {type === 'mcq' && (
        <div className="space-y-2">
          {options.map((option) => (
            <label key={option} className={optionClass(value === option)}>
              <input
                type="radio"
                checked={value === option}
                onChange={() => onChange(option)}
                disabled={locked}
                className="text-katta-primary focus:ring-katta-primary"
              />
              <span className="text-sm text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      )}

      {type === 'multi' && (
        <div className="space-y-2">
          {options.map((option) => (
            <label key={option} className={optionClass(selected.includes(option))}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
                disabled={locked}
                className="rounded text-katta-primary focus:ring-katta-primary"
              />
              <span className="text-sm text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      )}

      {result && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
          {result.isCorrect ? (
            <p className="text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> {t('quiz.correct')}!
            </p>
          ) : (
            <>
              <p className="text-katta-accent font-semibold flex items-center gap-1 mb-1">
                <XCircle className="w-4 h-4" /> {t('quiz.incorrect')}
              </p>
              <p className="text-gray-500">
                {t('quiz.correct_answer_label')} <span className="text-gray-700 font-medium">{result.correctAnswer.join(', ')}</span>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
