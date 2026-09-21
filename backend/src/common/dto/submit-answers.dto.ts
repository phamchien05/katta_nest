import { IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

// Nộp bài trắc nghiệm/điền từ (Đọc hiểu, Ngữ pháp, Nghe): toàn bộ đáp án gửi 1 lần
export class SubmitAnswersDto {
  // { "<questionId>": "câu trả lời" | ["đáp án 1", "đáp án 2"] } - kiểm tra chi tiết từng phần tử ở common/quiz.ts (cleanAnswers)
  @IsObject()
  answers!: Record<string, unknown>;

  // Thời gian làm bài (giây) do trình duyệt đo - chỉ ảnh hưởng thống kê của chính user đó
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  durationSeconds?: number;
}
