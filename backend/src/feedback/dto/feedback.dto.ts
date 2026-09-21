import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const CATEGORIES = ['bug', 'suggestion', 'other'] as const;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// Gửi dạng multipart/form-data (kèm ảnh) nên mọi trường tới dưới dạng chuỗi
export class CreateFeedbackDto {
  @IsIn(CATEGORIES)
  category!: (typeof CATEGORIES)[number];

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message!: string;

  // Trang người dùng đang đứng trước khi mở form (để biết lỗi xảy ra ở đâu) - do trình duyệt tự gửi kèm
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  contextUrl?: string;
}
