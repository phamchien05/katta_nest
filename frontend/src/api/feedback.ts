import { api } from './client'

export const CATEGORIES = ['bug', 'suggestion', 'other'] as const
export type Category = (typeof CATEGORIES)[number]

export interface FeedbackItem {
  id: number
  category: string
  title: string
  message: string
  hasScreenshot: boolean
  contextUrl: string | null
  status: string
  createdAt: string | null
}

// Ảnh tối đa 5MB, chỉ PNG/JPEG/GIF/WebP (server kiểm tra lại theo nội dung file)
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export const fetchFeedback = () => api<{ items: FeedbackItem[] }>('/feedback')

export function sendFeedback(input: { category: Category; title: string; message: string; contextUrl: string | null; screenshot: File | null }) {
  const form = new FormData()
  form.set('category', input.category)
  form.set('title', input.title)
  form.set('message', input.message)
  if (input.contextUrl) form.set('contextUrl', input.contextUrl.slice(0, 255))
  if (input.screenshot) form.set('screenshot', input.screenshot)
  return api<{ id: number }>('/feedback', { method: 'POST', body: form })
}

export const screenshotUrl = (id: number) => `/api/feedback/${id}/screenshot`
