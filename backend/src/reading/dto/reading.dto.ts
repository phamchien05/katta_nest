import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';
import { ALL_LEVELS, TOPICS, type Topic } from '../reading.logic';

// "1,2,3" -> [1,2,3] (bỏ phần tử không phải số dương, tối đa 50 phần tử)
const toIdList = ({ value }: { value: unknown }): number[] =>
  typeof value === 'string'
    ? value
        .split(',')
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0)
        .slice(0, 50)
    : [];

export class NextQueryDto {
  @IsIn(TOPICS)
  topic!: Topic;

  @IsOptional()
  @IsIn(ALL_LEVELS)
  level?: string;

  // Bài đang xem - luôn bị loại khỏi lượt chọn kế tiếp
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  exclude?: number;

  // Các bài user vừa lấy ra xem trong phiên (dù chưa nộp) - do trình duyệt ghi nhớ (API không có session)
  @IsOptional()
  @Transform(toIdList)
  seen?: number[];
}

export class SubmitAnswersDto {
  // { "<questionId>": "câu trả lời" | ["đáp án 1", "đáp án 2"] } - service kiểm tra chi tiết từng phần tử
  @IsObject()
  answers!: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  durationSeconds?: number;
}
