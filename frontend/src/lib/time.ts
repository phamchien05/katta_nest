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

// Tổng thời gian ở trang Thống kê: "45m" hoặc "1h 30m" (khác formatStudyTime ở Trang chủ, có khoảng trắng)
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60)
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

// "21/09/2026 10:30" (giờ của máy người dùng) - giống định dạng d/m/Y H:i bên Laravel
export function formatDateTime(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()} ${p(date.getHours())}:${p(date.getMinutes())}`
}

// Số ô trống đầu tháng để ngày mùng 1 rơi đúng cột (Thứ 2 = 0 ... Chủ nhật = 6)
export function leadingBlanks(year: number, month: number): number {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7
}

export const daysInMonth = (year: number, month: number): number => new Date(year, month, 0).getDate()

// Tháng trước/sau (month 1-12), tự nhảy sang năm khác
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}
