import { Book, Play } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  levels: readonly string[]
  // Đường dẫn khi bấm vào một cấp độ, ví dụ (l) => `/vocabulary/${l}`
  hrefFor: (level: string) => string
  subtitleFor: (level: string) => ReactNode
  // Màu ô icon, viết nguyên văn để Tailwind quét thấy
  tone?: 'indigo' | 'blue'
}

const TONES = {
  indigo: 'bg-indigo-100 text-indigo-600',
  blue: 'bg-blue-100 text-blue-600',
}

// Lưới các thẻ cấp độ (A1, A2, ...) dùng chung cho Từ vựng, Dịch, Đọc hiểu, Nghe
export function LevelGrid({ levels, hrefFor, subtitleFor, tone = 'indigo' }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-8 text-left">
      {levels.map((level) => (
        <Link
          key={level}
          to={hrefFor(level)}
          className="group bg-white rounded-2xl shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition"
        >
          <div className="flex items-start justify-between">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${TONES[tone]}`}>
              <Book className="w-5 h-5" />
            </div>
            <span className="w-8 h-8 rounded-full bg-katta-bg text-katta-primary flex items-center justify-center group-hover:bg-katta-primary group-hover:text-white transition">
              <Play className="w-3.5 h-3.5 ml-0.5" />
            </span>
          </div>
          <p className="font-bold text-lg text-gray-800 mt-4">{level}</p>
          <p className="text-xs text-gray-400">{subtitleFor(level)}</p>
        </Link>
      ))}
    </div>
  )
}
