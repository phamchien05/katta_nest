import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { users } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { AUTH_COOKIE, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountService } from './account.service';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  UpdateProfileDto,
  UpdateSettingsDto,
} from './dto/account.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('settings')
  settings(@CurrentUser() user: users) {
    return this.account.getSettings(user);
  }

  @Put('settings')
  updateSettings(@CurrentUser() user: users, @Body() dto: UpdateSettingsDto) {
    return this.account.updateSettings(user, dto);
  }

  @Delete('settings/gemini-key')
  removeKey(@CurrentUser() user: users) {
    return this.account.removeGeminiKey(user);
  }

  @Patch('account/profile')
  updateProfile(@CurrentUser() user: users, @Body() dto: UpdateProfileDto) {
    return this.account.updateProfile(user, dto);
  }

  @Put('account/password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: users,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.account.changePassword(user, dto);
  }

  @Delete('account')
  @HttpCode(204)
  async deleteAccount(
    @CurrentUser() user: users,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.account.deleteAccount(user, dto.password);
    res.clearCookie(AUTH_COOKIE);
  }
}
