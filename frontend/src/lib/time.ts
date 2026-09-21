// Lời chào theo giờ trong ngày (giờ của máy người dùng)
export type Greeting = 'morning' | 'afternoon' | 'evening'

export function greetingFor(hour: number): Greeting {
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

// Tổng thời gian học: "45m" hoặc "1h30"
export function formatStudyTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

// "5 minutes ago" / "5 phút trước" - giống diffForHumans() bên Laravel
export function formatRelative(date: Date, now: Date, locale: string): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const abs = Math.abs(seconds)
  for (const [unit, size] of UNITS) {
    if (abs >= size) return formatter.format(Math.trunc(seconds / size), unit)
  }
  return formatter.format(0, 'second') // dưới 1 phút: "now" / "bây giờ"
}
