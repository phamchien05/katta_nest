import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { users } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { StatisticsService } from './statistics.service';

@Controller('statistics')
@UseGuards(JwtAuthGuard)
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get()
  overview(@CurrentUser() user: users) {
    return this.statistics.overview(user.id);
  }

  @Get('calendar')
  calendar(@CurrentUser() user: users, @Query() q: CalendarQueryDto) {
    return this.statistics.calendar(user.id, q.year, q.month);
  }
}
