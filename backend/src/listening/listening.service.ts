import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { users } from '@prisma/client';
import { choosePassageId } from '../common/picker';
import { cleanAnswers, gradeAnswers, parseStringArray } from '../common/quiz';
import { GeminiService } from '../gemini/gemini.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPrompt,
  GENERAL_LEVELS,
  levelFor,
  MAX_PLAYS,
  pickScenario,
  SCHEMA,
  Topic,
  validateGenerated,
} from './listening.logic';
import { PlayCounter } from './play-counter';

@Injectable()
export class ListeningService {
  private readonly logger = new Logger(ListeningService.name);
  private readonly inflight = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly plays: PlayCounter,
  ) {}

  // Danh sách bài (mới nhất trước). "general" đi theo cấp độ CEFR nên không liệt kê từng bài.
  async listPassages() {
    const rows = await this.prisma.listening_passages.findMany({
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

  async history(userId: bigint) {
    const rows = await this.prisma.listening_submissions.findMany({
      where: { user_id: userId },
      include: { listening_passages: true },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => ({
      id: Number(r.id),
      passageId: Number(r.passage_id),
      topic: r.listening_passages.topic,
      title: r.listening_passages.title,
      score: r.score,
      total: r.total,
      createdAt: r.created_at,
    }));
  }

  // Chọn bài chưa xem (xem common/picker). Chỉ "general" mới lọc theo cấp độ - các chủ đề khác có cấp cố định.
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

    const attempted = await this.prisma.listening_submissions.findMany({
      where: { user_id: userId },
      select: { passage_id: true },
    });
    const pool = await this.prisma.listening_passages.findMany({
      where: { topic, ...(topic === 'general' ? { level } : {}) },
      select: { id: true },
    });
    const chosen = choosePassageId(
      pool.map((p) => p.id),
      { attempted: attempted.map((a) => a.passage_id), seen, excludeId },
    );
    return chosen === undefined ? null : Number(chosen);
  }

  // Bài + câu hỏi để làm. KHÔNG kèm transcript (chỉ lấy khi bấm nghe) và KHÔNG kèm đáp án đúng.
  async getPassage(user: users, id: number) {
    const passage = await this.findWithQuestions(id);

    this.replenishInBackground(user, passage.topic as Topic, passage.level);

    return {
      id: Number(passage.id),
      topic: passage.topic,
      level: passage.level,
      title: passage.title,
      maxPlays: MAX_PLAYS,
      playsLeft: Math.max(0, MAX_PLAYS - this.plays.used(user.id, id)),
      questions: passage.listening_questions.map((q) => ({
        id: Number(q.id),
        type: q.type,
        question: q.question,
        options: parseStringArray(q.options),
      })),
    };
  }

  // Trả lời thoại để trình duyệt đọc thành giọng nói. Mỗi lần gọi trừ 1 lượt nghe (tối đa MAX_PLAYS) TRÊN SERVER -
  // transcript không nhúng sẵn trong trang nên không xem trước được chữ.
  async play(user: users, id: number) {
    const passage = await this.prisma.listening_passages.findUnique({
      where: { id: BigInt(id) },
    });
    if (!passage) throw new NotFoundException('Passage not found.');

    if (!this.plays.consume(user.id, id, MAX_PLAYS)) {
      return { allowed: false, text: '', playsLeft: 0 };
    }
    return {
      allowed: true,
      text: passage.transcript,
      playsLeft: Math.max(0, MAX_PLAYS - this.plays.used(user.id, id)),
    };
  }

  async submit(
    userId: bigint,
    passageId: number,
    rawAnswers: Record<string, unknown>,
    durationSeconds?: number,
  ) {
    const passage = await this.findWithQuestions(passageId);
    const answers = cleanAnswers(rawAnswers);
    const questions = passage.listening_questions;
    if (
      questions.length === 0 ||
      questions.some((q) => answers[String(q.id)] === undefined)
    ) {
      throw new BadRequestException('Every question must be answered.');
    }

    const { score, results } = gradeAnswers(questions, answers);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.listening_submissions.create({
        data: {
          user_id: userId,
          passage_id: passage.id,
          score,
          total: questions.length,
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
          type: 'listening',
          duration_seconds: Math.max(1, durationSeconds ?? 0),
          completed_at: now,
          created_at: now,
          updated_at: now,
        },
      });
    });
    this.plays.reset(userId, passageId);

    // Nộp bài xong mới được xem lời thoại
    return {
      score,
      total: questions.length,
      results,
      transcript: passage.transcript,
    };
  }

  private async findWithQuestions(id: number) {
    const passage = await this.prisma.listening_passages.findUnique({
      where: { id: BigInt(id) },
      include: { listening_questions: { orderBy: { order: 'asc' } } },
    });
    if (!passage) throw new NotFoundException('Passage not found.');
    return passage;
  }

  // ---------- Kho tự bù ----------

  private replenishInBackground(
    user: users,
    topic: Topic,
    level: string | null,
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
    requestedLevel: string | null,
  ): Promise<void> {
    // Chủ đề không phải "general" luôn gắn cứng 1 cấp độ theo dạng bài
    const level = levelFor(topic, requestedLevel);

    // Gửi kèm tiêu đề các bài đã có cùng topic/level - tránh AI sinh trùng/gần giống nội dung cũ
    const existing = await this.prisma.listening_passages.findMany({
      where: { topic, ...(topic === 'general' ? { level } : {}) },
      select: { title: true },
    });

    // Chỉ thử lại 1 lần - đây là việc ngầm, không nên giữ kết nối quá lâu
    const raw = await this.gemini.generate(
      apiKey,
      buildPrompt(
        topic,
        level,
        pickScenario(topic),
        existing.map((e) => e.title),
      ),
      SCHEMA,
      { maxRetries: 1 },
    );
    const generated = validateGenerated(raw);
    if (!generated) return;

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const passage = await tx.listening_passages.create({
        data: {
          topic,
          level: topic === 'general' ? level : null,
          title: generated.title,
          transcript: generated.transcript,
          created_at: now,
          updated_at: now,
        },
      });
      await tx.listening_questions.createMany({
        data: generated.questions.map((q, order) => ({
          passage_id: passage.id,
          type: q.type,
          question: q.question,
          options: JSON.stringify(q.options),
          correct_answer: JSON.stringify(q.correct_answer),
          order,
          created_at: now,
          updated_at: now,
        })),
      });
    });
  }

  // Dùng trong test: chờ các lần bù kho chạy ngầm xong
  async whenIdle(): Promise<void> {
    await Promise.all([...this.inflight]);
  }
}
