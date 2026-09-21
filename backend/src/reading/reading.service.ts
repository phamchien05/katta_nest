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
  buildPrompt,
  GENERAL_LEVELS,
  isCorrect,
  parseStringArray,
  SCHEMA,
  Topic,
  UserAnswer,
  validateGenerated,
} from './reading.logic';

const MAX_ANSWER_LENGTH = 500;

@Injectable()
export class ReadingService {
  private readonly logger = new Logger(ReadingService.name);
  private readonly inflight = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
  ) {}

  // Danh sách bài để user chọn (mới nhất trước). "general" không liệt kê từng bài - đi theo cấp độ CEFR.
  async listPassages() {
    const rows = await this.prisma.reading_passages.findMany({
      where: { topic: { not: 'general' } },
      select: { id: true, topic: true, title: true, level: true },
      orderBy: { id: 'desc' },
    });
    return rows.map((r) => ({
      id: Number(r.id),
      topic: r.topic,
      title: r.title,
      level: r.level,
    }));
  }

  // Tab "Đã đọc"
  async history(userId: bigint) {
    const rows = await this.prisma.reading_submissions.findMany({
      where: { user_id: userId },
      include: { reading_passages: true },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => ({
      id: Number(r.id),
      passageId: Number(r.passage_id),
      topic: r.reading_passages.topic,
      title: r.reading_passages.title,
      score: r.score,
      total: r.total,
      createdAt: r.created_at,
    }));
  }

  // Chọn ngẫu nhiên 1 bài của topic (+ level), tránh bài user đã nộp, bài vừa xem trong phiên và bài đang xem.
  // Xem hết rồi thì rơi về random (trừ bài đang xem), rồi cuối cùng là random toàn bộ.
  async pickUnseen(
    userId: bigint,
    topic: Topic,
    level?: string,
    excludeId?: number,
    seen: number[] = [],
  ): Promise<number | null> {
    if (
      topic === 'general' &&
      !(GENERAL_LEVELS as readonly string[]).includes(level ?? '')
    ) {
      throw new BadRequestException(
        'A level (A1-C1) is required for the general topic.',
      );
    }

    const attempted = await this.prisma.reading_submissions.findMany({
      where: { user_id: userId },
      select: { passage_id: true },
    });
    const excluded = new Set<bigint>([
      ...attempted.map((a) => a.passage_id),
      ...seen.map(BigInt),
    ]);
    if (excludeId) excluded.add(BigInt(excludeId));

    const pool = await this.prisma.reading_passages.findMany({
      where: { topic, ...(level ? { level } : {}) },
      select: { id: true },
    });
    const ids = pool.map((p) => p.id);
    const notCurrent = ids.filter(
      (id) => id !== (excludeId ? BigInt(excludeId) : null),
    );

    const chosen =
      pickRandom(ids.filter((id) => !excluded.has(id))) ??
      pickRandom(notCurrent) ??
      pickRandom(ids);
    return chosen === undefined ? null : Number(chosen);
  }

  // Bài + câu hỏi để làm. KHÔNG gửi đáp án đúng xuống trình duyệt (chỉ lộ sau khi nộp bài).
  async getPassage(user: users, id: number) {
    const passage = await this.prisma.reading_passages.findUnique({
      where: { id: BigInt(id) },
      include: { reading_questions: { orderBy: { order: 'asc' } } },
    });
    if (!passage) throw new NotFoundException('Passage not found.');

    // Vừa vào làm 1 bài -> âm thầm nhờ Gemini sinh 1 bài mới bù vào kho cùng chủ đề/cấp độ
    this.replenishInBackground(
      user,
      passage.topic as Topic,
      passage.level ?? 'B2',
    );

    return {
      id: Number(passage.id),
      topic: passage.topic,
      level: passage.level,
      title: passage.title,
      content: passage.content,
      questions: passage.reading_questions.map((q) => ({
        id: Number(q.id),
        type: q.type,
        question: q.question,
        options: parseStringArray(q.options),
      })),
    };
  }

  // Chấm 1 lần cho tất cả câu. Nhận TOÀN BỘ đáp án cùng lúc (không đồng bộ từng câu) - tránh các request rời rạc ghi đè nhau.
  async submit(
    userId: bigint,
    passageId: number,
    rawAnswers: Record<string, unknown>,
    durationSeconds?: number,
  ) {
    const passage = await this.prisma.reading_passages.findUnique({
      where: { id: BigInt(passageId) },
      include: { reading_questions: { orderBy: { order: 'asc' } } },
    });
    if (!passage) throw new NotFoundException('Passage not found.');

    const answers = this.cleanAnswers(rawAnswers);
    const questions = passage.reading_questions;
    if (questions.some((q) => answers[String(q.id)] === undefined)) {
      throw new BadRequestException('Every question must be answered.');
    }

    let score = 0;
    const results = questions.map((q) => {
      const correctAnswer = parseStringArray(q.correct_answer);
      const ok = isCorrect(q.type, answers[String(q.id)], correctAnswer);
      if (ok) score++;
      return { questionId: Number(q.id), isCorrect: ok, correctAnswer };
    });

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.reading_submissions.create({
        data: {
          user_id: userId,
          passage_id: passage.id,
          score,
          total: questions.length,
          // Chỉ lưu đáp án của các câu thuộc bài này, đúng định dạng Laravel ({ "<questionId>": ... })
          answers: JSON.stringify(
            Object.fromEntries(
              questions.map((q) => [String(q.id), answers[String(q.id)]]),
            ),
          ),
          created_at: now,
          updated_at: now,
        },
      });
      await tx.study_sessions.create({
        data: {
          user_id: userId,
          type: 'reading',
          duration_seconds: Math.max(1, durationSeconds ?? 0),
          completed_at: now,
          created_at: now,
          updated_at: now,
        },
      });
    });

    return { score, total: questions.length, results };
  }

  // Chỉ nhận string hoặc mảng string ngắn - bỏ mọi thứ khác (object lồng nhau, số, null...)
  private cleanAnswers(
    raw: Record<string, unknown>,
  ): Record<string, UserAnswer> {
    const out: Record<string, UserAnswer> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' && value.length <= MAX_ANSWER_LENGTH) {
        out[key] = value;
      } else if (
        Array.isArray(value) &&
        value.length <= 10 &&
        value.every(
          (v) => typeof v === 'string' && v.length <= MAX_ANSWER_LENGTH,
        )
      ) {
        out[key] = value as string[];
      }
    }
    return out;
  }

  private replenishInBackground(
    user: users,
    topic: Topic,
    level: string,
  ): void {
    const apiKey = this.gemini.keyFor(user);
    if (!apiKey) return;

    const job = this.replenish(apiKey, topic, level)
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
    topic: Topic,
    level: string,
  ): Promise<void> {
    // Chỉ thử lại 1 lần - đây là việc ngầm, không nên giữ kết nối quá lâu
    const raw = await this.gemini.generate(
      apiKey,
      buildPrompt(topic, level),
      SCHEMA,
      {
        maxRetries: 1,
      },
    );
    const generated = validateGenerated(raw);
    if (!generated) return;

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const passage = await tx.reading_passages.create({
        data: {
          topic,
          level,
          title: generated.title,
          content: generated.content,
          created_at: now,
          updated_at: now,
        },
      });
      for (const [order, q] of generated.questions.entries()) {
        await tx.reading_questions.create({
          data: {
            passage_id: passage.id,
            type: q.type,
            question: q.question,
            options: JSON.stringify(q.options),
            correct_answer: JSON.stringify(q.correct_answer),
            order,
            created_at: now,
            updated_at: now,
          },
        });
      }
    });
  }

  // Dùng trong test: chờ các lần bù kho chạy ngầm xong
  async whenIdle(): Promise<void> {
    await Promise.all([...this.inflight]);
  }
}
