// Lưới "Tất cả các tính năng" ở Trang chủ. Class màu viết nguyên văn để Tailwind quét thấy và sinh CSS.
export const FEATURE_COLORS = {
  indigo: 'bg-indigo-100 text-indigo-600',
  blue: 'bg-blue-100 text-blue-600',
  amber: 'bg-amber-100 text-amber-600',
  rose: 'bg-rose-100 text-rose-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  purple: 'bg-purple-100 text-purple-600',
  pink: 'bg-pink-100 text-pink-600',
  gray: 'bg-gray-100 text-gray-400',
} as const

// `key` trùng với key trong NAV_ITEMS: tên lấy từ nav.<key>, mô tả từ home.feature_<key>_desc
export const HOME_FEATURES: { key: string; color: keyof typeof FEATURE_COLORS }[] = [
  { key: 'vocabulary', color: 'indigo' },
  { key: 'translate', color: 'blue' },
  { key: 'reading', color: 'amber' },
  { key: 'grammar', color: 'rose' },
  { key: 'idioms', color: 'yellow' },
  { key: 'ai_chat', color: 'purple' },
  { key: 'listening', color: 'pink' },
  { key: 'speaking', color: 'gray' },
]
