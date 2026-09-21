import { ArrowRight, BookOpen, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

// Trang gốc /grammar - 2 thẻ lớn: Xem lý thuyết / Bắt đầu luyện tập
export function GrammarHome() {
  const { t } = useTranslation()

  return (
    <div className="max-w-4xl mx-auto mt-6">
      <Link to="/" className="text-sm text-gray-400 hover:text-katta-primary transition">
        {t('grammar.back_to_home')}
      </Link>
      <h1 className="text-2xl font-bold text-gray-800 mt-2">{t('nav.grammar')}</h1>
      <p className="text-gray-400 mt-1">{t('grammar.index_subtitle')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Link to="/grammar/theory" className="group bg-white rounded-3xl shadow-sm p-8 hover:shadow-md hover:-translate-y-0.5 transition">
          <div className="w-14 h-14 rounded-2xl bg-katta-bg text-katta-primary flex items-center justify-center">
            <BookOpen className="w-7 h-7" />
          </div>
          <p className="font-bold text-xl text-gray-800 mt-5">{t('grammar.card_theory_title')}</p>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">{t('grammar.card_theory_desc')}</p>
          <p className="text-sm text-katta-primary font-semibold mt-5 flex items-center gap-1">
            <span>{t('grammar.card_theory_title')}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </p>
        </Link>

        <Link to="/grammar/practice" className="group bg-white rounded-3xl shadow-sm p-8 hover:shadow-md hover:-translate-y-0.5 transition">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-katta-accent flex items-center justify-center">
            <Pencil className="w-7 h-7" />
          </div>
          <p className="font-bold text-xl text-gray-800 mt-5">{t('grammar.card_practice_title')}</p>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">{t('grammar.card_practice_desc')}</p>
          <p className="text-sm text-katta-primary font-semibold mt-5 flex items-center gap-1">
            <span>{t('grammar.card_practice_title')}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </p>
        </Link>
      </div>
    </div>
  )
}
