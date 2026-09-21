import { Book, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LEVELS } from '../../api/vocabulary'

// Trang chọn cấp độ (6 cấp CEFR)
export function VocabularyLevels() {
  const { t } = useTranslation()

  return (
    <div className="max-w-4xl mx-auto mt-6 text-center">
      <h1 className="text-2xl font-bold text-gray-800">{t('vocabulary.select_level_title')}</h1>
      <p className="text-gray-400 mt-1">{t('vocabulary.select_level_subtitle')}</p>

      {/* Phương hướng học - giữ chỗ cho tương lai (hiện chỉ hỗ trợ EN -> VI) */}
      <div className="flex items-center justify-center gap-3 mt-5">
        <span className="text-xs font-bold tracking-widest text-gray-400">{t('vocabulary.direction_label')}</span>
        <span className="px-4 py-1.5 rounded-full bg-white shadow-sm text-sm font-semibold text-gray-700">EN → VI</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-8 text-left">
        {LEVELS.map((level) => (
          <Link
            key={level}
            to={`/vocabulary/${level}`}
            className="group bg-white rounded-2xl shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition"
          >
            <div className="flex items-start justify-between">
              <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Book className="w-5 h-5" />
              </div>
              <span className="w-8 h-8 rounded-full bg-katta-bg text-katta-primary flex items-center justify-center group-hover:bg-katta-primary group-hover:text-white transition">
                <Play className="w-3.5 h-3.5 ml-0.5" />
              </span>
            </div>
            <p className="font-bold text-lg text-gray-800 mt-4">{level}</p>
            <p className="text-xs text-gray-400">{t('vocabulary.level_subtitle', { level })}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
