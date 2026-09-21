import { ACCEPTED_IMAGE_TYPES, MAX_SCREENSHOT_BYTES } from '../api/feedback'

export type ScreenshotProblem = 'type' | 'size'

// Kiểm tra sơ bộ ở trình duyệt để báo lỗi ngay (server vẫn kiểm tra lại theo nội dung file)
export function checkScreenshot(file: { type: string; size: number }): ScreenshotProblem | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'type'
  if (file.size > MAX_SCREENSHOT_BYTES) return 'size'
  return null
}

// Lấy file ảnh đầu tiên từ sự kiện dán (Ctrl+V) - null nếu nội dung dán không có ảnh
export function imageFromClipboard(items: ArrayLike<{ kind: string; type: string; getAsFile: () => File | null }>): File | null {
  for (const item of Array.from(items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile()
  }
  return null
}
