// Nhãn người nói: tối đa 3 từ, mỗi từ viết hoa (vd "Anna:", "Dr. Smith:", "Mary-Jane:") - chặt hơn bản Laravel để không
// cắt nhầm phần đầu câu thường có dấu hai chấm như "The time is half past three: please hurry."
const SPEAKER_LABEL = /^[A-Z][A-Za-z.'-]*(?: [A-Z][A-Za-z.'-]*){0,2}:\s*/gm

// Bỏ nhãn "Tên người nói:" đầu mỗi dòng để giọng đọc không đọc luôn cả nhãn đó ra
export function stripSpeakerLabels(transcript: string): string {
  return transcript.replace(SPEAKER_LABEL, '')
}

export const speechSupported = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window

// Đọc văn bản bằng giọng tiếng Anh của trình duyệt (Web Speech API - không cần file âm thanh)
export function speak(text: string, rate: number, handlers: { onStart: () => void; onEnd: () => void }): void {
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(stripSpeakerLabels(text))
  utterance.lang = 'en-US'
  utterance.rate = rate
  utterance.onstart = handlers.onStart
  utterance.onend = handlers.onEnd
  utterance.onerror = handlers.onEnd
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel()
}
