import { describe, expect, it } from 'vitest'
import { formatRelative, formatStudyTime, greetingFor } from './time'

describe('greetingFor', () => {
  it('chia buổi theo giờ: <12 sáng, <18 chiều, còn lại tối', () => {
    expect(greetingFor(0)).toBe('morning')
    expect(greetingFor(11)).toBe('morning')
    expect(greetingFor(12)).toBe('afternoon')
    expect(greetingFor(17)).toBe('afternoon')
    expect(greetingFor(18)).toBe('evening')
    expect(greetingFor(23)).toBe('evening')
  })
})

describe('formatStudyTime', () => {
  it('dưới 1 giờ hiển thị phút', () => {
    expect(formatStudyTime(0)).toBe('0m')
    expect(formatStudyTime(59)).toBe('0m')
    expect(formatStudyTime(45 * 60)).toBe('45m')
    expect(formatStudyTime(59 * 60 + 59)).toBe('59m')
  })

  it('từ 1 giờ trở lên hiển thị giờ + phút hai chữ số', () => {
    expect(formatStudyTime(3600)).toBe('1h00')
    expect(formatStudyTime(90 * 60)).toBe('1h30')
    expect(formatStudyTime(125 * 60)).toBe('2h05')
  })
})

describe('formatRelative', () => {
  const now = new Date('2026-09-21T10:00:00Z')
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000)

  it('dưới 1 phút là "bây giờ"', () => {
    expect(formatRelative(ago(20), now, 'en')).toBe('now')
    expect(formatRelative(ago(20), now, 'vi')).toBe('bây giờ')
  })

  it('chọn đơn vị phù hợp (tiếng Anh)', () => {
    expect(formatRelative(ago(5 * 60), now, 'en')).toBe('5 minutes ago')
    expect(formatRelative(ago(3 * 3600), now, 'en')).toBe('3 hours ago')
    expect(formatRelative(ago(24 * 3600), now, 'en')).toBe('yesterday')
    expect(formatRelative(ago(3 * 24 * 3600), now, 'en')).toBe('3 days ago')
    expect(formatRelative(ago(60 * 24 * 3600), now, 'en')).toBe('2 months ago')
  })

  it('tiếng Việt', () => {
    expect(formatRelative(ago(5 * 60), now, 'vi')).toBe('5 phút trước')
    expect(formatRelative(ago(2 * 3600), now, 'vi')).toBe('2 giờ trước')
  })
})
