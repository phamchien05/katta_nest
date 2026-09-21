import { describe, expect, it } from 'vitest'
import { stripSpeakerLabels } from './speech'

describe('stripSpeakerLabels', () => {
  it('bỏ nhãn người nói ở đầu mỗi dòng', () => {
    expect(stripSpeakerLabels('Anna: Hello there.\nBen: Hi, Anna!')).toBe('Hello there.\nHi, Anna!')
  })

  it('nhãn có dấu chấm, dấu nối hoặc nhiều từ', () => {
    expect(stripSpeakerLabels('Dr. Smith: Good morning.\nMary-Jane: Hi.\nTour Guide: Welcome.')).toBe('Good morning.\nHi.\nWelcome.')
  })

  it('không cắt nhầm câu thường có dấu hai chấm giữa chừng', () => {
    const line = 'The time is half past three: please hurry.'
    expect(stripSpeakerLabels(line)).toBe(line)
    expect(stripSpeakerLabels('Remember the following: bring your ticket.')).toBe('Remember the following: bring your ticket.')
  })

  it('bài độc thoại không nhãn giữ nguyên', () => {
    const text = 'Welcome, everyone. Today we start at nine.'
    expect(stripSpeakerLabels(text)).toBe(text)
  })

  it('chỉ bỏ nhãn ở đầu dòng, không bỏ ở giữa dòng', () => {
    expect(stripSpeakerLabels('Anna: I asked Ben: what time?')).toBe('I asked Ben: what time?')
  })
})
