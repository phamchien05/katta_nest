import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateSettingsDto {
  @IsIn(['en', 'vi'])
  locale!: 'en' | 'vi';

  // Để trống (hoặc không gửi) = giữ nguyên key đã lưu; chỉ ghi đè khi người dùng nhập giá trị mới
  @IsOptional()
  @Transform(trim)
  @ValidateIf((o: UpdateSettingsDto) => o.geminiApiKey !== '')
  @IsString()
  @MinLength(10)
  @MaxLength(255)
  geminiApiKey?: string;
}

export class UpdateProfileDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(72)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

export class DeleteAccountDto {
  @IsString()
  @MaxLength(72)
  password!: string;
}
