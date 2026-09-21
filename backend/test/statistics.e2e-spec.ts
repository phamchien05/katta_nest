import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { bootApp, cookieFor, makeUser } from './helpers/app';
import { FakeTable } from './helpers/fake-table';
import { createFakeUsers, enableBigIntJson } from './helpers/fake-users';

type R = Record<string, unknown>;

function createDb() {
  const users = createFakeUsers();
  const vocabularies = new FakeTable<R>();
  const progress = new FakeTable<R>();
  const sessions = new FakeTable<R>();
  const vocabSubs = new FakeTable<R>();
  const sets = new FakeTable<R>();
  const readingSubs = new FakeTable<R>();
  const listeningSubs = new FakeTable<R>();
  const translationSubs = new FakeTable<R>();

  const fake = {
    users: users.delegate,
    vocabularies,
    // count có lọc theo quan hệ `vocabularies: { level }` như Prisma
    user_vocab_progress: {
      ...progress,
      count: (args: { where: R }) => {
        const { vocabularies: rel, ...own } = args.where as {
          vocabularies?: { level: string };
        } & R;
        return progress
          .findMany({ where: own })
          .then(
            (rows) =>
              rows.filter(
                (r) =>
                  !rel ||
                  vocabularies.rows.find((v) => v.id === r.vocabulary_id)
                    ?.level === rel.level,
              ).length,
          );
      },
    },
    study_sessions: sessions,
    vocabulary_submissions: vocabSubs,
    grammar_question_sets: sets,
    reading_submissions: readingSubs,
    listening_submissions: listeningSubs,
    translation_submissions: translationSubs,
  };
  return {
    fake,
    users,
    vocabularies,
    progress,
    sessions,
    vocabSubs,
    sets,
    readingSubs,
    listeningSubs,
    translationSubs,
  };
}

describe('Statistics (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<typeof createDb>;
  let cookie: string;

  beforeAll(enableBigIntJson);

  const boot = async (env: Record<string, string> = {}) => {
    db = createDb();
    db.users.rows.push(makeUser(1n), makeUser(2n));
    app = await bootApp(db.fake, env);
    cookie = cookieFor(app, 1);
  };
  afterEach(() => app.close());

  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Cookie', cookie);

  describe('tổng quan', () => {
    beforeEach(() => boot());

    it('401 khi chưa đăng nhập', async () => {
      await request(app.getHttpServer()).get('/api/statistics').expect(401);
      await request(app.getHttpServer())
        .get('/api/statistics/calendar?year=2026&month=9')
        .expect(401);
    });

    it('người mới: mọi số liệu bằng 0, không có cấp/độ chính xác nào', async () => {
      const res = await get('/api/statistics').expect(200);
      expect(res.body).toMatchObject({
        streak: 0,
        sessionsCompleted: 0,
        vocabMastered: 0,
        articlesRead: 0,
        minutesToday: 0,
        totalStudySeconds: 0,
        vocabByLevel: [],
        accuracy: [],
      });
      expect(res.body.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('6 ô số liệu lấy từ các buổi học và từ đã thuộc của user', async () => {
      const now = Date.now();
      const s = (type: string, secs: number, ago: number, user = 1n) =>
        db.sessions.seed({
          user_id: user,
          type,
          duration_seconds: secs,
          completed_at: new Date(now - ago),
        });
      s('reading', 600, 0);
      s('vocabulary', 120, 0);
      s('grammar', 300, 24 * 3600 * 1000);
      s('reading', 60, 48 * 3600 * 1000);
      s('reading', 9999, 0, 2n); // của user khác
      db.progress.seed(
        { user_id: 1n, vocabulary_id: 1n, is_mastered: true },
        { user_id: 1n, vocabulary_id: 2n, is_mastered: false },
        { user_id: 2n, vocabulary_id: 1n, is_mastered: true },
      );

      const res = await get('/api/statistics').expect(200);
      expect(res.body).toMatchObject({
        streak: 3,
        sessionsCompleted: 4,
        vocabMastered: 1,
        articlesRead: 2,
        minutesToday: 12, // (600 + 120) / 60
        totalStudySeconds: 1080,
      });
    });

    it('từ vựng theo cấp độ: đếm từ đã thuộc/tổng số từ có nghĩa; bỏ cấp rỗng và từ chưa dịch', async () => {
      const w = (id: number, level: string, meaning: string | null) =>
        db.vocabularies.seed({
          id: BigInt(id),
          level,
          word: `w${id}`,
          meaning_vi: meaning,
        });
      w(1, 'A1', 'a');
      w(2, 'A1', 'b');
      w(3, 'A1', null); // chưa dịch - không tính vào tổng
      w(4, 'B2', 'c');
      db.progress.seed(
        { user_id: 1n, vocabulary_id: 1n, is_mastered: true },
        { user_id: 1n, vocabulary_id: 2n, is_mastered: false },
        { user_id: 1n, vocabulary_id: 4n, is_mastered: true },
        { user_id: 2n, vocabulary_id: 2n, is_mastered: true },
      );
      const res = await get('/api/statistics').expect(200);
      expect(res.body.vocabByLevel).toEqual([
        { level: 'A1', mastered: 1, total: 2 },
        { level: 'B2', mastered: 1, total: 1 },
      ]);
    });

    it('độ chính xác: tính theo tổng điểm/tổng câu (không phải TB các %), chỉ module đã có phiên', async () => {
      db.vocabSubs.seed(
        { user_id: 1n, score: 10, total: 10 },
        { user_id: 1n, score: 0, total: 40 },
        { user_id: 2n, score: 1, total: 1 },
      );
      db.sets.seed(
        { user_id: 1n, status: 'completed', score: 7, total: 10 },
        { user_id: 1n, status: 'in_progress', score: null, total: null },
      );
      db.readingSubs.seed({ user_id: 1n, score: 3, total: 5 });
      db.listeningSubs.seed({ user_id: 1n, score: 1, total: 4 });
      db.translationSubs.seed(
        { user_id: 1n, ai_score: 80 },
        { user_id: 1n, ai_score: 61 },
        { user_id: 1n, ai_score: null },
      );

      const res = await get('/api/statistics').expect(200);
      expect(res.body.accuracy).toEqual([
        { type: 'vocabulary', percent: 20, sessions: 2 }, // 10/50 chứ không phải TB(100%, 0%) = 50%
        { type: 'grammar', percent: 70, sessions: 1 },
        { type: 'reading', percent: 60, sessions: 1 },
        { type: 'listening', percent: 25, sessions: 1 },
        { type: 'translate', percent: 71, sessions: 2 }, // TB(80, 61) = 70.5, bài chưa chấm bỏ qua
      ]);
    });

    it('module chưa có phiên nào thì không xuất hiện', async () => {
      db.readingSubs.seed({ user_id: 1n, score: 5, total: 5 });
      const res = await get('/api/statistics').expect(200);
      expect(res.body.accuracy).toEqual([
        { type: 'reading', percent: 100, sessions: 1 },
      ]);
    });
  });

  describe('lịch', () => {
    const days = async (
      year: number,
      month: number,
    ): Promise<{ year: number; month: number; activeDays: number[] }> => {
      const res = await get(
        `/api/statistics/calendar?year=${year}&month=${month}`,
      ).expect(200);
      return res.body as { year: number; month: number; activeDays: number[] };
    };

    it('trả các ngày trong tháng có buổi học, không trùng, có thứ tự, không lẫn user khác/tháng khác', async () => {
      await boot({ APP_TIMEZONE: 'UTC' });
      const at = (iso: string, user = 1n) =>
        db.sessions.seed({
          user_id: user,
          type: 'reading',
          duration_seconds: 1,
          completed_at: new Date(iso),
        });
      at('2026-09-21T08:00:00Z');
      at('2026-09-21T20:00:00Z'); // cùng ngày
      at('2026-09-03T00:00:00Z');
      at('2026-09-30T23:59:59Z');
      at('2026-08-31T23:59:59Z'); // tháng trước
      at('2026-10-01T00:00:00Z'); // tháng sau
      at('2026-09-10T00:00:00Z', 2n); // user khác

      expect(await days(2026, 9)).toEqual({
        year: 2026,
        month: 9,
        activeDays: [3, 21, 30],
      });
      expect((await days(2026, 8)).activeDays).toEqual([31]);
      expect((await days(2026, 10)).activeDays).toEqual([1]);
      expect((await days(2026, 11)).activeDays).toEqual([]);
    });

    it('tính ngày theo múi giờ của người học: 01:00 sáng ngày 1/9 giờ Việt Nam thuộc tháng 9, không phải tháng 8', async () => {
      await boot({ APP_TIMEZONE: 'Asia/Ho_Chi_Minh' });
      // 18:00 UTC ngày 31/8 = 01:00 sáng 1/9 ở Việt Nam
      db.sessions.seed({
        user_id: 1n,
        type: 'vocabulary',
        duration_seconds: 1,
        completed_at: new Date('2026-08-31T18:00:00Z'),
      });
      expect((await days(2026, 9)).activeDays).toEqual([1]);
      expect((await days(2026, 8)).activeDays).toEqual([]);
    });

    it('tham số sai: thiếu, ngoài khoảng, không phải số -> 400', async () => {
      await boot();
      await get('/api/statistics/calendar').expect(400);
      await get('/api/statistics/calendar?year=2026').expect(400);
      await get('/api/statistics/calendar?year=2026&month=13').expect(400);
      await get('/api/statistics/calendar?year=2026&month=0').expect(400);
      await get('/api/statistics/calendar?year=abc&month=9').expect(400);
      await get('/api/statistics/calendar?year=1900&month=9').expect(400);
    });
  });
});
