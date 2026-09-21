import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuizAnswerDto } from './dto/submit-quiz.dto';
import {
  isAnswerCorrect,
  Level,
  QUESTIONS_PER_QUIZ,
  sampleRandom,
} from './vocabulary.logic';

export interface QuizWord {
  id: number;
  word: string;
  partOfSpeech: string | null;
  ipa: string | null;
}

export interface QuizResultItem {
  vocabularyId: number;
  word: string;
  ipa: string | null;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export interface QuizResult {
  level: Level;
  score: number;
  total: number;
  results: QuizResultItem[];
}

@Injectable()
export class VocabularyService {
  constructor(private readonly prisma: PrismaService) {}

  // Lấy ngẫu nhiên tối đa 50 từ của cấp độ - mỗi lần vào bài ra bộ từ khác nhau.
  // Chỉ lấy từ đã có nghĩa tiếng Việt, và KHÔNG gửi nghĩa xuống trình duyệt (chấm điểm ở server).
  async startQuiz(level: Level): Promise<QuizWord[]> {
    const candidates = await this.prisma.vocabularies.findMany({
      where: { level, meaning_vi: { not: null } },
      select: { id: true },
    });
    const pickedIds = sampleRandom(
      candidates.map((c) => c.id),
      QUESTIONS_PER_QUIZ,
    );
    if (pickedIds.length === 0) {
      return [];
    }

    const words = await this.prisma.vocabularies.findMany({
      where: { id: { in: pickedIds } },
    });
    const byId = new Map(words.map((w) => [w.id, w]));
    // Giữ đúng thứ tự đã bốc ngẫu nhiên (findMany ... in không đảm bảo thứ tự)
    return pickedIds.flatMap((id) => {
      const w = byId.get(id);
      return w
        ? [
            {
              id: Number(w.id),
              word: w.word,
              partOfSpeech: w.part_of_speech,
              ipa: w.ipa,
            },
          ]
        : [];
    });
  }

  // Chấm điểm toàn bộ bài, đánh dấu từ đã thuộc, lưu bài làm và buổi học
  async submitQuiz(
    userId: bigint,
    level: Level,
    answers: QuizAnswerDto[],
    durationSeconds?: number,
  ): Promise<QuizResult> {
    const ids = answers.map((a) => BigInt(a.vocabularyId));
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Duplicate vocabularyId in answers.');
    }

    // Chỉ nhận từ thật sự thuộc cấp độ này (có nghĩa để chấm) - chặn gửi id lung tung
    const vocabularies = await this.prisma.vocabularies.findMany({
      where: { id: { in: ids }, level, meaning_vi: { not: null } },
    });
    const byId = new Map(vocabularies.map((v) => [Number(v.id), v]));
    if (byId.size !== answers.length) {
      throw new BadRequestException(
        'Some vocabularyId values do not belong to this level.',
      );
    }

    let score = 0;
    const results: QuizResultItem[] = answers.map((a) => {
      const vocab = byId.get(a.vocabularyId)!;
      const userAnswer = a.answer.trim();
      const isCorrect = isAnswerCorrect(userAnswer, vocab.meaning_vi!);
      if (isCorrect) score++;
      return {
        vocabularyId: a.vocabularyId,
        word: vocab.word,
        ipa: vocab.ipa,
        userAnswer,
        correctAnswer: vocab.meaning_vi!,
        isCorrect,
      };
    });

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const r of results) {
        // Trả lời đúng -> đánh dấu đã thuộc. Trả lời sai KHÔNG hạ mức "đã thuộc" xuống (chỉ tăng dần):
        // update rỗng nghĩa là nếu bản ghi đã có thì giữ nguyên.
        const key = {
          user_id_vocabulary_id: {
            user_id: userId,
            vocabulary_id: BigInt(r.vocabularyId),
          },
        };
        await tx.user_vocab_progress.upsert({
          where: key,
          create: {
            user_id: userId,
            vocabulary_id: BigInt(r.vocabularyId),
            is_mastered: r.isCorrect,
            last_reviewed_at: now,
            created_at: now,
            updated_at: now,
          },
          update: r.isCorrect
            ? { is_mastered: true, last_reviewed_at: now, updated_at: now }
            : {},
        });
      }

      // Lưu đúng định dạng JSON của bản Laravel (khoá snake_case) để hai hệ thống đọc chung được dữ liệu
      await tx.vocabulary_submissions.create({
        data: {
          user_id: userId,
          level,
          score,
          total: results.length,
          results: JSON.stringify(
            results.map((r) => ({
              word: r.word,
              ipa: r.ipa,
              user_answer: r.userAnswer,
              correct_answer: r.correctAnswer,
              is_correct: r.isCorrect,
            })),
          ),
          created_at: now,
          updated_at: now,
        },
      });

      await tx.study_sessions.create({
        data: {
          user_id: userId,
          type: 'vocabulary',
          duration_seconds: Math.max(1, durationSeconds ?? 0),
          completed_at: now,
          created_at: now,
          updated_at: now,
        },
      });
    });

    return { level, score, total: results.length, results };
  }
}
