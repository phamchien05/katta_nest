import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { users } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { requireLevel } from '../common/levels';
import { GradeDto, PassageQueryDto } from './dto/translate.dto';
import { TRANSLATE_LEVELS } from './translate.logic';
import { TranslateService } from './translate.service';

@Controller('translate')
@UseGuards(JwtAuthGuard)
export class TranslateController {
  constructor(private readonly translate: TranslateService) {}

  @Get('levels')
  levels() {
    return { levels: TRANSLATE_LEVELS };
  }

  @Get('history')
  async history(@CurrentUser() user: users) {
    return { items: await this.translate.history(user.id) };
  }

  @Get(':level/passage')
  async passage(
    @CurrentUser() user: users,
    @Param('level') level: string,
    @Query() query: PassageQueryDto,
  ) {
    const passage = await this.translate.pickPassage(
      user,
      requireLevel(level, TRANSLATE_LEVELS),
      query.direction ?? 'en_vi',
      { passageId: query.passage, excludeId: query.exclude },
    );
    return { passage };
  }

  @Post('grade')
  @HttpCode(200)
  grade(@CurrentUser() user: users, @Body() dto: GradeDto) {
    return this.translate.grade(
      user,
      dto.passageId,
      dto.translation,
      dto.durationSeconds,
    );
  }
}
