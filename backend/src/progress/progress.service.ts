import { Injectable, NotFoundException } from '@nestjs/common';
import { cleanAnswers, gradeAnswers, type UserAnswer } from '../common/quiz';
import { PrismaService } from '../prisma/prisma.service';

export const PROGRESS_TYPES = [
  'vocabulary',
  'grammar',
  'reading',
  'listening',
  'translate',
] as const;
export type ProgressType = (typeof PROGRESS_TYPES)[number];

export interface ProgressEntry {
  type: ProgressType;
  id: number;
  // Tuỳ loại: level (từ vựng, dịch), topicKey (ngữ pháp), title (đọc hiểu, nghe)
  level: string | null;
  topicKey: string | null;
  title: string | null;
  score: number;
  total: number;
  date: Date | null;
}

export interface QaItem {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export type ProgressDetail =
  | { kind: 'qa'; items: QaItem[] }
  | {
      kind: 'translate';
      sourceText: string;
      userTranslation: string;
      feedback: string | null;
    };

// Câu trả lời có thể là chuỗi (fill/mcq) hoặc mảng (multi) - hiển thị gộp bằng dấu phẩy cho dễ đọc
const formatAnswer = (answer: UserAnswer | undefined): string =>
  Array.isArray(answer) ? answer.join(', ') : (answer ?? '');

// Giá trị đọc từ JSON lưu trong DB: không phải chuỗi thì coi như rỗng
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function parseJson(json: string | null): unknown {
  try {
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

function parseAnswers(json: string | null): Record<string, UserAnswer> {
  const parsed = parseJson(json);
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? cleanAnswers(parsed as Record<string, unknown>)
    : {};
}

interface QuestionRow {
  id: bigint;
  type: string;
  question: string;
  correct_answer: string | null;
}

// "Tiến trình": gom lịch sử làm bài từ mọi module thành 1 danh sách chung (mới nhất trước). Danh sách chỉ có tóm tắt;
// chi tiết từng câu chỉ tải khi người dùng mở rộng một mục (getDetail) để trang không phải mang hàng trăm câu cùng lúc.
@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: bigint): Promise<ProgressEntry[]> {
    const where = { user_id: userId };
    const [vocab, grammar, reading, listening, translate] = await Promise.all([
      this.prisma.vocabulary_submissions.findMany({ where }),
      this.prisma.grammar_question_sets.findMany({
        where: { ...where, status: 'completed' },
      }),
      this.prisma.reading_submissions.findMany({
        where,
        include: { reading_passages: true },
      }),
      this.prisma.listening_submissions.findMany({
        where,
        include: { listening_passages: true },
      }),
      this.prisma.translation_submissions.findMany({
        where,
        include: { translation_passages: true },
      }),
    ]);

    const entries: ProgressEntry[] = [
      ...vocab.map((s) => ({
        type: 'vocabulary' as const,
        id: Number(s.id),
        level: s.level,
        topicKey: null,
        title: null,
        score: s.score,
        total: s.total,
        date: s.created_at,
      })),
      ...grammar.map((s) => ({
        type: 'grammar' as const,
        id: Number(s.id),
        level: null,
        topicKey: s.topic_key,
        title: null,
        score: s.score ?? 0,
        total: s.total ?? 0,
        date: s.completed_at,
      })),
      ...reading.map((s) => ({
        type: 'reading' as const,
        id: Number(s.id),
        level: null,
        topicKey: null,
        title: s.reading_passages.title,
        score: s.score,
        total: s.total,
        date: s.created_at,
      })),
      ...listening.map((s) => ({
        type: 'listening' as const,
        id: Number(s.id),
        level: null,
        topicKey: null,
        title: s.listening_passages.title,
        score: s.score,
        total: s.total,
        date: s.created_at,
      })),
      ...translate.map((s) => ({
        type: 'translate' as const,
        id: Number(s.id),
        level: s.translation_passages.level,
        topicKey: null,
        title: null,
        // Dịch chấm theo thang 0-100 (không phải X/Y câu đúng) - quy về cùng đơn vị % như các loại khác
        score: s.ai_score ?? 0,
        total: 100,
        date: s.created_at,
      })),
    ];

    return entries.sort(
      (a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0),
    );
  }

  // Chi tiết 1 lần làm bài - chỉ của chính user (bài của người khác trả 404 như thể không tồn tại)
  async getDetail(
    userId: bigint,
    type: ProgressType,
    id: number,
  ): Promise<ProgressDetail> {
    const key = BigInt(id);

    switch (type) {
      case 'vocabulary': {
        const s = await this.prisma.vocabulary_submissions.findFirst({
          where: { id: key, user_id: userId },
        });
        if (!s) throw new NotFoundException();
        const results = parseJson(s.results);
        const items = (Array.isArray(results) ? results : []).map(
          (r: Record<string, unknown>) => ({
            question: str(r.word) + (str(r.ipa) ? ` [${str(r.ipa)}]` : ''),
            userAnswer: str(r.user_answer),
            correctAnswer: str(r.correct_answer),
            isCorrect: r.is_correct === true,
          }),
        );
        return { kind: 'qa', items };
      }

      case 'grammar': {
        const s = await this.prisma.grammar_question_sets.findFirst({
          where: { id: key, user_id: userId, status: 'completed' },
          include: { grammar_questions: { orderBy: { order: 'asc' } } },
        });
        if (!s) throw new NotFoundException();
        return this.qa(s.grammar_questions, parseAnswers(s.answers));
      }

      case 'reading': {
        const s = await this.prisma.reading_submissions.findFirst({
          where: { id: key, user_id: userId },
          include: {
            reading_passages: {
              include: { reading_questions: { orderBy: { order: 'asc' } } },
            },
          },
        });
        if (!s) throw new NotFoundException();
        return this.qa(
          s.reading_passages.reading_questions,
          parseAnswers(s.answers),
        );
      }

      case 'listening': {
        const s = await this.prisma.listening_submissions.findFirst({
          where: { id: key, user_id: userId },
          include: {
            listening_passages: {
              include: { listening_questions: { orderBy: { order: 'asc' } } },
            },
          },
        });
        if (!s) throw new NotFoundException();
        return this.qa(
          s.listening_passages.listening_questions,
          parseAnswers(s.answers),
        );
      }

      case 'translate': {
        const s = await this.prisma.translation_submissions.findFirst({
          where: { id: key, user_id: userId },
          include: { translation_passages: true },
        });
        if (!s) throw new NotFoundException();
        return {
          kind: 'translate',
          sourceText: s.translation_passages.source_text,
          userTranslation: s.user_translation,
          feedback: s.ai_feedback,
        };
      }
    }
  }

  // Chấm lại bằng đúng loại câu hỏi đã lưu (chính xác hơn việc đoán theo số đáp án đúng)
  private qa(
    questions: QuestionRow[],
    answers: Record<string, UserAnswer>,
  ): ProgressDetail {
    const { results } = gradeAnswers(questions, answers);
    return {
      kind: 'qa',
      items: questions.map((q, i) => ({
        question: q.question,
        userAnswer: formatAnswer(answers[String(q.id)]),
        correctAnswer: results[i].correctAnswer.join(', '),
        isCorrect: results[i].isCorrect,
      })),
    };
  }
}
