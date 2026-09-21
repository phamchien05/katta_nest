import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import type { users } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { requireLevel } from '../common/levels';
import { PROGRESS_TYPES, ProgressService } from './progress.service';

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get()
  async list(@CurrentUser() user: users) {
    return { items: await this.progress.list(user.id) };
  }

  @Get(':type/:id')
  detail(
    @CurrentUser() user: users,
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.progress.getDetail(
      user.id,
      requireLevel(type, PROGRESS_TYPES),
      id,
    );
  }
}
