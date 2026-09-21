import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { QUESTIONS_PER_QUIZ } from '../vocabulary.logic';

export class QuizAnswerDto {
  @IsInt()
  @Min(1)
  vocabularyId!: number;

  // Câu bỏ trống vẫn hợp lệ (tính là sai) - giống bản Laravel
  @IsString()
  @MaxLength(255)
  answer!: string;
}

export class SubmitQuizDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(QUESTIONS_PER_QUIZ)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers!: QuizAnswerDto[];

  // Thời gian làm bài (giây) do trình duyệt đo - chỉ ảnh hưởng thống kê của chính user đó
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  durationSeconds?: number;
}
