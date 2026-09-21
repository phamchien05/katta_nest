import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { createFakeUsers, enableBigIntJson } from './helpers/fake-users';

interface Session {
  user_id: bigint;
  type: string;
  duration_seconds: number;
  completed_at: Date;
}
interface Submission {
  user_id: bigint;
  ai_score: number | null;
}
interface Progress {
  user_id: bigint;
  is_mastered: boolean;
}

// DB giả: chỉ hiểu đúng các truy vấn mà HomeService/StatsService dùng
function createFakePrisma() {
  const users = createFakeUsers();
  const sessions: Session[] = [];
  const submissions: Submission[] = [];
  const progress: Progress[] = [];

  const fake = {
    users: users.delegate,
    study_sessions: {
      findMany: ({ where }: { where: { user_id: bigint } }) =>
        Promise.resolve(
          sessions
            .filter((s) => s.user_id === where.user_id)
            .sort(
              (a, b) => b.completed_at.getTime() - a.completed_at.getTime(),
            ),
        ),
    },
    translation_submissions: {
      count: ({ where }: { where: { user_id: bigint } }) =>
        Promise.resolve(
          submissions.filter((s) => s.user_id === where.user_id).length,
        ),
      aggregate: ({ where }: { where: { user_id: bigint } }) => {
        const scored = submissions.filter(
          (s) => s.user_id === where.user_id && s.ai_score !== null,
        );
        const avg = scored.length
          ? scored.reduce((sum, s) => sum + (s.ai_score ?? 0), 0) /
            scored.length
          : null;
        return Promise.resolve({ _avg: { ai_score: avg } });
      },
    },
    user_vocab_progress: {
      count: ({
        where,
      }: {
        where: { user_id: bigint; is_mastered: boolean };
      }) =>
        Promise.resolve(
          progress.filter(
            (p) =>
              p.user_id === where.user_id &&
              p.is_mastered === where.is_mastered,
          ).length,
        ),
    },
  };
  return { fake, users, sessions, submissions, progress };
}

const HOUR = 3600 * 1000;

describe('Home (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<typeof createFakePrisma>;

  beforeAll(enableBigIntJson);

  const addUser = (id: bigint) =>
    db.users.rows.push({
      id,
      name: `U${id}`,
      email: `u${id}@example.com`,
      password: 'x',
      locale: null,
      gemini_api_key: null,
      created_at: null,
      updated_at: null,
    });
  const cookieFor = (id: number) =>
    `katta_token=${app.get(JwtService).sign({ sub: id })}`;
  const getHome = (cookie?: string) => {
    const req = request(app.getHttpServer()).get('/api/home');
    return cookie ? req.set('Cookie', cookie) : req;
  };

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-for-e2e-only';
    process.env.APP_TIMEZONE = 'UTC'; // cố định để test không phụ thuộc giờ máy chạy
    db = createFakePrisma();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db.fake)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    addUser(1n);
    addUser(2n);
  });

  afterEach(async () => {
    delete process.env.APP_TIMEZONE;
    await app.close();
  });

  it('cần đăng nhập', async () => {
    await getHome().expect(401);
  });

  it('người mới chưa học gì: mọi số liệu bằng 0, biểu đồ đủ 7 ngày', async () => {
    const res = await getHome(cookieFor(1)).expect(200);
    expect(res.body).toMatchObject({
      streak: 0,
      sessionsCompleted: 0,
      minutesToday: 0,
      translation: { count: 0, averageScore: 0 },
      vocabMastered: 0,
      articlesRead: 0,
      totalStudySeconds: 0,
      recentActivity: [],
    });
    expect(res.body.weekly).toHaveLength(7);
    expect(res.body.weekly[0].day).toBe('Mon');
  });

  it('tổng hợp đúng streak, số buổi, phút hôm nay, tổng thời gian, bài đọc', async () => {
    const now = Date.now();
    const s = (type: string, secs: number, ago: number, user = 1n) =>
      db.sessions.push({
        user_id: user,
        type,
        duration_seconds: secs,
        completed_at: new Date(now - ago),
      });
    s('reading', 600, 0); // vừa xong
    s('vocabulary', 90, 0); // vừa xong -> hôm nay tổng 690s = 11.5 phút
    s('grammar', 300, 24 * HOUR); // hôm qua
    s('reading', 100, 48 * HOUR); // hôm kia
    s('listening', 7200, 10 * 24 * HOUR); // xa hơn, đứt streak
    s('reading', 999, 0, 2n); // của user khác - không được lẫn vào

    const res = await getHome(cookieFor(1)).expect(200);
    expect(res.body.sessionsCompleted).toBe(5);
    expect(res.body.streak).toBe(3);
    expect(res.body.minutesToday).toBe(12); // round(690/60)
    expect(res.body.totalStudySeconds).toBe(600 + 90 + 300 + 100 + 7200);
    expect(res.body.articlesRead).toBe(2);
  });

  it('hoạt động gần đây: 5 buổi mới nhất, mới nhất trước', async () => {
    const now = Date.now();
    ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach((type, i) =>
      db.sessions.push({
        user_id: 1n,
        type,
        duration_seconds: 1,
        completed_at: new Date(now - i * HOUR),
      }),
    );
    const res = await getHome(cookieFor(1)).expect(200);
    expect(
      res.body.recentActivity.map((a: { type: string }) => a.type),
    ).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(typeof res.body.recentActivity[0].completedAt).toBe('string');
  });

  it('thống kê dịch thuật: đếm mọi bài, điểm TB chỉ tính bài đã có điểm, làm tròn', async () => {
    db.submissions.push(
      { user_id: 1n, ai_score: 80 },
      { user_id: 1n, ai_score: 75 },
      { user_id: 1n, ai_score: null }, // chưa chấm: có đếm nhưng không vào điểm TB
      { user_id: 2n, ai_score: 10 },
    );
    const res = await getHome(cookieFor(1)).expect(200);
    expect(res.body.translation).toEqual({ count: 3, averageScore: 78 }); // 77.5 -> 78
  });

  it('từ đã thuộc: chỉ đếm của user hiện tại và chỉ từ is_mastered', async () => {
    db.progress.push(
      { user_id: 1n, is_mastered: true },
      { user_id: 1n, is_mastered: true },
      { user_id: 1n, is_mastered: false },
      { user_id: 2n, is_mastered: true },
    );
    const res = await getHome(cookieFor(1)).expect(200);
    expect(res.body.vocabMastered).toBe(2);
  });

  it('không lộ dữ liệu nhạy cảm nào của user', async () => {
    const res = await getHome(cookieFor(1)).expect(200);
    expect(JSON.stringify(res.body)).not.toMatch(/password|email|gemini/i);
  });
});
