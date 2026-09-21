import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ReadingService } from '../src/reading/reading.service';
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

  const withQuestions = (p: R | null) =>
    p && {
      ...p,
      reading_questions: questions.rows
        .filter((q) => q.passage_id === p.id)
        .sort((a, b) => Number(a.order) - Number(b.order)),
    };

  const fake = {
    users: users.delegate,
    reading_passages: {
      findMany: passages.findMany,
      create: passages.create,
      findUnique: (args: { where: R; include?: unknown }) =>
        passages
          .findUnique(args)
          .then((p) => (args.include ? withQuestions(p) : p)),
    },
    reading_questions: questions,
    reading_submissions: {
      findMany: (args?: { include?: unknown; where?: R; orderBy?: R }) =>
        submissions.findMany(args).then((rows) =>
          args?.include
            ? rows.map((r) => ({
                ...r,
                reading_passages: passages.rows.find(
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

describe('Reading (e2e)', () => {
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
  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Cookie', cookie);
  const post = (path: string, body: object) =>
    request(app.getHttpServer()).post(path).set('Cookie', cookie).send(body);
  const idle = () => app.get(ReadingService).whenIdle();

  // Bài 1 (id) có 5 câu đủ 4 loại; dữ liệu lưu theo định dạng Laravel (options/correct_answer là chuỗi JSON)
  const seedPassage = (
    id: bigint,
    topic = 'technology',
    level: string | null = 'B2',
  ) => {
    db.passages.seed({
      id,
      topic,
      level,
      title: `Title ${id}`,
      content: `Content ${id}`,
    });
    const q = (n: number, type: string, options: string[], correct: string[]) =>
      db.questions.seed({
        id: id * 10n + BigInt(n),
        passage_id: id,
        type,
        question: `Q${n}`,
        options: JSON.stringify(options),
        correct_answer: JSON.stringify(correct),
        order: n,
      });
    q(0, 'fill', [], ['solar panels']);
    q(1, 'boolean', [], ['True']);
    q(2, 'mcq', ['red', 'green', 'blue'], ['green']);
    q(3, 'multi', ['a', 'b', 'c', 'd'], ['a', 'c']);
    q(4, 'fill', [], ['wind']);
  };
  const qid = (passage: number, n: number) => String(passage * 10 + n);
  const allCorrect = (p: number) => ({
    [qid(p, 0)]: 'solar panels',
    [qid(p, 1)]: 'True',
    [qid(p, 2)]: 'green',
    [qid(p, 3)]: ['a', 'c'],
    [qid(p, 4)]: 'wind',
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
      await s.get('/api/reading/passages').expect(401);
      await s.get('/api/reading/history').expect(401);
      await s.get('/api/reading/next?topic=general&level=A1').expect(401);
      await s.get('/api/reading/passages/1').expect(401);
      await s.post('/api/reading/passages/1/submit').send({}).expect(401);
    });

    it('/next: chủ đề lạ 400; general phải có level A1-C1', async () => {
      await get('/api/reading/next?topic=cooking').expect(400);
      await get('/api/reading/next?topic=general').expect(400);
      await get('/api/reading/next?topic=general&level=C2').expect(400);
      await get('/api/reading/next?topic=general&level=A1').expect(200);
    });

    it('id bài không phải số 400, không tồn tại 404', async () => {
      await get('/api/reading/passages/abc').expect(400);
      await get('/api/reading/passages/999').expect(404);
      await post('/api/reading/passages/999/submit', { answers: {} }).expect(
        404,
      );
    });
  });

  describe('danh sách & lịch sử', () => {
    beforeEach(() => boot());

    it('liệt kê bài mới nhất trước, bỏ topic general (đi theo cấp độ)', async () => {
      seedPassage(1n, 'technology');
      seedPassage(2n, 'general', 'A1');
      seedPassage(3n, 'health');
      const res = await get('/api/reading/passages').expect(200);
      expect(res.body.items.map((i: { id: number }) => i.id)).toEqual([3, 1]);
      expect(res.body.items[0]).toEqual({
        id: 3,
        topic: 'health',
        title: 'Title 3',
        level: 'B2',
      });
    });

    it('lịch sử chỉ của user hiện tại, mới nhất trước', async () => {
      seedPassage(1n);
      seedPassage(2n, 'health');
      db.submissions.seed(
        {
          user_id: 1n,
          passage_id: 1n,
          score: 3,
          total: 5,
          created_at: new Date('2026-09-01T00:00:00Z'),
        },
        {
          user_id: 1n,
          passage_id: 2n,
          score: 5,
          total: 5,
          created_at: new Date('2026-09-02T00:00:00Z'),
        },
        {
          user_id: 2n,
          passage_id: 1n,
          score: 1,
          total: 5,
          created_at: new Date('2026-09-03T00:00:00Z'),
        },
      );
      const res = await get('/api/reading/history').expect(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0]).toMatchObject({
        passageId: 2,
        topic: 'health',
        title: 'Title 2',
        score: 5,
        total: 5,
      });
    });
  });

  describe('chọn bài kế tiếp (/next)', () => {
    beforeEach(async () => {
      await boot();
      seedPassage(1n, 'general', 'A1');
      seedPassage(2n, 'general', 'A1');
      seedPassage(3n, 'general', 'B1');
      seedPassage(4n, 'science', 'B2');
    });
    const next = async (qs: string): Promise<number | null> => {
      const res = await get(`/api/reading/next?${qs}`).expect(200);
      return (res.body as { passageId: number | null }).passageId;
    };

    it('đúng chủ đề và cấp độ', async () => {
      for (let i = 0; i < 10; i++) {
        expect([1, 2]).toContain(await next('topic=general&level=A1'));
        expect(await next('topic=general&level=B1')).toBe(3);
        expect(await next('topic=science')).toBe(4);
      }
    });

    it('ưu tiên bài chưa nộp; bài user khác nộp không ảnh hưởng', async () => {
      db.submissions.seed(
        { user_id: 1n, passage_id: 1n },
        { user_id: 2n, passage_id: 2n },
      );
      for (let i = 0; i < 8; i++) {
        expect(await next('topic=general&level=A1')).toBe(2);
      }
    });

    it('tránh cả bài vừa xem trong phiên (seen) dù chưa nộp, và bài đang xem (exclude)', async () => {
      for (let i = 0; i < 8; i++) {
        expect(await next('topic=general&level=A1&seen=1')).toBe(2);
        expect(await next('topic=general&level=A1&exclude=2')).toBe(1);
      }
    });

    it('xem hết thì vẫn ra bài nhưng KHÔNG phải bài đang xem nếu còn bài khác', async () => {
      db.submissions.seed(
        { user_id: 1n, passage_id: 1n },
        { user_id: 1n, passage_id: 2n },
      );
      for (let i = 0; i < 8; i++) {
        expect(await next('topic=general&level=A1&exclude=1')).toBe(2);
      }
    });

    it('chỉ còn đúng 1 bài và đó là bài đang xem thì vẫn trả bài đó', async () => {
      expect(await next('topic=general&level=B1&exclude=3')).toBe(3);
    });

    it('kho trống thì passageId null; seen rác bị bỏ qua', async () => {
      expect(await next('topic=history')).toBeNull();
      expect(await next('topic=science&seen=abc,-5,0,4')).toBe(4);
    });
  });

  describe('lấy bài để làm', () => {
    beforeEach(() => boot());

    it('trả bài + câu hỏi theo thứ tự, options đã parse, KHÔNG lộ đáp án đúng', async () => {
      seedPassage(1n);
      const res = await get('/api/reading/passages/1').expect(200);
      expect(res.body).toMatchObject({
        id: 1,
        topic: 'technology',
        title: 'Title 1',
        content: 'Content 1',
      });
      expect(res.body.questions.map((q: { type: string }) => q.type)).toEqual([
        'fill',
        'boolean',
        'mcq',
        'multi',
        'fill',
      ]);
      expect(res.body.questions[2].options).toEqual(['red', 'green', 'blue']);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('correct');
      expect(text).not.toContain('solar panels');
    });

    it('options hỏng trong DB không làm sập, chỉ thành mảng rỗng', async () => {
      seedPassage(1n);
      db.questions.rows[2].options = '{hong';
      const res = await get('/api/reading/passages/1').expect(200);
      expect(res.body.questions[2].options).toEqual([]);
    });
  });

  describe('nộp bài', () => {
    beforeEach(async () => {
      await boot();
      seedPassage(1n);
    });
    const submit = (answers: object, extra: object = {}) =>
      post('/api/reading/passages/1/submit', { answers, ...extra });

    it('chấm đúng cả 5 loại, trả đáp án đúng từng câu, lưu bài + buổi học', async () => {
      const res = await submit(allCorrect(1), { durationSeconds: 200 }).expect(
        200,
      );
      expect(res.body.score).toBe(5);
      expect(res.body.total).toBe(5);
      expect(res.body.results).toHaveLength(5);
      expect(res.body.results[3]).toEqual({
        questionId: 13,
        isCorrect: true,
        correctAnswer: ['a', 'c'],
      });

      expect(db.submissions.rows[0]).toMatchObject({
        user_id: 1n,
        passage_id: 1n,
        score: 5,
        total: 5,
      });
      // đáp án lưu dạng JSON { "<questionId>": ... } như bản Laravel
      expect(JSON.parse(String(db.submissions.rows[0].answers))).toEqual(
        allCorrect(1),
      );
      expect(db.sessions.rows[0]).toMatchObject({
        user_id: 1n,
        type: 'reading',
        duration_seconds: 200,
      });
    });

    it('sai một số câu: điểm đúng, câu sai lộ đáp án đúng', async () => {
      const res = await submit({
        ...allCorrect(1),
        [qid(1, 1)]: 'False',
        [qid(1, 3)]: ['a'],
      }).expect(200);
      expect(res.body.score).toBe(3);
      expect(
        res.body.results.map((r: { isCorrect: boolean }) => r.isCorrect),
      ).toEqual([true, false, true, false, true]);
      expect(res.body.results[1].correctAnswer).toEqual(['True']);
    });

    it('multi: chọn đủ nhưng khác thứ tự vẫn đúng', async () => {
      const res = await submit({
        ...allCorrect(1),
        [qid(1, 3)]: ['c', 'a'],
      }).expect(200);
      expect(res.body.score).toBe(5);
    });

    it('thiếu câu nào là 400 và không lưu gì', async () => {
      const { [qid(1, 4)]: _omit, ...missing } = allCorrect(1);
      void _omit;
      await submit(missing).expect(400);
      expect(db.submissions.rows).toHaveLength(0);
      expect(db.sessions.rows).toHaveLength(0);
    });

    it('đáp án sai kiểu (số, null, object lồng nhau, mảng chứa số) bị coi là chưa trả lời', async () => {
      await submit({ ...allCorrect(1), [qid(1, 0)]: 123 }).expect(400);
      await submit({ ...allCorrect(1), [qid(1, 0)]: null }).expect(400);
      await submit({ ...allCorrect(1), [qid(1, 0)]: { x: 1 } }).expect(400);
      await submit({ ...allCorrect(1), [qid(1, 3)]: ['a', 5] }).expect(400);
      await submit({ ...allCorrect(1), [qid(1, 0)]: 'x'.repeat(501) }).expect(
        400,
      );
      expect(db.submissions.rows).toHaveLength(0);
    });

    it('body sai: answers không phải object, thời gian âm', async () => {
      await post('/api/reading/passages/1/submit', { answers: 'x' }).expect(
        400,
      );
      await post('/api/reading/passages/1/submit', {}).expect(400);
      await submit(allCorrect(1), { durationSeconds: -1 }).expect(400);
    });

    it('bỏ qua câu hỏi của bài khác trong answers: không lưu lẫn vào bài này', async () => {
      await submit({ ...allCorrect(1), '9999': 'lạ' }).expect(200);
      expect(JSON.parse(String(db.submissions.rows[0].answers))).toEqual(
        allCorrect(1),
      );
    });

    it('câu gửi mảng cho loại fill bị chấm sai, không lách được', async () => {
      const res = await submit({
        ...allCorrect(1),
        [qid(1, 0)]: ['solar panels'],
      }).expect(200);
      expect(res.body.results[0].isCorrect).toBe(false);
    });
  });

  describe('kho tự bù (chạy ngầm)', () => {
    const generated = {
      title: 'Wind Energy',
      content: 'Wind turbines produce power.',
      questions: [
        {
          type: 'fill',
          question: 'What spins?',
          options: [],
          correct_answer: ['turbines'],
        },
        {
          type: 'mcq',
          question: 'Pick',
          options: ['a', 'b', 'c', 'd'],
          correct_answer: ['b'],
        },
      ],
    };

    it('mở 1 bài thì sinh thêm 1 bài + câu hỏi cùng chủ đề/cấp độ vào kho', async () => {
      await boot({ GEMINI_API_KEY: 'SHARED' });
      seedPassage(1n, 'technology', 'B1');
      fetchMock.mockResolvedValue(geminiOk(generated));

      await get('/api/reading/passages/1').expect(200);
      await idle();

      const prompt = String(
        JSON.parse(
          (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
        ).contents[0].parts[0].text,
      );
      expect(prompt).toContain('CEFR B1');
      expect(prompt).toContain('công nghệ');

      expect(db.passages.rows).toHaveLength(2);
      expect(db.passages.rows[1]).toMatchObject({
        topic: 'technology',
        level: 'B1',
        title: 'Wind Energy',
      });
      const newQs = db.questions.rows.filter(
        (q) => q.passage_id === db.passages.rows[1].id,
      );
      expect(newQs).toHaveLength(2);
      expect(newQs[1]).toMatchObject({ type: 'mcq', order: 1 });
      expect(JSON.parse(String(newQs[1].options))).toEqual([
        'a',
        'b',
        'c',
        'd',
      ]);
      expect(JSON.parse(String(newQs[1].correct_answer))).toEqual(['b']);
    });

    it('bài cũ không có level thì bù với B2 (mặc định)', async () => {
      await boot({ GEMINI_API_KEY: 'SHARED' });
      seedPassage(1n, 'health', null);
      fetchMock.mockResolvedValue(geminiOk(generated));
      await get('/api/reading/passages/1').expect(200);
      await idle();
      expect(db.passages.rows[1]).toMatchObject({
        topic: 'health',
        level: 'B2',
      });
    });

    it('AI trả bài không chấm được (đáp án không nằm trong lựa chọn) thì bỏ, kho không đổi', async () => {
      await boot({ GEMINI_API_KEY: 'SHARED' });
      seedPassage(1n);
      fetchMock.mockResolvedValue(
        geminiOk({
          ...generated,
          questions: [
            {
              type: 'mcq',
              question: 'Pick',
              options: ['a', 'b'],
              correct_answer: ['zzz'],
            },
          ],
        }),
      );
      await get('/api/reading/passages/1').expect(200);
      await idle();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(db.passages.rows).toHaveLength(1);
    });

    it('không có key thì không gọi Gemini; Gemini lỗi không ảnh hưởng người dùng', async () => {
      await boot();
      seedPassage(1n);
      await get('/api/reading/passages/1').expect(200);
      await idle();
      expect(fetchMock).not.toHaveBeenCalled();
      await app.close();

      await boot({ GEMINI_API_KEY: 'SHARED' });
      seedPassage(1n);
      fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
      const res = await get('/api/reading/passages/1').expect(200);
      await idle();
      expect(res.body.title).toBe('Title 1');
      expect(db.passages.rows).toHaveLength(1);
    });
  });
});
