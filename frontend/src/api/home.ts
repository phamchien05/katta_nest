import { api } from './client'

export interface WeekdayCount {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
  count: number
}

export interface HomeSummary {
  streak: number
  sessionsCompleted: number
  minutesToday: number
  translation: { count: number; averageScore: number }
  vocabMastered: number
  articlesRead: number
  totalStudySeconds: number
  weekly: WeekdayCount[]
  recentActivity: { type: string; completedAt: string }[]
}

export const fetchHome = () => api<HomeSummary>('/home')
