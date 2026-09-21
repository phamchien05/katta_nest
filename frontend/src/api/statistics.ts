import { api } from './client'

export interface StatisticsOverview {
  streak: number
  sessionsCompleted: number
  vocabMastered: number
  articlesRead: number
  minutesToday: number
  totalStudySeconds: number
  // "YYYY-MM-DD" của hôm nay theo múi giờ của server/người học - để lịch đánh dấu đúng ngày
  today: string
  vocabByLevel: { level: string; mastered: number; total: number }[]
  accuracy: { type: 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'translate'; percent: number; sessions: number }[]
}

export const fetchStatistics = () => api<StatisticsOverview>('/statistics')
export const fetchCalendar = (year: number, month: number) =>
  api<{ year: number; month: number; activeDays: number[] }>(`/statistics/calendar?year=${year}&month=${month}`)
