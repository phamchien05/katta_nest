import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { getSeen } from '../lib/seen'

interface Props {
  module: 'reading' | 'listening'
  levels: readonly string[]
  fetchNext: (topic: string, level: string, opts: { seen: number[] }) => Promise<{ passageId: number | null }>
}

// /<module>/general/:level - bấm 1 cấp độ ở mục "Tổng quan": random 1 bài chưa xem của cấp đó rồi chuyển sang trang làm bài
export function GeneralLevelRedirect({ module, levels, fetchNext }: Props) {
  const { level } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const valid = level !== undefined && levels.includes(level)

  useEffect(() => {
    if (!valid || !level) return
    let cancelled = false
    fetchNext('general', level, { seen: getSeen('general', level) })
      .then(({ passageId }) => {
        if (cancelled) return
        if (passageId) navigate(`/${module}/${passageId}`, { replace: true })
        else setFailed(true)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [valid, level, module, fetchNext, navigate])

  if (!valid) return <Navigate to={`/${module}`} replace />
  return (
    <div className="mt-6 max-w-2xl mx-auto text-center">
      {failed ? (
        <>
          <p className="text-gray-500">{t(`${module}.no_results`)}</p>
          <Link to={`/${module}`} className="text-katta-primary text-sm font-semibold mt-3 inline-block">
            {t(`${module}.back_to_passages`)}
          </Link>
        </>
      ) : (
        <p className="text-gray-400">{t(`${module}.loading`)}</p>
      )}
    </div>
  )
}
