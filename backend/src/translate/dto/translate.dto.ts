import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DIRECTIONS, type Direction } from '../translate.logic';

export class PassageQueryDto {
  @IsOptional()
  @IsIn(DIRECTIONS)
  direction?: Direction;

  // "Dịch lại" một đoạn cụ thể (từ tab Đã dịch)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  passage?: number;

  // "Đoạn khác": loại đoạn đang xem ra khỏi lượt chọn
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  exclude?: number;
}

export class GradeDto {
  @IsInt()
  @Min(1)
  passageId!: number;

  // Chặn bài dán quá dài (tốn token Gemini) - đoạn gốc chỉ khoảng 100-160 từ
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  translation!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  durationSeconds?: number;
}
