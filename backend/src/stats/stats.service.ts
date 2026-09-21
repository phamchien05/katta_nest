import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateStreak,
  dayKey,
  DEFAULT_TIMEZONE,
  weeklyCounts,
  WeekdayCount,
} from './stats.logic';

export interface SessionStats {
  streak: number;
  sessionsCompleted: number;
  minutesToday: number;
  totalStudySeconds: number;
  articlesRead: number;
  weekly: WeekdayCount[];
  recent: { type: string; completedAt: Date }[];
}

// Số liệu học tập tính từ bảng study_sessions - dùng chung cho Trang chủ / Thống kê / Tiến trình
@Injectable()
export class StatsService {
  private readonly timeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE') ?? DEFAULT_TIMEZONE;
  }

  async sessionStats(userId: bigint, now = new Date()): Promise<SessionStats> {
    // Một truy vấn duy nhất lấy các cột cần thiết, phần còn lại tính trong bộ nhớ
    const sessions = await this.prisma.study_sessions.findMany({
      where: { user_id: userId },
      select: { type: true, duration_seconds: true, completed_at: true },
      orderBy: { completed_at: 'desc' },
    });

    const today = dayKey(now, this.timeZone);
    const days = sessions.map((s) => dayKey(s.completed_at, this.timeZone));
    const totalSeconds = sessions.reduce(
      (sum, s) => sum + s.duration_seconds,
      0,
    );
    const secondsToday = sessions.reduce(
      (sum, s, i) => (days[i] === today ? sum + s.duration_seconds : sum),
      0,
    );

    return {
      streak: calculateStreak(new Set(days), today),
      sessionsCompleted: sessions.length,
      minutesToday: Math.round(secondsToday / 60),
      totalStudySeconds: totalSeconds,
      articlesRead: sessions.filter((s) => s.type === 'reading').length,
      weekly: weeklyCounts(days, today),
      recent: sessions
        .slice(0, 5)
        .map((s) => ({ type: s.type, completedAt: s.completed_at })),
    };
  }

  // Các ngày (1-31) trong tháng có ít nhất 1 buổi học, tính theo múi giờ của người học
  async activeDaysInMonth(
    userId: bigint,
    year: number,
    month: number,
  ): Promise<number[]> {
    // Lấy dư 1 ngày mỗi đầu (múi giờ lệch tối đa ~14 giờ) rồi lọc lại theo ngày địa phương cho chính xác
    const from = new Date(Date.UTC(year, month - 1, 1) - 24 * 3600 * 1000);
    const to = new Date(Date.UTC(year, month, 1) + 24 * 3600 * 1000);
    const sessions = await this.prisma.study_sessions.findMany({
      where: { user_id: userId, completed_at: { gte: from, lt: to } },
      select: { completed_at: true },
    });

    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    const days = new Set<number>();
    for (const s of sessions) {
      const key = dayKey(s.completed_at, this.timeZone);
      if (key.startsWith(prefix)) days.add(Number(key.slice(prefix.length)));
    }
    return [...days].sort((a, b) => a - b);
  }

  // "Hôm nay" theo múi giờ của người học - để frontend đánh dấu đúng ngày trên lịch
  today(now = new Date()): string {
    return dayKey(now, this.timeZone);
  }
}
