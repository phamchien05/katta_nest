import { api } from './client'

export const PROGRESS_TYPES = ['vocabulary', 'grammar', 'reading', 'listening', 'translate'] as const
export type ProgressType = (typeof PROGRESS_TYPES)[number]

export interface ProgressEntry {
  type: ProgressType
  id: number
  level: string | null
  topicKey: string | null
  title: string | null
  score: number
  total: number
  date: string | null
}

export interface QaItem {
  question: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
}

export type ProgressDetail =
  | { kind: 'qa'; items: QaItem[] }
  | { kind: 'translate'; sourceText: string; userTranslation: string; feedback: string | null }

export const fetchProgress = () => api<{ items: ProgressEntry[] }>('/progress')
export const fetchProgressDetail = (type: ProgressType, id: number) => api<ProgressDetail>(`/progress/${type}/${id}`)
