import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { TOPICS, type Topic } from '../listening.logic';

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

  // Chỉ dùng cho topic "general" (các topic khác có cấp độ cố định)
  @IsOptional()
  @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  level?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  exclude?: number;

  @IsOptional()
  @Transform(toIdList)
  seen?: number[];
}
