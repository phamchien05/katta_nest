import { useCallback, useState } from 'react'

// Đọc/ghi localStorage an toàn: có thể bị chặn (chế độ riêng tư) hoặc chứa giá trị lạ, khi đó dùng giá trị mặc định
export function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return (allowed as readonly string[]).includes(value ?? '') ? (value as T) : fallback
  } catch {
    return fallback
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // không lưu được thì thôi - chỉ mất tính năng "nhớ lựa chọn"
  }
}

// useState có nhớ lại lựa chọn giữa các lần mở trang
export function useStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const [value, setValue] = useState<T>(() => readStored(key, allowed, fallback))
  const update = useCallback(
    (next: T) => {
      setValue(next)
      writeStored(key, next)
    },
    [key],
  )
  return [value, update] as const
}
