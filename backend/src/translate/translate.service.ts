import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { users } from '@prisma/client';
import { pickRandom } from '../common/levels';
import { GeminiService } from '../gemini/gemini.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildGenerationPrompt,
  buildGradingPrompt,
  Direction,
  Grade,
  GRADING_SCHEMA,
  normalizeAiGrade,
  simpleGrade,
  SIMPLE_GRADE_NOTICE,
  TranslateLevel,
} from './translate.logic';

export interface PassageView {
  id: number;
  level: string;
  direction: string;
  sourceText: string;
}

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  // Các lần bù kho đang chạy ngầm (chỉ để test chờ được; production không cần đụng tới)
  private readonly inflight = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
  ) {}

  // Tab "Đã dịch": các lần nộp bài của user, mới nhất trước
  async history(userId: bigint) {
    const rows = await this.prisma.translation_submissions.findMany({
      where: { user_id: userId },
      include: { translation_passages: true },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => ({
      id: Number(r.id),
      passageId: Number(r.passage_id),
      score: r.ai_score,
      level: r.translation_passages.level,
      direction: r.translation_passages.direction,
      sourceText: r.translation_passages.source_text,
      createdAt: r.created_at,
    }));
  }

  // Lấy 1 đoạn để làm. Ưu tiên đoạn user CHƯA từng làm (không lặp lại), hết thì random toàn bộ.
  // `passageId` = "Dịch lại" đoạn cụ thể (chỉ nhận nếu đúng level + chiều dịch).
  async pickPassage(
    user: users,
    level: TranslateLevel,
    direction: Direction,
    opts: { passageId?: number; excludeId?: number } = {},
  ): Promise<PassageView | null> {
    let passage = null;

    if (opts.passageId) {
      passage = await this.prisma.translation_passages.findFirst({
        where: { id: BigInt(opts.passageId), level, direction },
      });
    }

    if (!passage) {
      const attempted = await this.prisma.translation_submissions.findMany({
        where: { user_id: user.id },
        select: { passage_id: true },
      });
      const attemptedIds = new Set(attempted.map((a) => a.passage_id));

      const pool = await this.prisma.translation_passages.findMany({
        where: {
          level,
          direction,
          ...(opts.excludeId ? { id: { not: BigInt(opts.excludeId) } } : {}),
        },
      });
      const fresh = pool.filter((p) => !attemptedIds.has(p.id));
      passage = pickRandom(fresh.length > 0 ? fresh : pool) ?? null;
    }

    // Vừa "lấy" 1 đoạn ra làm -> âm thầm nhờ Gemini sinh 1 đoạn mới bù vào kho (không chặn request)
    this.replenishInBackground(user, level, direction);

    return passage
      ? {
          id: Number(passage.id),
          level: passage.level,
          direction: passage.direction,
          sourceText: passage.source_text,
        }
      : null;
  }

  async grade(
    user: users,
    passageId: number,
    translation: string,
    durationSeconds?: number,
  ): Promise<Grade & { submissionId: number }> {
    const text = translation.trim();
    if (!text) throw new BadRequestException('Translation must not be empty.');

    const passage = await this.prisma.translation_passages.findUnique({
      where: { id: BigInt(passageId) },
    });
    if (!passage) throw new NotFoundException('Passage not found.');

    // AI chấm trước; không có key hoặc Gemini lỗi thì chấm tạm theo độ dài
    const apiKey = this.gemini.keyFor(user);
    const aiGrade = apiKey
      ? normalizeAiGrade(
          await this.gemini.generate(
            apiKey,
            buildGradingPrompt(
              passage.direction as Direction,
              passage.source_text,
              text,
            ),
            GRADING_SCHEMA,
          ),
        )
      : null;
    const grade = aiGrade ?? simpleGrade(text, passage.source_text);

    const now = new Date();
    const submission = await this.prisma.$transaction(async (tx) => {
      const created = await tx.translation_submissions.create({
        data: {
          user_id: user.id,
          passage_id: passage.id,
          user_translation: text,
          ai_score: grade.score,
          ai_feedback: grade.feedback ?? SIMPLE_GRADE_NOTICE,
          created_at: now,
          updated_at: now,
        },
      });
      await tx.study_sessions.create({
        data: {
          user_id: user.id,
          type: 'translate',
          duration_seconds: Math.max(1, durationSeconds ?? 0),
          completed_at: now,
          created_at: now,
          updated_at: now,
        },
      });
      return created;
    });

    return { ...grade, submissionId: Number(submission.id) };
  }

  // Sinh 1 đoạn mới bù vào kho của (level, direction). Lỗi chỉ ghi log - không bao giờ ảnh hưởng người dùng.
  private replenishInBackground(
    user: users,
    level: TranslateLevel,
    direction: Direction,
  ): void {
    const apiKey = this.gemini.keyFor(user);
    if (!apiKey) return;

    const job = this.replenish(apiKey, level, direction)
      .catch((e: unknown) =>
        this.logger.warn(
          `Replenish failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      )
      .finally(() => this.inflight.delete(job));
    this.inflight.add(job);
  }

  private async replenish(
    apiKey: string,
    level: TranslateLevel,
    direction: Direction,
  ): Promise<void> {
    // Chỉ thử lại 1 lần (không phải 3) - đây là việc ngầm, không nên giữ kết nối quá lâu
    const passages = await this.gemini.generateStringArray(
      apiKey,
      buildGenerationPrompt(level, direction, 1),
      { maxRetries: 1 },
    );
    const now = new Date();
    for (const raw of passages ?? []) {
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text) {
        await this.prisma.translation_passages.create({
          data: {
            level,
            direction,
            source_text: text,
            created_at: now,
            updated_at: now,
          },
        });
      }
    }
  }

  // Dùng trong test: chờ các lần bù kho chạy ngầm xong
  async whenIdle(): Promise<void> {
    await Promise.all([...this.inflight]);
  }
}
