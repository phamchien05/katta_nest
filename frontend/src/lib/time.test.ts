import { describe, expect, it } from 'vitest'
import { daysInMonth, formatDateTime, formatDuration, formatRelative, formatStudyTime, greetingFor, leadingBlanks, shiftMonth } from './time'

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

describe('formatDuration', () => {
  it('dưới 1 giờ là phút, từ 1 giờ là "Xh Ym" (làm tròn phút)', () => {
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(89)).toBe('1m')
    expect(formatDuration(45 * 60)).toBe('45m')
    expect(formatDuration(3600)).toBe('1h 0m')
    expect(formatDuration(90 * 60)).toBe('1h 30m')
    expect(formatDuration(125 * 60)).toBe('2h 5m')
  })
})

describe('formatDateTime', () => {
  it('dd/mm/yyyy HH:mm, có số 0 đệm', () => {
    expect(formatDateTime(new Date(2026, 0, 5, 7, 3))).toBe('05/01/2026 07:03')
    expect(formatDateTime(new Date(2026, 11, 31, 23, 59))).toBe('31/12/2026 23:59')
  })
})

describe('lịch tháng', () => {
  it('leadingBlanks: ngày 1 rơi đúng cột Thứ 2..Chủ nhật', () => {
    expect(leadingBlanks(2026, 9)).toBe(1) // 1/9/2026 là Thứ Ba
    expect(leadingBlanks(2026, 6)).toBe(0) // 1/6/2026 là Thứ Hai
    expect(leadingBlanks(2026, 3)).toBe(6) // 1/3/2026 là Chủ nhật
  })

  it('daysInMonth kể cả năm nhuận', () => {
    expect(daysInMonth(2026, 9)).toBe(30)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2026, 12)).toBe(31)
  })

  it('shiftMonth: chuyển qua ranh giới năm', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth(2026, 9, 1)).toEqual({ year: 2026, month: 10 })
    expect(shiftMonth(2026, 9, -9)).toEqual({ year: 2025, month: 12 })
  })
})
