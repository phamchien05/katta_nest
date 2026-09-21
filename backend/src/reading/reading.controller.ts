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
import { NextQueryDto, SubmitAnswersDto } from './dto/reading.dto';
import { ReadingService } from './reading.service';

@Controller('reading')
@UseGuards(JwtAuthGuard)
export class ReadingController {
  constructor(private readonly reading: ReadingService) {}

  @Get('passages')
  async passages() {
    return { items: await this.reading.listPassages() };
  }

  @Get('history')
  async history(@CurrentUser() user: users) {
    return { items: await this.reading.history(user.id) };
  }

  // Xin id của 1 bài chưa xem để mở (topic + level, hoặc "bài tiếp theo" khi truyền exclude)
  @Get('next')
  async next(@CurrentUser() user: users, @Query() q: NextQueryDto) {
    return {
      passageId: await this.reading.pickUnseen(
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
    return this.reading.getPassage(user, id);
  }

  @Post('passages/:id/submit')
  @HttpCode(200)
  submit(
    @CurrentUser() user: users,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitAnswersDto,
  ) {
    return this.reading.submit(user.id, id, dto.answers, dto.durationSeconds);
  }
}
