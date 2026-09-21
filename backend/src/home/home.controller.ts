import { Controller, Get, UseGuards } from '@nestjs/common';
import type { users } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HomeService } from './home.service';

@Controller('home')
@UseGuards(JwtAuthGuard)
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  summary(@CurrentUser() user: users) {
    return this.home.summary(user.id);
  }
}
