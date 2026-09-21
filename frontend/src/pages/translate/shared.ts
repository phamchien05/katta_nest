import type { Direction } from '../../api/translate'

export const DIRECTION_KEY = 'katta_translate_direction'
export const DIRECTIONS: readonly Direction[] = ['en_vi', 'vi_en']

export const directionLabel = (direction: Direction) => (direction === 'en_vi' ? 'EN → VI' : 'VI → EN')

// Màu theo điểm: >= 70 xanh, >= 40 vàng, còn lại đỏ (class viết nguyên văn để Tailwind quét thấy)
export function scoreTone(score: number) {
  if (score >= 70) return { badge: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-600' }
  if (score >= 40) return { badge: 'bg-amber-100 text-amber-600', text: 'text-amber-500' }
  return { badge: 'bg-rose-100 text-katta-accent', text: 'text-katta-accent' }
}
