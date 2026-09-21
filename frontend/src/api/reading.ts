import { api } from './client'

export const TOPICS = ['general', 'business', 'environment', 'health', 'history', 'science', 'society', 'technology'] as const
export type Topic = (typeof TOPICS)[number]
export const GENERAL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

export const isGeneralLevel = (v: string | undefined): v is (typeof GENERAL_LEVELS)[number] =>
  (GENERAL_LEVELS as readonly string[]).includes(v ?? '')

export interface PassageSummary {
  id: number
  topic: string
  title: string
  level: string | null
}

export interface ReadingHistoryItem {
  id: number
  passageId: number
  topic: string
  title: string
  score: number
  total: number
  createdAt: string
}

export type QuestionType = 'fill' | 'boolean' | 'mcq' | 'multi'

export interface Question {
  id: number
  type: QuestionType
  question: string
  options: string[]
}

export interface PassageDetail {
  id: number
  topic: string
  level: string | null
  title: string
  content: string
  questions: Question[]
}

// Đáp án của 1 câu: chuỗi (fill/boolean/mcq) hoặc mảng chuỗi (multi)
export type Answer = string | string[]

export interface SubmitResult {
  score: number
  total: number
  results: { questionId: number; isCorrect: boolean; correctAnswer: string[] }[]
}

export const fetchPassages = () => api<{ items: PassageSummary[] }>('/reading/passages')
export const fetchReadingHistory = () => api<{ items: ReadingHistoryItem[] }>('/reading/history')
export const fetchPassage = (id: number) => api<PassageDetail>(`/reading/passages/${id}`)

export function fetchNext(topic: string, level: string | null, opts: { exclude?: number; seen?: number[] } = {}) {
  const params = new URLSearchParams({ topic })
  if (level) params.set('level', level)
  if (opts.exclude) params.set('exclude', String(opts.exclude))
  if (opts.seen?.length) params.set('seen', opts.seen.join(','))
  return api<{ passageId: number | null }>(`/reading/next?${params}`)
}

export const submitAnswers = (id: number, answers: Record<number, Answer>, durationSeconds: number) =>
  api<SubmitResult>(`/reading/passages/${id}/submit`, { method: 'POST', body: { answers, durationSeconds } })
