import { api } from './client'

export const TRANSLATE_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type TranslateLevel = (typeof TRANSLATE_LEVELS)[number]

export type Direction = 'en_vi' | 'vi_en'

export function isTranslateLevel(value: string | undefined): value is TranslateLevel {
  return (TRANSLATE_LEVELS as readonly string[]).includes(value ?? '')
}

export interface Passage {
  id: number
  level: string
  direction: Direction
  sourceText: string
}

export interface HistoryItem {
  id: number
  passageId: number
  score: number | null
  level: string
  direction: Direction
  sourceText: string
  createdAt: string
}

export interface Grade {
  score: number
  feedback: string | null
  referenceTranslation: string | null
  issues: string[]
  gradedBy: 'ai' | 'simple'
}

export const fetchHistory = () => api<{ items: HistoryItem[] }>('/translate/history')

export function fetchPassage(level: TranslateLevel, direction: Direction, opts: { passage?: number; exclude?: number } = {}) {
  const params = new URLSearchParams({ direction })
  if (opts.passage) params.set('passage', String(opts.passage))
  if (opts.exclude) params.set('exclude', String(opts.exclude))
  return api<{ passage: Passage | null }>(`/translate/${level}/passage?${params}`)
}

export const gradeTranslation = (passageId: number, translation: string, durationSeconds: number) =>
  api<Grade>('/translate/grade', { method: 'POST', body: { passageId, translation, durationSeconds } })
