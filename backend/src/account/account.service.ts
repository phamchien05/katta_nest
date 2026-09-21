import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { users } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { toPublicUser } from '../auth/auth.types';
import { SecretBox } from '../common/secret-box';
import { FeedbackService } from '../feedback/feedback.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ChangePasswordDto,
  UpdateProfileDto,
  UpdateSettingsDto,
} from './dto/account.dto';

const BCRYPT_ROUNDS = 12;

// Cài đặt ứng dụng (ngôn ngữ, API key Gemini riêng) và thông tin tài khoản (tên/email, mật khẩu, xoá tài khoản)
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretBox,
    private readonly feedback: FeedbackService,
  ) {}

  // ---------- Cài đặt ----------

  // Không bao giờ trả lại key thật đã lưu - chỉ báo "có/không"
  getSettings(user: Pick<users, 'locale' | 'gemini_api_key'>) {
    return {
      locale: user.locale,
      hasOwnGeminiKey: !!user.gemini_api_key,
    };
  }

  async updateSettings(user: users, dto: UpdateSettingsDto) {
    const data: {
      locale: string;
      updated_at: Date;
      gemini_api_key?: string;
    } = { locale: dto.locale, updated_at: new Date() };

    if (dto.geminiApiKey) {
      if (!this.secrets.available) {
        throw new ServiceUnavailableException(
          'Server is not configured to store API keys (APP_KEY missing).',
        );
      }
      data.gemini_api_key = this.secrets.encrypt(dto.geminiApiKey);
    }
    const saved = await this.prisma.users.update({
      where: { id: user.id },
      data,
    });
    return this.getSettings(saved);
  }

  async removeGeminiKey(user: users) {
    const saved = await this.prisma.users.update({
      where: { id: user.id },
      data: { gemini_api_key: null, updated_at: new Date() },
    });
    return this.getSettings(saved);
  }

  // ---------- Tài khoản ----------

  async updateProfile(user: users, dto: UpdateProfileDto) {
    const email = dto.email.toLowerCase();
    if (email !== user.email) {
      const taken = await this.prisma.users.findUnique({ where: { email } });
      if (taken && taken.id !== user.id) {
        throw new ConflictException('Email này đã được đăng ký.');
      }
    }
    const saved = await this.prisma.users.update({
      where: { id: user.id },
      data: { name: dto.name, email, updated_at: new Date() },
    });
    return toPublicUser(saved);
  }

  async changePassword(user: users, dto: ChangePasswordDto): Promise<void> {
    await this.requirePassword(user, dto.currentPassword);
    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        updated_at: new Date(),
      },
    });
  }

  async deleteAccount(user: users, password: string): Promise<void> {
    await this.requirePassword(user, password);
    const screenshots = await this.feedback.screenshotPathsOf(user.id);

    await this.prisma.$transaction(async (tx) => {
      // Bộ đề ngữ pháp không tự xoá theo user (khoá ngoại không cascade): trả bộ đang làm dở về kho để người khác
      // dùng, xoá bộ đã làm xong (kèm câu hỏi) rồi mới xoá tài khoản.
      await tx.grammar_question_sets.updateMany({
        where: { user_id: user.id, status: 'in_progress' },
        data: {
          status: 'available',
          user_id: null,
          started_at: null,
          replenish_dispatched: false,
          updated_at: new Date(),
        },
      });
      await tx.grammar_question_sets.deleteMany({
        where: { user_id: user.id },
      });
      await tx.users.delete({ where: { id: user.id } });
    });

    // Phản hồi của user đã bị xoá theo cascade; dọn nốt các file ảnh chụp màn hình còn trên đĩa
    await this.feedback.removeScreenshots(screenshots);
  }

  private async requirePassword(user: users, password: string): Promise<void> {
    if (!(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Mật khẩu không đúng.');
    }
  }
}
