import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { users } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { isLevel, Level, LEVELS } from './vocabulary.logic';
import { VocabularyService } from './vocabulary.service';

// Cấp độ không hợp lệ -> 404 (giống ->whereIn('level', LEVELS) + abort 404 bên Laravel)
function parseLevel(raw: string): Level {
  if (!isLevel(raw)) {
    throw new NotFoundException(`Unknown level "${raw}".`);
  }
  return raw;
}

@Controller('vocabulary')
@UseGuards(JwtAuthGuard)
export class VocabularyController {
  constructor(private readonly vocabulary: VocabularyService) {}

  @Get('levels')
  levels() {
    return { levels: LEVELS };
  }

  @Get(':level/quiz')
  async quiz(@Param('level') level: string) {
    const parsed = parseLevel(level);
    return {
      level: parsed,
      questions: await this.vocabulary.startQuiz(parsed),
    };
  }

  @Post(':level/submit')
  @HttpCode(200)
  submit(
    @CurrentUser() user: users,
    @Param('level') level: string,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.vocabulary.submitQuiz(
      user.id,
      parseLevel(level),
      dto.answers,
      dto.durationSeconds,
    );
  }
}
