import { randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFeedbackDto } from './dto/feedback.dto';
import { detectImage, mimeForFile } from './image';

export const SCREENSHOT_DIR = 'feedback-screenshots';
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

@Injectable()
export class FeedbackService {
  private readonly uploadRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.uploadRoot = resolve(config.get<string>('UPLOAD_DIR') ?? 'uploads');
  }

  // Tab "Lịch sử": các phản hồi đã gửi, mới nhất trước
  async list(userId: bigint) {
    const rows = await this.prisma.feedback.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((f) => ({
      id: Number(f.id),
      category: f.category,
      title: f.title,
      message: f.message,
      hasScreenshot: !!f.screenshot_path,
      contextUrl: f.context_url,
      status: f.status,
      createdAt: f.created_at,
    }));
  }

  async create(
    userId: bigint,
    dto: CreateFeedbackDto,
    file?: { buffer: Buffer },
  ) {
    let screenshotPath: string | null = null;
    if (file) {
      const image = detectImage(file.buffer);
      if (!image) {
        throw new BadRequestException(
          'The screenshot must be a PNG, JPEG, GIF or WebP image.',
        );
      }
      // Tên file ngẫu nhiên do server đặt - không dùng tên client gửi (tránh ghi đè/đường dẫn độc hại)
      const name = `${randomBytes(20).toString('hex')}.${image.ext}`;
      await mkdir(join(this.uploadRoot, SCREENSHOT_DIR), { recursive: true });
      await writeFile(join(this.uploadRoot, SCREENSHOT_DIR, name), file.buffer);
      screenshotPath = `${SCREENSHOT_DIR}/${name}`;
    }

    const now = new Date();
    try {
      const created = await this.prisma.feedback.create({
        data: {
          user_id: userId,
          category: dto.category,
          title: dto.title,
          message: dto.message,
          screenshot_path: screenshotPath,
          context_url: dto.contextUrl || null,
          status: 'pending',
          created_at: now,
          updated_at: now,
        },
      });
      return { id: Number(created.id) };
    } catch (e) {
      // Lưu DB lỗi thì bỏ luôn file vừa ghi để không để lại ảnh mồ côi
      if (screenshotPath) {
        await rm(join(this.uploadRoot, screenshotPath), { force: true });
      }
      throw e;
    }
  }

  // Đường dẫn file ảnh của 1 phản hồi - chỉ chủ phản hồi mới xem được (ảnh chụp màn hình có thể chứa thông tin riêng tư)
  async screenshotFile(userId: bigint, id: number) {
    const f = await this.prisma.feedback.findFirst({
      where: { id: BigInt(id), user_id: userId },
    });
    if (!f?.screenshot_path) throw new NotFoundException();

    const absolute = resolve(this.uploadRoot, f.screenshot_path);
    const mime = mimeForFile(absolute);
    // Chặn đường dẫn thoát khỏi thư mục upload (dù dữ liệu do chính server ghi) và đuôi file lạ
    if (!absolute.startsWith(this.uploadRoot + sep) || !mime) {
      throw new NotFoundException();
    }
    return { absolute, mime };
  }

  // Đường dẫn các ảnh của 1 user - dùng khi xoá tài khoản để dọn luôn file (DB tự xoá dòng phản hồi theo cascade)
  async screenshotPathsOf(userId: bigint): Promise<string[]> {
    const rows = await this.prisma.feedback.findMany({
      where: { user_id: userId, screenshot_path: { not: null } },
      select: { screenshot_path: true },
    });
    return rows.flatMap((r) => (r.screenshot_path ? [r.screenshot_path] : []));
  }

  // Xoá file ảnh theo đường dẫn lưu trong DB (bỏ qua đường dẫn thoát khỏi thư mục upload); lỗi từng file không làm hỏng việc chính
  async removeScreenshots(paths: string[]): Promise<void> {
    await Promise.all(
      paths.map(async (p) => {
        const absolute = resolve(this.uploadRoot, p);
        if (!absolute.startsWith(this.uploadRoot + sep)) return;
        await rm(absolute, { force: true }).catch(() => undefined);
      }),
    );
  }
}
