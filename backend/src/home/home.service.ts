import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';

// Dữ liệu cho Trang chủ: banner, khung thống kê dịch thuật, biểu đồ 7 ngày, hàng số liệu, hoạt động gần đây
@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: StatsService,
  ) {}

  async summary(userId: bigint) {
    const [session, translationCount, translationAvg, vocabMastered] =
      await Promise.all([
        this.stats.sessionStats(userId),
        this.prisma.translation_submissions.count({
          where: { user_id: userId },
        }),
        // Điểm trung bình chỉ tính các bài đã có điểm AI
        this.prisma.translation_submissions.aggregate({
          where: { user_id: userId, ai_score: { not: null } },
          _avg: { ai_score: true },
        }),
        this.prisma.user_vocab_progress.count({
          where: { user_id: userId, is_mastered: true },
        }),
      ]);

    return {
      streak: session.streak,
      sessionsCompleted: session.sessionsCompleted,
      minutesToday: session.minutesToday,
      translation: {
        count: translationCount,
        averageScore: Math.round(translationAvg._avg.ai_score ?? 0),
      },
      vocabMastered,
      articlesRead: session.articlesRead,
      totalStudySeconds: session.totalStudySeconds,
      weekly: session.weekly,
      recentActivity: session.recent,
    };
  }
}
