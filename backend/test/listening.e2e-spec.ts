import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ListeningService } from '../src/listening/listening.service';
import { bootApp, cookieFor, makeUser } from './helpers/app';
import { FakeTable } from './helpers/fake-table';
import { createFakeUsers, enableBigIntJson } from './helpers/fake-users';

type R = Record<string, unknown>;

function createDb() {
  const users = createFakeUsers();
  const passages = new FakeTable<R>();
  const questions = new FakeTable<R>();
  const submissions = new FakeTable<R>();
  const sessions = new FakeTable<R>();

  const fake = {
    users: users.delegate,
    listening_passages: {
      findMany: passages.findMany,
      create: passages.create,
      findUnique: (args: { where: R; include?: unknown }) =>
        passages.findUnique(args).then((p) =>
          p && args.include
            ? {
                ...p,
                listening_questions: questions.rows
                  .filter((q) => q.passage_id === p.id)
                  .sort((a, b) => Number(a.order) - Number(b.order)),
              }
            : p,
        ),
    },
    listening_questions: questions,
    listening_submissions: {
      findMany: (args?: { include?: unknown; where?: R; orderBy?: R }) =>
        submissions.findMany(args).then((rows) =>
          args?.include
            ? rows.map((r) => ({
                ...r,
                listening_passages: passages.rows.find(
                  (p) => p.id === r.passage_id,
                ),
              }))
            : rows,
        ),
      create: submissions.create,
    },
    study_sessions: sessions,
    $transaction: <T>(fn: (tx: unknown) => Promise<T>) => fn(fake),
  };
  return { fake, users, passages, questions, submissions, sessions };
}

const geminiOk = (payload: unknown) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
    { status: 200 },
  );

const generated = {
  title: 'Booking a Bike',
  transcript: 'Anna: Hi. I would like to rent a bike.',
  questions: [
    {
      type: 'fill',
      question: 'What does Anna rent?',
      options: [],
      correct_answer: ['bike'],
    },
    {
      type: 'boolean',
      question: 'Anna is happy.',
      options: [],
      correct_answer: ['True'],
    },
  ],
};

describe('Listening (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<typeof createDb>;
  let fetchMock: jest.SpyInstance;
  let cookie: string;

  beforeAll(enableBigIntJson);

  const boot = async (env: Record<string, string> = {}) => {
    db = createDb();
    db.users.rows.push(makeUser(1n), makeUser(2n));
    app = await bootApp(db.fake, env);
    cookie = cookieFor(app, 1);
  };
  const as = (id: number) => cookieFor(app, id);
  const get = (path: string, c = cookie) =>
    request(app.getHttpServer()).get(path).set('Cookie', c);
  const post = (path: string, body: object = {}, c = cookie) =>
    request(app.getHttpServer()).post(path).set('Cookie', c).send(body);
  const idle = () => app.get(ListeningService).whenIdle();

  const seedPassage = (
    id: bigint,
    topic = 'everyday_conversation',
    level: string | null = null,
  ) => {
    db.passages.seed({
      id,
      topic,
      level,
      title: `Clip ${id}`,
      transcript: `SECRET TRANSCRIPT ${id}`,
    });
    const q = (n: number, type: string, opts: string[], correct: string[]) =>
      db.questions.seed({
        id: id * 10n + BigInt(n),
        passage_id: id,
        type,
        question: `Q${n}`,
        options: JSON.stringify(opts),
        correct_answer: JSON.stringify(correct),
        order: n,
      });
    q(0, 'fill', [], ['bike']);
    q(1, 'boolean', [], ['True']);
    q(2, 'mcq', ['a', 'b', 'c'], ['b']);
    q(3, 'multi', ['a', 'b', 'c', 'd'], ['a', 'c']);
  };
  const qid = (p: number, n: number) => String(p * 10 + n);
  const allCorrect = (p: number) => ({
    [qid(p, 0)]: 'bike',
    [qid(p, 1)]: 'True',
    [qid(p, 2)]: 'b',
    [qid(p, 3)]: ['a', 'c'],
  });

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  describe('truy cập & tham số', () => {
    beforeEach(() => boot());

    it('401 khi chưa đăng nhập', async () => {
      const s = request(app.getHttpServer());
      await s.get('/api/listening/passages').expect(401);
      await s.get('/api/listening/history').expect(401);
      await s.get('/api/listening/next?topic=general&level=A1').expect(401);
      await s.get('/api/listening/passages/1').expect(401);
      await s.post('/api/listening/passages/1/play').expect(401);
      await s.post('/api/listening/passages/1/submit').send({}).expect(401);
    });

    it('/next: chủ đề lạ 400; general phải có level A1-C1', async () => {
      await get('/api/listening/next?topic=cooking').expect(400);
      await get('/api/listening/next?topic=general').expect(400);
      await get('/api/listening/next?topic=general&level=C2').expect(400);
      await get('/api/listening/next?topic=general&level=A1').expect(200);
    });

    it('id không phải số 400; không tồn tại 404', async () => {
      await get('/api/listening/passages/abc').expect(400);
      await get('/api/listening/passages/9').expect(404);
      await post('/api/listening/passages/9/play').expect(404);
      await post('/api/listening/passages/9/submit', { answers: {} }).expect(
        404,
      );
    });
  });

  describe('danh sách, lịch sử, chọn bài', () => {
    beforeEach(() => boot());

    it('liệt kê bài mới nhất trước, bỏ topic general', async () => {
      seedPassage(1n, 'academic_lecture');
      seedPassage(2n, 'general', 'A1');
      seedPassage(3n, 'social_monologue');
      const res = await get('/api/listening/passages').expect(200);
      expect(res.body.items.map((i: { id: number }) => i.id)).toEqual([3, 1]);
    });

    it('lịch sử chỉ của user hiện tại, mới nhất trước', async () => {
      seedPassage(1n);
      seedPassage(2n, 'academic_lecture');
      db.submissions.seed(
        {
          user_id: 1n,
          passage_id: 1n,
          score: 2,
          total: 4,
          created_at: new Date('2026-09-01T00:00:00Z'),
        },
        {
          user_id: 1n,
          passage_id: 2n,
          score: 4,
          total: 4,
          created_at: new Date('2026-09-02T00:00:00Z'),
        },
        {
          user_id: 2n,
          passage_id: 1n,
          score: 0,
          total: 4,
          created_at: new Date('2026-09-03T00:00:00Z'),
        },
      );
      const res = await get('/api/listening/history').expect(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0]).toMatchObject({
        passageId: 2,
        topic: 'academic_lecture',
        score: 4,
        total: 4,
      });
    });

    it('/next general chỉ lấy đúng cấp; ưu tiên bài chưa nộp/chưa xem/khác bài đang xem', async () => {
      seedPassage(1n, 'general', 'A1');
      seedPassage(2n, 'general', 'A1');
      seedPassage(3n, 'general', 'B1');
      const next = async (qs: string): Promise<number | null> =>
        (
          (await get(`/api/listening/next?${qs}`).expect(200)).body as {
            passageId: number | null;
          }
        ).passageId;

      for (let i = 0; i < 8; i++) {
        expect([1, 2]).toContain(await next('topic=general&level=A1'));
        expect(await next('topic=general&level=B1')).toBe(3);
        expect(await next('topic=general&level=A1&seen=1')).toBe(2);
        expect(await next('topic=general&level=A1&exclude=2')).toBe(1);
      }
      expect(await next('topic=general&level=C1')).toBeNull();
    });

    it('chủ đề không phải general bỏ qua tham số level (cấp độ đã cố định)', async () => {
      seedPassage(1n, 'academic_lecture', null);
      const res = await get(
        '/api/listening/next?topic=academic_lecture&level=A1',
      ).expect(200);
      expect(res.body.passageId).toBe(1);
    });
  });

  describe('làm bài: transcript ẩn + giới hạn lượt nghe', () => {
    beforeEach(async () => {
      await boot();
      seedPassage(1n);
    });

    it('trang bài KHÔNG chứa transcript và đáp án đúng; báo số lượt nghe còn lại', async () => {
      const res = await get('/api/listening/passages/1').expect(200);
      expect(res.body).toMatchObject({
        id: 1,
        title: 'Clip 1',
        maxPlays: 3,
        playsLeft: 3,
      });
      expect(res.body.questions.map((q: { type: string }) => q.type)).toEqual([
        'fill',
        'boolean',
        'mcq',
        'multi',
      ]);
      expect(res.body.questions[2].options).toEqual(['a', 'b', 'c']);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('SECRET');
      expect(text).not.toContain('transcript');
      expect(text).not.toContain('correct');
    });

    it('mỗi lần bấm nghe trả lời thoại và trừ 1 lượt; hết 3 lượt thì từ chối và KHÔNG lộ lời thoại', async () => {
      for (const left of [2, 1, 0]) {
        const res = await post('/api/listening/passages/1/play').expect(200);
        expect(res.body).toEqual({
          allowed: true,
          text: 'SECRET TRANSCRIPT 1',
          playsLeft: left,
        });
      }
      const denied = await post('/api/listening/passages/1/play').expect(200);
      expect(denied.body).toEqual({ allowed: false, text: '', playsLeft: 0 });
      expect(JSON.stringify(denied.body)).not.toContain('SECRET');
    });

    it('tải lại trang KHÔNG được thêm lượt nghe (đếm trên server)', async () => {
      await post('/api/listening/passages/1/play');
      await post('/api/listening/passages/1/play');
      const res = await get('/api/listening/passages/1').expect(200);
      expect(res.body.playsLeft).toBe(1);
    });

    it('lượt nghe tính riêng theo user và theo bài', async () => {
      seedPassage(2n);
      await post('/api/listening/passages/1/play');
      await post('/api/listening/passages/1/play');
      await post('/api/listening/passages/1/play');
      expect(
        (await post('/api/listening/passages/1/play', {}, as(2))).body.allowed,
      ).toBe(true);
      expect((await post('/api/listening/passages/2/play')).body.allowed).toBe(
        true,
      );
      expect((await post('/api/listening/passages/1/play')).body.allowed).toBe(
        false,
      );
    });
  });

  describe('nộp bài', () => {
    beforeEach(async () => {
      await boot();
      seedPassage(1n);
    });
    const submit = (answers: object, extra: object = {}) =>
      post('/api/listening/passages/1/submit', { answers, ...extra });

    it('chấm điểm, trả đáp án đúng + lời thoại (chỉ lộ sau khi nộp), lưu bài và buổi học', async () => {
      const res = await submit(
        { ...allCorrect(1), [qid(1, 2)]: 'c' },
        { durationSeconds: 90 },
      ).expect(200);
      expect(res.body.score).toBe(3);
      expect(res.body.total).toBe(4);
      expect(res.body.transcript).toBe('SECRET TRANSCRIPT 1');
      expect(res.body.results[2]).toEqual({
        questionId: 12,
        isCorrect: false,
        correctAnswer: ['b'],
      });

      expect(db.submissions.rows[0]).toMatchObject({
        user_id: 1n,
        passage_id: 1n,
        score: 3,
        total: 4,
      });
      expect(JSON.parse(String(db.submissions.rows[0].answers))).toEqual({
        ...allCorrect(1),
        [qid(1, 2)]: 'c',
      });
      expect(db.sessions.rows[0]).toMatchObject({
        user_id: 1n,
        type: 'listening',
        duration_seconds: 90,
      });
    });

    it('nộp xong thì lượt nghe được đặt lại cho lần làm lại', async () => {
      await post('/api/listening/passages/1/play');
      await post('/api/listening/passages/1/play');
      await submit(allCorrect(1)).expect(200);
      const res = await get('/api/listening/passages/1').expect(200);
      expect(res.body.playsLeft).toBe(3);
    });

    it('thiếu câu / sai kiểu / body sai: 400 và không lưu gì', async () => {
      const { [qid(1, 3)]: _omit, ...missing } = allCorrect(1);
      void _omit;
      await submit(missing).expect(400);
      await submit({ ...allCorrect(1), [qid(1, 0)]: 5 }).expect(400);
      await post('/api/listening/passages/1/submit', { answers: 'x' }).expect(
        400,
      );
      await submit(allCorrect(1), { durationSeconds: -1 }).expect(400);
      expect(db.submissions.rows).toHaveLength(0);
      expect(db.sessions.rows).toHaveLength(0);
    });
  });

  describe('kho tự bù', () => {
    it('chủ đề cố định cấp: sinh bài cấp cố định (level = null trong DB), kèm kịch bản ngẫu nhiên và tiêu đề bài đã có', async () => {
      await boot({ GEMINI_API_KEY: 'SHARED' });
      seedPassage(1n, 'social_monologue', null);
      fetchMock.mockResolvedValue(geminiOk(generated));

      await get('/api/listening/passages/1').expect(200);
      await idle();

      const prompt = String(
        JSON.parse(
          (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
        ).contents[0].parts[0].text,
      );
      expect(prompt).toContain('CEFR level B1'); // social_monologue luôn B1
      expect(prompt).toContain('Specific scenario to base this clip on:');
      expect(prompt).toContain('"Clip 1"'); // tránh trùng bài đang có
      expect(prompt).toContain('single-speaker monologue');

      expect(db.passages.rows).toHaveLength(2);
      expect(db.passages.rows[1]).toMatchObject({
        topic: 'social_monologue',
        level: null,
        title: 'Booking a Bike',
        transcript: 'Anna: Hi. I would like to rent a bike.',
      });
      expect(
        db.questions.rows.filter(
          (q) => q.passage_id === db.passages.rows[1].id,
        ),
      ).toHaveLength(2);
    });

    it('general: bài mới mang cấp độ của bài đang mở; chỉ gửi tiêu đề cùng cấp', async () => {
      await boot({ GEMINI_API_KEY: 'SHARED' });
      seedPassage(1n, 'general', 'B1');
      seedPassage(2n, 'general', 'A1');
      fetchMock.mockResolvedValue(geminiOk(generated));

      await get('/api/listening/passages/1').expect(200);
      await idle();

      const prompt = String(
        JSON.parse(
          (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
        ).contents[0].parts[0].text,
      );
      expect(prompt).toContain('CEFR level B1');
      expect(prompt).toContain('"Clip 1"');
      expect(prompt).not.toContain('"Clip 2"'); // bài cấp A1 không liên quan
      expect(db.passages.rows[2]).toMatchObject({
        topic: 'general',
        level: 'B1',
      });
    });

    it('AI trả bài hỏng thì bỏ; AI lỗi hoặc không có key thì người dùng vẫn vào làm bình thường', async () => {
      await boot({ GEMINI_API_KEY: 'SHARED' });
      seedPassage(1n);
      fetchMock.mockResolvedValueOnce(
        geminiOk({ ...generated, transcript: '' }),
      );
      await get('/api/listening/passages/1').expect(200);
      await idle();
      expect(db.passages.rows).toHaveLength(1);

      fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
      const res = await get('/api/listening/passages/1').expect(200);
      await idle();
      expect(res.body.title).toBe('Clip 1');
      expect(db.passages.rows).toHaveLength(1);
      await app.close();

      await boot(); // không có key
      seedPassage(1n);
      fetchMock.mockClear();
      await get('/api/listening/passages/1').expect(200);
      await idle();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
