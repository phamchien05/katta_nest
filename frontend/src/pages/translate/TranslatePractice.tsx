import { XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  fetchPassage,
  gradeTranslation,
  isTranslateLevel,
  type Direction,
  type Grade,
  type Passage,
  type TranslateLevel,
} from '../../api/translate'
import { readStored } from '../../lib/storage'
import { DIRECTION_KEY, DIRECTIONS, scoreTone } from './shared'

// Trang luyện dịch: /translate/:level  (?passage=ID&direction=... = "Dịch lại" một đoạn cụ thể)
export function TranslatePractice() {
  const { level } = useParams()
  const [params] = useSearchParams()
  const { t } = useTranslation()

  const direction = readStored<Direction>(DIRECTION_KEY, DIRECTIONS, 'en_vi')
  const requestedDirection = DIRECTIONS.find((d) => d === params.get('direction')) ?? direction
  const passageParam = Number(params.get('passage')) || undefined

  return (
    <div className="mt-4">
      <Link to="/translate" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-katta-primary mb-4">
        {t('translate.back_to_levels')}
      </Link>
      {isTranslateLevel(level) ? (
        <Practice key={`${level}-${requestedDirection}-${passageParam ?? 0}`} level={level} direction={requestedDirection} passageParam={passageParam} />
      ) : (
        <p className="text-gray-500">{t('translate.unknown_level')}</p>
      )}
    </div>
  )
}

function Practice({ level, direction, passageParam }: { level: TranslateLevel; direction: Direction; passageParam?: number }) {
  const { t } = useTranslation()
  const [passage, setPassage] = useState<Passage | null | undefined>(undefined) // undefined = đang tải
  const [loadError, setLoadError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [grade, setGrade] = useState<Grade | null>(null)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState(() => Date.now())

  // Lần vào trang: lấy đoạn theo yêu cầu (ngẫu nhiên hoặc "dịch lại")
  useEffect(() => {
    let cancelled = false
    fetchPassage(level, direction, { passage: passageParam })
      .then((data) => !cancelled && setPassage(data.passage))
      .catch((e: unknown) => !cancelled && setLoadError(e instanceof ApiError ? e.message : t('translate.load_failed')))
    return () => {
      cancelled = true
    }
  }, [level, direction, passageParam, t])

  // "Đoạn khác": lấy đoạn mới cùng cấp độ + chiều, xoá bài đang làm
  const shuffle = async () => {
    setError(null)
    try {
      const data = await fetchPassage(level, direction, { exclude: passage?.id })
      setPassage(data.passage)
      setText('')
      setGrade(null)
      setStartedAt(Date.now())
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('translate.load_failed'))
    }
  }

  const submit = async () => {
    if (!passage || !text.trim()) return
    setGrading(true)
    setError(null)
    try {
      setGrade(await gradeTranslation(passage.id, text, Math.max(1, Math.round((Date.now() - startedAt) / 1000))))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('translate.grade_failed'))
    } finally {
      setGrading(false)
    }
  }

  if (loadError) return <p className="text-katta-accent">{loadError}</p>
  if (passage === undefined) return <p className="text-gray-400">{t('translate.loading')}</p>

  const canSubmit = text.trim() !== '' && !grading

  return (
    <div>
      <div className="flex items-center justify-end gap-3 mb-4">
        {grade ? (
          <button
            type="button"
            onClick={() => void shuffle()}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
          >
            {t('translate.try_again')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
              canSubmit ? 'bg-katta-primary text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {grading ? t('translate.grading') : t('translate.submit_for_grading')}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-katta-accent mb-3">{error}</p>}

      {!passage ? (
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">{t('translate.no_passages')}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">{t('translate.source_text')}</p>
              <p className="text-gray-800 leading-relaxed whitespace-pre-line">{passage.sourceText}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">{t('translate.your_translation')}</p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={grade !== null}
                rows={10}
                maxLength={8000}
                placeholder={t('translate.input_placeholder')}
                className="w-full h-full min-h-[220px] border-0 focus:ring-0 resize-none text-gray-800 placeholder:text-gray-300 disabled:bg-transparent disabled:text-gray-500"
              />
            </div>
          </div>

          {grade && <GradeResult grade={grade} />}
        </>
      )}
    </div>
  )
}

function GradeResult({ grade }: { grade: Grade }) {
  const { t } = useTranslation()
  return (
    <div className="mt-6 bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-gray-700">{t('translate.result_title')}</p>
        <span className={`text-2xl font-extrabold ${scoreTone(grade.score).text}`}>
          {grade.score}
          <span className="text-sm text-gray-400 font-medium">/100</span>
        </span>
      </div>

      {grade.gradedBy === 'simple' ? (
        <p className="text-sm text-gray-600 leading-relaxed">{t('translate.simple_grade_notice')}</p>
      ) : (
        grade.feedback && <p className="text-sm text-gray-600 leading-relaxed">{grade.feedback}</p>
      )}

      {grade.referenceTranslation && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">{t('translate.reference_translation_label')}</p>
          <p className="text-sm text-gray-700 leading-relaxed bg-katta-bg rounded-xl p-3 whitespace-pre-line">{grade.referenceTranslation}</p>
        </div>
      )}

      {grade.issues.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">{t('translate.issues_label')}</p>
          <ul className="space-y-2">
            {grade.issues.map((issue) => (
              <li key={issue} className="flex items-start gap-2 text-sm text-gray-700 bg-rose-50 border-l-4 border-katta-accent rounded-lg p-3">
                <XCircle className="w-4 h-4 text-katta-accent shrink-0 mt-0.5" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
