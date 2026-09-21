import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type AccuracyType =
  'vocabulary' | 'grammar' | 'reading' | 'listening' | 'translate';

const percentOf = (score: number | null, total: number | null): number =>
  Math.round(((score ?? 0) / Math.max(1, total ?? 0)) * 100);

// Trang Thống kê: ô số liệu tổng quan, từ vựng theo cấp độ, độ chính xác từng module, lịch ngày học
@Injectable()
export class StatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: StatsService,
  ) {}

  async overview(userId: bigint) {
    const [session, vocabMastered, vocabByLevel, accuracy] = await Promise.all([
      this.stats.sessionStats(userId),
      this.prisma.user_vocab_progress.count({
        where: { user_id: userId, is_mastered: true },
      }),
      this.vocabularyByLevel(userId),
      this.accuracyByType(userId),
    ]);

    return {
      streak: session.streak,
      sessionsCompleted: session.sessionsCompleted,
      vocabMastered,
      articlesRead: session.articlesRead,
      minutesToday: session.minutesToday,
      totalStudySeconds: session.totalStudySeconds,
      today: this.stats.today(),
      vocabByLevel,
      accuracy,
    };
  }

  async calendar(userId: bigint, year: number, month: number) {
    return {
      year,
      month,
      activeDays: await this.stats.activeDaysInMonth(userId, year, month),
    };
  }

  // Số từ đã thuộc / tổng số từ mỗi cấp độ CEFR - chỉ trả về cấp có từ vựng (bỏ qua cấp rỗng)
  private async vocabularyByLevel(userId: bigint) {
    const rows = await Promise.all(
      LEVELS.map(async (level) => {
        const [total, mastered] = await Promise.all([
          this.prisma.vocabularies.count({
            where: { level, meaning_vi: { not: null } },
          }),
          this.prisma.user_vocab_progress.count({
            where: {
              user_id: userId,
              is_mastered: true,
              vocabularies: { level },
            },
          }),
        ]);
        return { level, mastered, total };
      }),
    );
    return rows.filter((r) => r.total > 0);
  }

  // % trung bình + số phiên đã hoàn thành cho từng module - chỉ trả về module đã có ít nhất 1 phiên
  private async accuracyByType(userId: bigint) {
    const where = { user_id: userId };
    const sums = { score: true, total: true } as const;
    const [vocab, grammar, reading, listening, translate] = await Promise.all([
      this.prisma.vocabulary_submissions.aggregate({
        where,
        _sum: sums,
        _count: { _all: true },
      }),
      this.prisma.grammar_question_sets.aggregate({
        where: { ...where, status: 'completed' },
        _sum: sums,
        _count: { _all: true },
      }),
      this.prisma.reading_submissions.aggregate({
        where,
        _sum: sums,
        _count: { _all: true },
      }),
      this.prisma.listening_submissions.aggregate({
        where,
        _sum: sums,
        _count: { _all: true },
      }),
      this.prisma.translation_submissions.aggregate({
        where: { ...where, ai_score: { not: null } },
        _avg: { ai_score: true },
        _count: { _all: true },
      }),
    ]);

    const rows: { type: AccuracyType; percent: number; sessions: number }[] =
      [];
    const quiz = [
      ['vocabulary', vocab],
      ['grammar', grammar],
      ['reading', reading],
      ['listening', listening],
    ] as const;
    for (const [type, agg] of quiz) {
      if (agg._count._all > 0) {
        rows.push({
          type,
          percent: percentOf(agg._sum.score, agg._sum.total),
          sessions: agg._count._all,
        });
      }
    }
    if (translate._count._all > 0) {
      rows.push({
        type: 'translate',
        percent: Math.round(translate._avg.ai_score ?? 0),
        sessions: translate._count._all,
      });
    }
    return rows;
  }
}
