import { api } from './client'

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type Level = (typeof LEVELS)[number]

export function isLevel(value: string | undefined): value is Level {
  return (LEVELS as readonly string[]).includes(value ?? '')
}

export interface QuizWord {
  id: number
  word: string
  partOfSpeech: string | null
  ipa: string | null
}

export interface QuizResultItem {
  vocabularyId: number
  word: string
  ipa: string | null
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
}

export interface QuizResult {
  level: Level
  score: number
  total: number
  results: QuizResultItem[]
}

export const fetchQuiz = (level: Level) =>
  api<{ level: Level; questions: QuizWord[] }>(`/vocabulary/${level}/quiz`)

export const submitQuiz = (level: Level, answers: { vocabularyId: number; answer: string }[], durationSeconds: number) =>
  api<QuizResult>(`/vocabulary/${level}/submit`, { method: 'POST', body: { answers, durationSeconds } })
