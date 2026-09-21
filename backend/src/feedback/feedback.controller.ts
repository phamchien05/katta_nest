import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { users } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFeedbackDto } from './dto/feedback.dto';
import { FeedbackService, MAX_SCREENSHOT_BYTES } from './feedback.service';

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  async list(@CurrentUser() user: users) {
    return { items: await this.feedback.list(user.id) };
  }

  // multipart/form-data: category, title, message, contextUrl? + screenshot? (tối đa 5MB)
  @Post()
  @UseInterceptors(
    FileInterceptor('screenshot', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SCREENSHOT_BYTES, files: 1 },
    }),
  )
  create(
    @CurrentUser() user: users,
    @Body() dto: CreateFeedbackDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.feedback.create(user.id, dto, file);
  }

  @Get(':id/screenshot')
  async screenshot(
    @CurrentUser() user: users,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { absolute, mime } = await this.feedback.screenshotFile(user.id, id);
    await new Promise<void>((done, fail) => {
      res.sendFile(
        absolute,
        {
          headers: {
            'Content-Type': mime,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'private, max-age=3600',
          },
        },
        (err) => {
          if (!err) return done();
          // File biến mất khỏi ổ đĩa (vd chưa chép ảnh cũ sang) -> coi như không có ảnh
          fail(new NotFoundException());
        },
      );
    });
  }
}
