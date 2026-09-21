import { useTranslation } from 'react-i18next'
import { LEVELS } from '../../api/vocabulary'
import { LevelGrid } from '../../components/LevelGrid'

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

      <LevelGrid
        levels={LEVELS}
        hrefFor={(level) => `/vocabulary/${level}`}
        subtitleFor={(level) => t('vocabulary.level_subtitle', { level })}
      />
    </div>
  )
}
