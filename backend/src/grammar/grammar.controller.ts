import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { users } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { requireLevel } from '../common/levels';
import { SubmitAnswersDto } from '../common/dto/submit-answers.dto';
import { PRACTICE_TOPIC_KEYS } from './grammar.logic';
import { GrammarService } from './grammar.service';

@Controller('grammar')
@UseGuards(JwtAuthGuard)
export class GrammarController {
  constructor(private readonly grammar: GrammarService) {}

  // Phần A - lý thuyết
  @Get('topics')
  async topics() {
    return { topics: await this.grammar.topics() };
  }

  @Get('topics/:slug')
  topic(@Param('slug') slug: string) {
    return this.grammar.topic(slug);
  }

  // Phần B - luyện tập
  @Get('practice/history')
  async history(@CurrentUser() user: users) {
    return { items: await this.grammar.history(user.id) };
  }

  @Post('practice/:topicKey/start')
  @HttpCode(200)
  async start(@CurrentUser() user: users, @Param('topicKey') topicKey: string) {
    const setId = await this.grammar.start(
      user,
      requireLevel(topicKey, PRACTICE_TOPIC_KEYS),
    );
    return { setId };
  }

  @Get('practice/sets/:id')
  set(@CurrentUser() user: users, @Param('id', ParseIntPipe) id: number) {
    return this.grammar.getSet(user, id);
  }

  @Post('practice/sets/:id/submit')
  @HttpCode(200)
  submit(
    @CurrentUser() user: users,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitAnswersDto,
  ) {
    return this.grammar.submit(user, id, dto.answers, dto.durationSeconds);
  }
}
