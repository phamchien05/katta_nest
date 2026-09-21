import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { users } from '@prisma/client';
import {
  cleanAnswers,
  gradeAnswers,
  parseStringArray,
  shuffled,
  type UserAnswer,
} from '../common/quiz';
import { GeminiService } from '../gemini/gemini.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildGrounding,
  buildPrompt,
  PracticeTopic,
  SCHEMA,
  validateGeneratedSet,
} from './grammar.logic';

// Mỗi bộ 30-50 câu phức tạp hơn nhiều so với các module khác nên cho Gemini nhiều thời gian hơn
const GENERATION_TIMEOUT_MS = 90_000;
const CLAIM_ATTEMPTS = 5;

@Injectable()
export class GrammarService {
  private readonly logger = new Logger(GrammarService.name);
  private readonly inflight = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
  ) {}

  // ---------- Phần A: lý thuyết ----------

  // Cây chủ đề dạng phẳng (client tự dựng cây). Không kèm nội dung để nhẹ - nội dung lấy riêng theo từng bài.
  async topics() {
    const [all, withContent] = await Promise.all([
      this.prisma.grammar_topics.findMany({
        select: {
          id: true,
          parent_id: true,
          title: true,
          slug: true,
          order: true,
        },
        orderBy: { order: 'asc' },
      }),
      this.prisma.grammar_topics.findMany({
        where: {
          OR: [{ content_en: { not: '' } }, { content_vi: { not: '' } }],
        },
        select: { id: true },
      }),
    ]);
    const hasContent = new Set(withContent.map((t) => t.id));
    return all.map((t) => ({
      id: Number(t.id),
      parentId: t.parent_id === null ? null : Number(t.parent_id),
      title: t.title,
      slug: t.slug,
      order: t.order,
      hasContent: hasContent.has(t.id),
    }));
  }

  async topic(slug: string) {
    const t = await this.prisma.grammar_topics.findUnique({ where: { slug } });
    if (!t) throw new NotFoundException('Topic not found.');
    return {
      id: Number(t.id),
      title: t.title,
      slug: t.slug,
      contentEn: t.content_en,
      contentVi: t.content_vi,
    };
  }

  // ---------- Phần B: luyện tập ----------

  // Tab "Các đề đã làm"
  async history(userId: bigint) {
    const rows = await this.prisma.grammar_question_sets.findMany({
      where: { user_id: userId, status: 'completed' },
      orderBy: { completed_at: 'desc' },
    });
    return rows.map((s) => ({
      id: Number(s.id),
      topicKey: s.topic_key,
      score: s.score,
      total: s.total,
      completedAt: s.completed_at,
    }));
  }

  // Bấm vào 1 chủ đề: lấy ngay 1 bộ "available" trong kho (không chờ AI) và gán cho user. Kho rỗng (hiếm) thì sinh
  // đồng bộ 1 bộ để không chặn người dùng mãi. Việc bù kho xảy ra khi mở bộ đề (xem getSet).
  async start(user: users, topicKey: PracticeTopic): Promise<number> {
    for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt++) {
      const candidate = await this.prisma.grammar_question_sets.findFirst({
        where: { topic_key: topicKey, status: 'available' },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      if (!candidate) break;

      // Giành bộ đề bằng 1 câu UPDATE có điều kiện: 2 người bấm cùng lúc thì chỉ 1 người thắng, người kia thử bộ khác
      const now = new Date();
      const claimed = await this.prisma.grammar_question_sets.updateMany({
        where: { id: candidate.id, status: 'available' },
        data: {
          status: 'in_progress',
          user_id: user.id,
          started_at: now,
          updated_at: now,
        },
      });
      if (claimed.count === 1) return Number(candidate.id);
    }

    const created = await this.generateAndStore(user, topicKey, 3, {
      assignTo: user.id,
    });
    if (!created) {
      throw new ServiceUnavailableException(
        'Could not create a question set right now. Please try again.',
      );
    }
    return created;
  }

  // Chỉ chủ sở hữu mới xem được bộ đề đang làm/đã làm. Câu hỏi KHÔNG kèm đáp án đúng khi chưa nộp.
  async getSet(user: users, id: number) {
    const set = await this.prisma.grammar_question_sets.findUnique({
      where: { id: BigInt(id) },
      include: { grammar_questions: { orderBy: { order: 'asc' } } },
    });
    if (!set) throw new NotFoundException('Question set not found.');
    if (set.user_id !== user.id) throw new ForbiddenException();

    const questions = set.grammar_questions.map((q) => ({
      id: Number(q.id),
      type: q.type,
      question: q.question,
      options: parseStringArray(q.options),
    }));

    if (set.status === 'completed') {
      const answers = this.parseAnswers(set.answers);
      const { results } = gradeAnswers(set.grammar_questions, answers);
      return {
        id: Number(set.id),
        topicKey: set.topic_key,
        status: set.status,
        questions,
        answers,
        score: set.score ?? 0,
        total: set.total ?? questions.length,
        results,
      };
    }

    // Bù kho: chỉ ĐÚNG 1 LẦN cho lượt lấy đề này, kể cả khi user tải lại trang nhiều lần (tránh sinh thừa bộ đề).
    // Giành quyền bằng UPDATE có điều kiện nên 2 lần tải đồng thời cũng chỉ 1 lần thắng.
    if (!set.replenish_dispatched) {
      const won = await this.prisma.grammar_question_sets.updateMany({
        where: { id: set.id, replenish_dispatched: false },
        data: { replenish_dispatched: true, updated_at: new Date() },
      });
      if (won.count === 1)
        this.replenishInBackground(user, set.topic_key as PracticeTopic);
    }

    return {
      id: Number(set.id),
      topicKey: set.topic_key,
      status: set.status,
      questions,
    };
  }

  async submit(
    user: users,
    id: number,
    rawAnswers: Record<string, unknown>,
    durationSeconds?: number,
  ) {
    const set = await this.prisma.grammar_question_sets.findUnique({
      where: { id: BigInt(id) },
      include: { grammar_questions: { orderBy: { order: 'asc' } } },
    });
    if (!set) throw new NotFoundException('Question set not found.');
    if (set.user_id !== user.id) throw new ForbiddenException();
    if (set.status !== 'in_progress')
      throw new ConflictException('This question set was already submitted.');

    const answers = cleanAnswers(rawAnswers);
    const questions = set.grammar_questions;
    if (
      questions.length === 0 ||
      questions.some((q) => answers[String(q.id)] === undefined)
    ) {
      throw new BadRequestException('Every question must be answered.');
    }

    const { score, results } = gradeAnswers(questions, answers);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Chỉ chuyển in_progress -> completed 1 lần: bấm nộp 2 lần cùng lúc thì lần thứ hai thấy count = 0 và bị từ chối
      const done = await tx.grammar_question_sets.updateMany({
        where: { id: set.id, status: 'in_progress', user_id: user.id },
        data: {
          status: 'completed',
          score,
          total: questions.length,
          answers: JSON.stringify(
            Object.fromEntries(
              questions.map((q) => [String(q.id), answers[String(q.id)]]),
            ),
          ),
          completed_at: now,
          updated_at: now,
        },
      });
      if (done.count !== 1)
        throw new ConflictException('This question set was already submitted.');

      await tx.study_sessions.create({
        data: {
          user_id: user.id,
          type: 'grammar',
          duration_seconds: Math.max(1, durationSeconds ?? 0),
          completed_at: now,
          created_at: now,
          updated_at: now,
        },
      });
    });

    return { score, total: questions.length, results };
  }

  private parseAnswers(json: string | null): Record<string, UserAnswer> {
    try {
      const parsed: unknown = json ? JSON.parse(json) : {};
      return typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
        ? cleanAnswers(parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  // ---------- Kho tự bù ----------

  private replenishInBackground(user: users, topicKey: PracticeTopic): void {
    const job = this.generateAndStore(user, topicKey, 1)
      .then(() => undefined)
      .catch((e: unknown) =>
        this.logger.warn(
          `Replenish failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      )
      .finally(() => this.inflight.delete(job));
    this.inflight.add(job);
  }

  // Sinh 1 bộ đề mới cho topic và lưu vào kho (hoặc gán luôn cho user nếu `assignTo`). Trả về id bộ đề, null nếu lỗi.
  private async generateAndStore(
    user: users,
    topicKey: PracticeTopic,
    maxRetries: number,
    opts: { assignTo?: bigint } = {},
  ): Promise<number | null> {
    const apiKey = this.gemini.keyFor(user);
    if (!apiKey) return null;

    const topics = await this.prisma.grammar_topics.findMany({
      select: {
        id: true,
        parent_id: true,
        slug: true,
        title: true,
        content_en: true,
      },
      orderBy: { order: 'asc' },
    });
    const grounding = buildGrounding(topics, topicKey);
    if (!grounding) return null;

    const raw = await this.gemini.generate(
      apiKey,
      buildPrompt(topicKey, grounding),
      SCHEMA,
      {
        maxRetries,
        timeoutMs: GENERATION_TIMEOUT_MS,
      },
    );
    const generated = validateGeneratedSet(raw);
    if (!generated) return null;

    // Xáo trộn để các loại câu xen kẽ nhau khi hiển thị, không dồn cục theo từng loại
    const questions = shuffled(generated);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const set = await tx.grammar_question_sets.create({
        data: {
          topic_key: topicKey,
          status: opts.assignTo ? 'in_progress' : 'available',
          // Bộ giao ngay cho user thì lần mở đầu tiên không cần bù kho nữa nếu đã chính là lần bù (false = sẽ bù 1 lần khi mở)
          replenish_dispatched: false,
          user_id: opts.assignTo ?? null,
          started_at: opts.assignTo ? now : null,
          created_at: now,
          updated_at: now,
        },
      });
      await tx.grammar_questions.createMany({
        data: questions.map((q, order) => ({
          set_id: set.id,
          type: q.type,
          question: q.question,
          options: JSON.stringify(q.options),
          correct_answer: JSON.stringify(q.correct_answer),
          order,
          created_at: now,
          updated_at: now,
        })),
      });
      return Number(set.id);
    });
  }

  // Dùng trong test: chờ các lần bù kho chạy ngầm xong
  async whenIdle(): Promise<void> {
    await Promise.all([...this.inflight]);
  }
}
