import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { users } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubmitAnswersDto } from '../common/dto/submit-answers.dto';
import { NextQueryDto } from './dto/listening.dto';
import { ListeningService } from './listening.service';

@Controller('listening')
@UseGuards(JwtAuthGuard)
export class ListeningController {
  constructor(private readonly listening: ListeningService) {}

  @Get('passages')
  async passages() {
    return { items: await this.listening.listPassages() };
  }

  @Get('history')
  async history(@CurrentUser() user: users) {
    return { items: await this.listening.history(user.id) };
  }

  @Get('next')
  async next(@CurrentUser() user: users, @Query() q: NextQueryDto) {
    return {
      passageId: await this.listening.pickUnseen(
        user.id,
        q.topic,
        q.level,
        q.exclude,
        q.seen,
      ),
    };
  }

  @Get('passages/:id')
  passage(@CurrentUser() user: users, @Param('id', ParseIntPipe) id: number) {
    return this.listening.getPassage(user, id);
  }

  // Bấm nghe: nhận lời thoại để đọc thành giọng nói (trừ 1 lượt nghe)
  @Post('passages/:id/play')
  @HttpCode(200)
  play(@CurrentUser() user: users, @Param('id', ParseIntPipe) id: number) {
    return this.listening.play(user, id);
  }

  @Post('passages/:id/submit')
  @HttpCode(200)
  submit(
    @CurrentUser() user: users,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitAnswersDto,
  ) {
    return this.listening.submit(user.id, id, dto.answers, dto.durationSeconds);
  }
}
