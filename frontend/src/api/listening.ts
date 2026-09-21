import { api } from './client'
import type { AnswerValue } from '../lib/answers'

export const TOPICS = ['general', 'everyday_conversation', 'social_monologue', 'academic_discussion', 'academic_lecture'] as const
export const GENERAL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

export interface ListeningQuestion {
  id: number
  type: 'fill' | 'boolean' | 'mcq' | 'multi'
  question: string
  options: string[]
}

export interface ListeningPassage {
  id: number
  topic: string
  level: string | null
  title: string
  maxPlays: number
  playsLeft: number
  questions: ListeningQuestion[]
}

export interface PlayResult {
  allowed: boolean
  text: string
  playsLeft: number
}

export interface ListeningSubmitResult {
  score: number
  total: number
  results: { questionId: number; isCorrect: boolean; correctAnswer: string[] }[]
  // Lời thoại chỉ được gửi về sau khi nộp bài
  transcript: string
}

export const fetchPassages = () => api<{ items: { id: number; topic: string; title: string; level: string | null }[] }>('/listening/passages')
export const fetchListeningHistory = () =>
  api<{ items: { id: number; passageId: number; topic: string; title: string; score: number; total: number; createdAt: string }[] }>('/listening/history')
export const fetchPassage = (id: number) => api<ListeningPassage>(`/listening/passages/${id}`)
export const playPassage = (id: number) => api<PlayResult>(`/listening/passages/${id}/play`, { method: 'POST', body: {} })

export function fetchNext(topic: string, level: string | null, opts: { exclude?: number; seen?: number[] } = {}) {
  const params = new URLSearchParams({ topic })
  if (level) params.set('level', level)
  if (opts.exclude) params.set('exclude', String(opts.exclude))
  if (opts.seen?.length) params.set('seen', opts.seen.join(','))
  return api<{ passageId: number | null }>(`/listening/next?${params}`)
}

export const submitAnswers = (id: number, answers: Record<number, AnswerValue>, durationSeconds: number) =>
  api<ListeningSubmitResult>(`/listening/passages/${id}/submit`, { method: 'POST', body: { answers, durationSeconds } })
