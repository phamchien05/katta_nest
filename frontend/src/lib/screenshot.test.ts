import { describe, expect, it } from 'vitest'
import { checkScreenshot, imageFromClipboard } from './screenshot'

describe('checkScreenshot', () => {
  it('chấp nhận PNG/JPEG/GIF/WebP trong giới hạn 5MB', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
      expect(checkScreenshot({ type, size: 1000 })).toBeNull()
    }
    expect(checkScreenshot({ type: 'image/png', size: 5 * 1024 * 1024 })).toBeNull()
  })

  it('từ chối loại khác (SVG, PDF, văn bản) và file quá 5MB', () => {
    expect(checkScreenshot({ type: 'image/svg+xml', size: 10 })).toBe('type')
    expect(checkScreenshot({ type: 'application/pdf', size: 10 })).toBe('type')
    expect(checkScreenshot({ type: '', size: 10 })).toBe('type')
    expect(checkScreenshot({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toBe('size')
  })
})

describe('imageFromClipboard', () => {
  const file = new File(['x'], 'shot.png', { type: 'image/png' })
  const item = (kind: string, type: string, f: File | null = file) => ({ kind, type, getAsFile: () => f })

  it('lấy file ảnh đầu tiên trong nội dung dán', () => {
    expect(imageFromClipboard([item('string', 'text/plain', null), item('file', 'image/png')])).toBe(file)
  })

  it('không có ảnh (chỉ chữ, hoặc file không phải ảnh) -> null', () => {
    expect(imageFromClipboard([item('string', 'text/plain', null)])).toBeNull()
    expect(imageFromClipboard([item('file', 'application/pdf')])).toBeNull()
    expect(imageFromClipboard([])).toBeNull()
  })
})
