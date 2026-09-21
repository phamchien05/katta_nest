// Đáp án của 1 câu: chuỗi (fill/boolean/mcq) hoặc mảng chuỗi (multi)
export type AnswerValue = string | string[]

// Câu đã có đáp án chưa (chuỗi không rỗng hoặc mảng có ít nhất 1 lựa chọn) - dùng để bật nút "Nộp bài"
export function isAnswered(value: AnswerValue | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : (value ?? '').trim() !== ''
}
