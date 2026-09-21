// Ghi nhớ các bài user vừa lấy ra xem (kể cả chưa nộp) trong phiên trình duyệt này, để "bài tiếp theo" không random
// trúng lại. Bản Laravel giữ trong session PHP; API mới không có session nên giữ ở sessionStorage rồi gửi kèm khi xin bài.
const MAX_SEEN = 50

const keyOf = (topic: string, level: string | null) => `katta_seen_${topic}_${level ?? 'any'}`

export function getSeen(topic: string, level: string | null): number[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(keyOf(topic, level)) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

export function markSeen(topic: string, level: string | null, id: number): void {
  try {
    const next = [...getSeen(topic, level).filter((n) => n !== id), id].slice(-MAX_SEEN)
    sessionStorage.setItem(keyOf(topic, level), JSON.stringify(next))
  } catch {
    // không lưu được thì chỉ mất tính năng tránh lặp trong phiên
  }
}
