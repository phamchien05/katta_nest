import { api } from './client'
import type { AnswerValue } from '../lib/answers'

export const PRACTICE_TOPICS = ['parts-of-speech', 'tenses', 'sentence-structures', 'question-forms', 'common-structures'] as const

export interface TopicNode {
  id: number
  parentId: number | null
  title: string
  slug: string
  order: number
  hasContent: boolean
}

export interface TopicContent {
  id: number
  title: string
  slug: string
  contentEn: string | null
  contentVi: string | null
}

export interface SetHistoryItem {
  id: number
  topicKey: string
  score: number | null
  total: number | null
  completedAt: string | null
}

export interface SetQuestion {
  id: number
  type: 'fill' | 'mcq' | 'multi'
  question: string
  options: string[]
}

export interface QuestionOutcome {
  questionId: number
  isCorrect: boolean
  correctAnswer: string[]
}

export interface QuestionSet {
  id: number
  topicKey: string
  status: 'in_progress' | 'completed' | 'available'
  questions: SetQuestion[]
  // Chỉ có khi đã nộp bài (status = completed)
  answers?: Record<string, AnswerValue>
  score?: number
  total?: number
  results?: QuestionOutcome[]
}

export const fetchTopics = () => api<{ topics: TopicNode[] }>('/grammar/topics')
export const fetchTopic = (slug: string) => api<TopicContent>(`/grammar/topics/${encodeURIComponent(slug)}`)
export const fetchSetHistory = () => api<{ items: SetHistoryItem[] }>('/grammar/practice/history')
export const startPractice = (topicKey: string) => api<{ setId: number }>(`/grammar/practice/${topicKey}/start`, { method: 'POST', body: {} })
export const fetchSet = (id: number) => api<QuestionSet>(`/grammar/practice/sets/${id}`)
export const submitSet = (id: number, answers: Record<number, AnswerValue>, durationSeconds: number) =>
  api<{ score: number; total: number; results: QuestionOutcome[] }>(`/grammar/practice/sets/${id}/submit`, {
    method: 'POST',
    body: { answers, durationSeconds },
  })
