import { Loader, Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { playPassage } from '../../api/listening'
import { speak, speechSupported, stopSpeaking } from '../../lib/speech'

const RATES = [0.75, 1, 1.25] as const

interface Props {
  passageId: number
  initialPlaysLeft: number
  // Có transcript nghĩa là đã nộp bài: nghe lại thoải mái, không cần hỏi server và không tính lượt
  transcript?: string
}

// Trình phát: lời thoại được đọc bằng giọng của trình duyệt (Web Speech API). Lời thoại CHỈ được lấy về đúng lúc bấm nghe
// (không nằm sẵn trong trang) và server đếm lượt nghe, nên không xem trước chữ và không sửa được số lượt qua devtools.
export function AudioPlayer({ passageId, initialPlaysLeft, transcript }: Props) {
  const { t } = useTranslation()
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rate, setRate] = useState<number>(1)
  const [playsLeft, setPlaysLeft] = useState(initialPlaysLeft)
  const [message, setMessage] = useState<string | null>(null)
  const unlimited = transcript !== undefined
  const canPlay = unlimited || playsLeft > 0

  // Rời trang thì dừng đọc
  useEffect(() => () => stopSpeaking(), [])

  const start = async () => {
    if (playing || loading) return
    if (!speechSupported()) {
      setMessage(t('listening.unsupported_browser'))
      return
    }
    setMessage(null)
    let text = transcript
    if (text === undefined) {
      setLoading(true)
      try {
        const result = await playPassage(passageId)
        setPlaysLeft(result.playsLeft)
        if (!result.allowed) return
        text = result.text
      } catch (e) {
        setMessage(e instanceof ApiError ? e.message : t('listening.play_failed'))
        return
      } finally {
        setLoading(false)
      }
    }
    speak(text, rate, { onStart: () => setPlaying(true), onEnd: () => setPlaying(false) })
  }

  const stop = () => {
    stopSpeaking()
    setPlaying(false)
  }

  return (
    <div>
      <div className="flex flex-col items-center py-4">
        <button
          type="button"
          onClick={() => (playing ? stop() : void start())}
          disabled={!canPlay && !playing}
          aria-label={playing ? t('listening.pause_button') : t('listening.play_button')}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition shrink-0 ${
            loading
              ? 'bg-gray-100 text-gray-400'
              : canPlay || playing
                ? 'bg-katta-primary text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          {loading ? <Loader className="w-8 h-8 animate-spin" /> : playing ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
        </button>

        {!unlimited && (
          <p className="text-sm text-gray-500 mt-3">
            {canPlay ? `${t('listening.plays_remaining_label')} ${playsLeft}` : t('listening.plays_used_up')}
          </p>
        )}
        {message && <p className="text-sm text-katta-accent mt-2 text-center">{message}</p>}
      </div>

      <div className="flex items-center justify-center gap-2 mt-2">
        <span className="text-xs text-gray-400 mr-1">{t('listening.speed_label')}:</span>
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRate(r)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${rate === r ? 'bg-katta-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {r}x
          </button>
        ))}
      </div>
    </div>
  )
}
