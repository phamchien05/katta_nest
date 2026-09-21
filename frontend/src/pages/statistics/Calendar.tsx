import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchCalendar } from '../../api/statistics'
import { daysInMonth, leadingBlanks, shiftMonth } from '../../lib/time'

const WEEKDAYS = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  vi: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
}

// Lịch tháng đánh dấu ngày có buổi học - chuyển tháng trước/sau bằng nút mũi tên.
// `today` = "YYYY-MM-DD" của server (theo múi giờ người học) để đánh dấu đúng "hôm nay".
export function Calendar({ today }: { today: string }) {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'vi' ? 'vi' : 'en'
  const [ty, tm, td] = today.split('-').map(Number)
  const [view, setView] = useState({ year: ty, month: tm })
  const [loaded, setLoaded] = useState<{ year: number; month: number; days: number[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchCalendar(view.year, view.month)
      .then((d) => !cancelled && setLoaded({ year: d.year, month: d.month, days: d.activeDays }))
      .catch(() => !cancelled && setLoaded({ year: view.year, month: view.month, days: [] }))
    return () => {
      cancelled = true
    }
  }, [view])

  // Dữ liệu của tháng khác (đang tải) thì chưa tô ngày nào để không hiển thị nhầm
  const active = loaded && loaded.year === view.year && loaded.month === view.month ? loaded.days : []
  const isCurrentMonth = view.year === ty && view.month === tm
  const monthLabel = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(new Date(view.year, view.month - 1, 1))

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <button type="button" aria-label="previous month" onClick={() => setView((v) => shiftMonth(v.year, v.month, -1))} className="text-gray-400 hover:text-katta-primary transition">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="font-semibold text-gray-800 first-letter:uppercase">{monthLabel}</p>
        <button type="button" aria-label="next month" onClick={() => setView((v) => shiftMonth(v.year, v.month, 1))} className="text-gray-400 hover:text-katta-primary transition">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-2 text-center">
        {WEEKDAYS[lang].map((d) => (
          <span key={d} className="text-xs font-semibold text-gray-400">
            {d}
          </span>
        ))}
        {Array.from({ length: leadingBlanks(view.year, view.month) }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth(view.year, view.month) }, (_, i) => i + 1).map((day) => {
          const isActive = active.includes(day)
          const isToday = isCurrentMonth && day === td
          return (
            <div key={day} className="flex items-center justify-center">
              <span
                className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition ${
                  isActive ? 'bg-katta-primary text-white font-semibold' : isToday ? 'ring-2 ring-katta-primary text-katta-primary font-semibold' : 'text-gray-600'
                }`}
              >
                {day}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
