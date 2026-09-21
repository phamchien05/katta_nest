import { IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

export class SubmitSetDto {
  // { "<questionId>": "câu trả lời" | ["đáp án 1", "đáp án 2"] } - kiểm tra chi tiết từng phần tử ở common/quiz.ts
  @IsObject()
  answers!: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  durationSeconds?: number;
}
