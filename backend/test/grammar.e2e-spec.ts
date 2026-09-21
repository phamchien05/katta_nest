import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { GrammarService } from '../src/grammar/grammar.service';
import { bootApp, cookieFor, makeUser } from './helpers/app';
import { FakeTable } from './helpers/fake-table';
import { createFakeUsers, enableBigIntJson } from './helpers/fake-users';

type R = Record<string, unknown>;

function createDb() {
  const users = createFakeUsers();
  const topics = new FakeTable<R>();
  const sets = new FakeTable<R>();
  const questions = new FakeTable<R>();
  const sessions = new FakeTable<R>();

  const fake = {
    users: users.delegate,
    grammar_topics: topics,
    grammar_question_sets: {
      ...sets,
      findFirst: sets.findFirst,
      findMany: sets.findMany,
      updateMany: sets.updateMany,
      create: sets.create,
      findUnique: (args: { where: R; include?: unknown }) =>
        sets.findUnique(args).then((s) =>
          s && args.include
            ? {
                ...s,
                grammar_questions: questions.rows
                  .filter((q) => q.set_id === s.id)
                  .sort((a, b) => Number(a.order) - Number(b.order)),
              }
            : s,
        ),
    },
    grammar_questions: questions,
    study_sessions: sessions,
    $transaction: <T>(fn: (tx: unknown) => Promise<T>) => fn(fake),
  };
  return { fake, users, topics, sets, questions, sessions };
}

const geminiOk = (payload: unknown) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
    { status: 200 },
  );

// 35 câu hợp lệ: 14 fill + 14 mcq + 7 multi
const generatedSet = () => ({
  questions: [
    ...Array.from({ length: 14 }, (_, i) => ({
      type: 'fill',
      question: `Fill ${i}`,
      options: [],
      correct_answer: ['is'],
    })),
    ...Array.from({ length: 14 }, (_, i) => ({
      type: 'mcq',
      question: `Mcq ${i}`,
      options: ['a', 'b', 'c', 'd'],
      correct_answer: ['b'],
    })),
    ...Array.from({ length: 7 }, (_, i) => ({
      type: 'multi',
      question: `Multi ${i}`,
      options: ['a', 'b', 'c', 'd'],
      correct_answer: ['a', 'c'],
    })),
  ],
});

describe('Grammar (e2e)', () => {
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
  const as = (userId: number) => cookieFor(app, userId);
  const get = (path: string, c = cookie) =>
    request(app.getHttpServer()).get(path).set('Cookie', c);
  const post = (path: string, body: object = {}, c = cookie) =>
    request(app.getHttpServer()).post(path).set('Cookie', c).send(body);
  const idle = () => app.get(GrammarService).whenIdle();

  // Bộ đề có 3 câu (fill, mcq, multi); id câu = setId*10 + n. Định dạng lưu như bản Laravel.
  const seedSet = (id: bigint, extra: R = {}) => {
    db.sets.seed({
      id,
      topic_key: 'tenses',
      status: 'available',
      replenish_dispatched: false,
      user_id: null,
      score: null,
      total: null,
      answers: null,
      ...extra,
    });
    const q = (n: number, type: string, opts: string[], correct: string[]) =>
      db.questions.seed({
        id: id * 10n + BigInt(n),
        set_id: id,
        type,
        question: `Q${n}`,
        options: JSON.stringify(opts),
        correct_answer: JSON.stringify(correct),
        order: n,
      });
    q(0, 'fill', [], ['is']);
    q(1, 'mcq', ['a', 'b', 'c'], ['b']);
    q(2, 'multi', ['a', 'b', 'c', 'd'], ['a', 'c']);
  };
  const qid = (set: number, n: number) => String(set * 10 + n);
  const correctFor = (set: number) => ({
    [qid(set, 0)]: 'is',
    [qid(set, 1)]: 'b',
    [qid(set, 2)]: ['a', 'c'],
  });

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  describe('truy cập', () => {
    beforeEach(() => boot());

    it('401 khi chưa đăng nhập', async () => {
      const s = request(app.getHttpServer());
      await s.get('/api/grammar/topics').expect(401);
      await s.get('/api/grammar/topics/x').expect(401);
      await s.get('/api/grammar/practice/history').expect(401);
      await s.post('/api/grammar/practice/tenses/start').expect(401);
      await s.get('/api/grammar/practice/sets/1').expect(401);
      await s.post('/api/grammar/practice/sets/1/submit').send({}).expect(401);
    });
  });

  describe('Phần A: lý thuyết', () => {
    beforeEach(async () => {
      await boot();
      db.topics.seed(
        {
          id: 2n,
          parent_id: 1n,
          title: 'Present',
          slug: 'present',
          order: 2,
          content_en: '<p>EN</p>',
          content_vi: '<p>VI</p>',
        },
        {
          id: 1n,
          parent_id: null,
          title: 'Tenses',
          slug: 'tenses',
          order: 1,
          content_en: null,
          content_vi: null,
        },
        {
          id: 3n,
          parent_id: 1n,
          title: 'Empty',
          slug: 'empty',
          order: 3,
          content_en: '',
          content_vi: '',
        },
        {
          id: 4n,
          parent_id: 1n,
          title: 'ViOnly',
          slug: 'vi-only',
          order: 4,
          content_en: null,
          content_vi: '<p>chỉ VI</p>',
        },
      );
    });

    it('trả cây phẳng theo thứ tự, kèm cờ hasContent, KHÔNG kèm nội dung', async () => {
      const res = await get('/api/grammar/topics').expect(200);
      expect(res.body.topics.map((t: { slug: string }) => t.slug)).toEqual([
        'tenses',
        'present',
        'empty',
        'vi-only',
      ]);
      expect(
        Object.fromEntries(
          res.body.topics.map((t: { slug: string; hasContent: boolean }) => [
            t.slug,
            t.hasContent,
          ]),
        ),
      ).toEqual({
        tenses: false,
        present: true,
        empty: false,
        'vi-only': true,
      });
      expect(res.body.topics[1]).toMatchObject({
        id: 2,
        parentId: 1,
        title: 'Present',
      });
      expect(res.body.topics[0].parentId).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain('<p>');
    });

    it('lấy nội dung 1 bài theo slug (cả hai ngôn ngữ); slug lạ 404', async () => {
      const res = await get('/api/grammar/topics/present').expect(200);
      expect(res.body).toEqual({
        id: 2,
        title: 'Present',
        slug: 'present',
        contentEn: '<p>EN</p>',
        contentVi: '<p>VI</p>',
      });
      await get('/api/grammar/topics/khong-co').expect(404);
    });
  });

  describe('Phần B: nhận bộ đề (start)', () => {
    beforeEach(() => boot());

    it('nhận 1 bộ "available" của đúng chủ đề, chuyển sang in_progress và gán cho user', async () => {
      seedSet(1n, { topic_key: 'question-forms' });
      seedSet(2n, { topic_key: 'tenses' });

      const res = await post('/api/grammar/practice/tenses/start').expect(200);
      expect(res.body).toEqual({ setId: 2 });
      expect(db.sets.rows.find((s) => s.id === 2n)).toMatchObject({
        status: 'in_progress',
        user_id: 1n,
      });
      expect(db.sets.rows.find((s) => s.id === 2n)?.started_at).toBeInstanceOf(
        Date,
      );
      // bộ của chủ đề khác không bị đụng tới
      expect(db.sets.rows.find((s) => s.id === 1n)?.status).toBe('available');
    });

    it('hai người nhận lần lượt thì mỗi người một bộ khác nhau', async () => {
      seedSet(1n);
      seedSet(2n);
      const a = await post('/api/grammar/practice/tenses/start').expect(200);
      const b = await post(
        '/api/grammar/practice/tenses/start',
        {},
        as(2),
      ).expect(200);
      expect(new Set([a.body.setId, b.body.setId])).toEqual(new Set([1, 2]));
    });

    it('bộ đang làm / đã làm của người khác không bị lấy', async () => {
      seedSet(1n, { status: 'in_progress', user_id: 2n });
      seedSet(2n, { status: 'completed', user_id: 2n });
      seedSet(3n);
      expect(
        (await post('/api/grammar/practice/tenses/start').expect(200)).body
          .setId,
      ).toBe(3);
    });

    it('chủ đề không hợp lệ: 404', async () => {
      await post('/api/grammar/practice/khong-co/start').expect(404);
    });

    it('kho rỗng và không có key Gemini: 503', async () => {
      await post('/api/grammar/practice/tenses/start').expect(503);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('kho rỗng có key: sinh đồng bộ 1 bộ 35 câu, dùng tài liệu lý thuyết, giao thẳng cho user', async () => {
      await app.close();
      await boot({ GEMINI_API_KEY: 'SHARED' });
      db.topics.seed(
        {
          id: 1n,
          parent_id: null,
          title: 'Tenses',
          slug: 'tenses',
          order: 1,
          content_en: null,
        },
        {
          id: 2n,
          parent_id: 1n,
          title: 'Present Simple',
          slug: 'ps',
          order: 2,
          content_en: '<p>Habits and facts</p>',
        },
      );
      fetchMock.mockResolvedValue(geminiOk(generatedSet()));

      const res = await post('/api/grammar/practice/tenses/start').expect(200);

      const body = JSON.parse(
        (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      const prompt = String(body.contents[0].parts[0].text);
      expect(prompt).toContain('Habits and facts');
      expect(prompt).toContain('topic "Tenses"');

      expect(db.sets.rows).toHaveLength(1);
      expect(db.sets.rows[0]).toMatchObject({
        id: BigInt(res.body.setId),
        topic_key: 'tenses',
        status: 'in_progress',
        user_id: 1n,
      });
      expect(db.questions.rows).toHaveLength(35);
      // thứ tự đã được xáo: không còn dồn cục theo loại như lúc AI trả về
      const types = db.questions.rows.map((q) => q.type).join(',');
      expect(types).not.toBe(
        generatedSet()
          .questions.map((q) => q.type)
          .join(','),
      );
      expect(
        JSON.parse(
          String(
            db.questions.rows.find((q) => q.type === 'multi')?.correct_answer,
          ),
        ),
      ).toEqual(['a', 'c']);
    });

    it('kho rỗng, AI trả bộ hỏng: 503 và không lưu gì', async () => {
      await app.close();
      await boot({ GEMINI_API_KEY: 'SHARED' });
      db.topics.seed(
        {
          id: 1n,
          parent_id: null,
          title: 'Tenses',
          slug: 'tenses',
          order: 1,
          content_en: null,
        },
        {
          id: 2n,
          parent_id: 1n,
          title: 'PS',
          slug: 'ps',
          order: 2,
          content_en: '<p>x</p>',
        },
      );
      fetchMock.mockResolvedValue(
        geminiOk({ questions: generatedSet().questions.slice(0, 5) }),
      );
      await post('/api/grammar/practice/tenses/start').expect(503);
      expect(db.sets.rows).toHaveLength(0);
    });
  });

  describe('mở bộ đề (getSet) & bù kho', () => {
    it('chỉ chủ sở hữu xem được: 403 với người khác, 404 nếu không tồn tại', async () => {
      await boot();
      seedSet(1n, { status: 'in_progress', user_id: 1n });
      await get('/api/grammar/practice/sets/1', as(2)).expect(403);
      await get('/api/grammar/practice/sets/999').expect(404);
      await get('/api/grammar/practice/sets/abc').expect(400);
      // bộ còn "available" chưa thuộc ai thì cũng không ai xem được
      seedSet(2n);
      await get('/api/grammar/practice/sets/2').expect(403);
    });

    it('câu hỏi theo thứ tự, options đã parse, KHÔNG lộ đáp án khi chưa nộp', async () => {
      await boot();
      seedSet(1n, { status: 'in_progress', user_id: 1n });
      const res = await get('/api/grammar/practice/sets/1').expect(200);
      expect(res.body).toMatchObject({
        id: 1,
        topicKey: 'tenses',
        status: 'in_progress',
      });
      expect(res.body.questions.map((q: { type: string }) => q.type)).toEqual([
        'fill',
        'mcq',
        'multi',
      ]);
      expect(res.body.questions[1].options).toEqual(['a', 'b', 'c']);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('correct');
      expect(text).not.toContain('"is"');
    });

    it('bù kho ĐÚNG 1 lần dù mở lại nhiều lần: sinh 1 bộ mới vào kho (available)', async () => {
      await boot({ GEMINI_API_KEY: 'SHARED' });
      seedSet(1n, { status: 'in_progress', user_id: 1n });
      db.topics.seed(
        {
          id: 1n,
          parent_id: null,
          title: 'Tenses',
          slug: 'tenses',
          order: 1,
          content_en: null,
        },
        {
          id: 2n,
          parent_id: 1n,
          title: 'PS',
          slug: 'ps',
          order: 2,
          content_en: '<p>x</p>',
        },
      );
      fetchMock.mockResolvedValue(geminiOk(generatedSet()));

      await get('/api/grammar/practice/sets/1').expect(200);
      await idle();
      await get('/api/grammar/practice/sets/1').expect(200);
      await get('/api/grammar/practice/sets/1').expect(200);
      await idle();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(db.sets.rows.find((s) => s.id === 1n)?.replenish_dispatched).toBe(
        true,
      );
      const added = db.sets.rows.filter((s) => s.id !== 1n);
      expect(added).toHaveLength(1);
      expect(added[0]).toMatchObject({
        topic_key: 'tenses',
        status: 'available',
        user_id: null,
      });
      expect(
        db.questions.rows.filter((q) => q.set_id === added[0].id),
      ).toHaveLength(35);
    });

    it('nhiều lần mở đồng thời cũng chỉ bù 1 lần', async () => {
      await boot({ GEMINI_API_KEY: 'SHARED' });
      seedSet(1n, { status: 'in_progress', user_id: 1n });
      db.topics.seed(
        {
          id: 1n,
          parent_id: null,
          title: 'Tenses',
          slug: 'tenses',
          order: 1,
          content_en: null,
        },
        {
          id: 2n,
          parent_id: 1n,
          title: 'PS',
          slug: 'ps',
          order: 2,
          content_en: '<p>x</p>',
        },
      );
      fetchMock.mockResolvedValue(geminiOk(generatedSet()));

      await Promise.all(
        [1, 2, 3, 4].map(() => get('/api/grammar/practice/sets/1').expect(200)),
      );
      await idle();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('AI lỗi thì người dùng vẫn vào làm bình thường', async () => {
      await boot({ GEMINI_API_KEY: 'SHARED' });
      seedSet(1n, { status: 'in_progress', user_id: 1n });
      db.topics.seed(
        {
          id: 1n,
          parent_id: null,
          title: 'Tenses',
          slug: 'tenses',
          order: 1,
          content_en: null,
        },
        {
          id: 2n,
          parent_id: 1n,
          title: 'PS',
          slug: 'ps',
          order: 2,
          content_en: '<p>x</p>',
        },
      );
      fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
      const res = await get('/api/grammar/practice/sets/1').expect(200);
      await idle();
      expect(res.body.questions).toHaveLength(3);
      expect(db.sets.rows).toHaveLength(1);
    });
  });

  describe('nộp bài', () => {
    beforeEach(async () => {
      await boot();
      seedSet(1n, { status: 'in_progress', user_id: 1n });
    });
    const submit = (answers: object, extra: object = {}, c = cookie) =>
      post('/api/grammar/practice/sets/1/submit', { answers, ...extra }, c);

    it('chấm điểm, lưu kết quả + đáp án, đổi trạng thái completed, ghi buổi học', async () => {
      const res = await submit(
        { ...correctFor(1), [qid(1, 1)]: 'c' },
        { durationSeconds: 300 },
      ).expect(200);
      expect(res.body.score).toBe(2);
      expect(res.body.total).toBe(3);
      expect(res.body.results[1]).toEqual({
        questionId: 11,
        isCorrect: false,
        correctAnswer: ['b'],
      });

      expect(db.sets.rows[0]).toMatchObject({
        status: 'completed',
        score: 2,
        total: 3,
      });
      expect(db.sets.rows[0].completed_at).toBeInstanceOf(Date);
      expect(JSON.parse(String(db.sets.rows[0].answers))).toEqual({
        ...correctFor(1),
        [qid(1, 1)]: 'c',
      });
      expect(db.sessions.rows[0]).toMatchObject({
        user_id: 1n,
        type: 'grammar',
        duration_seconds: 300,
      });
    });

    it('nộp lần 2 bị từ chối 409, không ghi trùng buổi học', async () => {
      await submit(correctFor(1)).expect(200);
      await submit(correctFor(1)).expect(409);
      expect(db.sessions.rows).toHaveLength(1);
    });

    it('nộp 2 lần cùng lúc chỉ một lần thắng', async () => {
      const [a, b] = await Promise.all([
        submit(correctFor(1)),
        submit(correctFor(1)),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      expect(db.sessions.rows).toHaveLength(1);
    });

    it('người khác nộp thay: 403; bộ không tồn tại: 404', async () => {
      await submit(correctFor(1), {}, as(2)).expect(403);
      await post('/api/grammar/practice/sets/999/submit', {
        answers: {},
      }).expect(404);
      expect(db.sets.rows[0].status).toBe('in_progress');
    });

    it('bộ còn "available" (chưa nhận) không nộp được', async () => {
      seedSet(2n);
      await post('/api/grammar/practice/sets/2/submit', {
        answers: correctFor(2),
      }).expect(403);
    });

    it('thiếu câu hoặc đáp án sai kiểu: 400 và không lưu gì', async () => {
      const { [qid(1, 2)]: _omit, ...missing } = correctFor(1);
      void _omit;
      await submit(missing).expect(400);
      await submit({ ...correctFor(1), [qid(1, 0)]: 42 }).expect(400);
      await submit({ ...correctFor(1), [qid(1, 2)]: 'a' }).expect(200); // chuỗi cho câu multi hợp lệ về kiểu nhưng chấm sai
      expect(db.sessions.rows).toHaveLength(1);
    });

    it('body sai: answers không phải object, thời gian âm', async () => {
      await post('/api/grammar/practice/sets/1/submit', {
        answers: 'x',
      }).expect(400);
      await post('/api/grammar/practice/sets/1/submit', {}).expect(400);
      await submit(correctFor(1), { durationSeconds: -1 }).expect(400);
    });
  });

  describe('xem lại bộ đã làm & lịch sử', () => {
    beforeEach(() => boot());

    it('bộ đã nộp trả lại đáp án đã chọn, điểm và kết quả từng câu (không chấm lại từ đầu)', async () => {
      seedSet(1n, {
        status: 'completed',
        user_id: 1n,
        score: 2,
        total: 3,
        answers: JSON.stringify({ ...correctFor(1), [qid(1, 1)]: 'c' }),
        replenish_dispatched: true,
      });
      const res = await get('/api/grammar/practice/sets/1').expect(200);
      expect(res.body).toMatchObject({
        status: 'completed',
        score: 2,
        total: 3,
      });
      expect(res.body.answers[qid(1, 1)]).toBe('c');
      expect(
        res.body.results.map((r: { isCorrect: boolean }) => r.isCorrect),
      ).toEqual([true, false, true]);
      expect(res.body.results[1].correctAnswer).toEqual(['b']);
      expect(fetchMock).not.toHaveBeenCalled(); // xem lại không kích hoạt bù kho
    });

    it('answers hỏng trong DB không làm sập trang xem lại', async () => {
      seedSet(1n, {
        status: 'completed',
        user_id: 1n,
        score: 0,
        total: 3,
        answers: '{hong',
        replenish_dispatched: true,
      });
      const res = await get('/api/grammar/practice/sets/1').expect(200);
      expect(
        res.body.results.every((r: { isCorrect: boolean }) => !r.isCorrect),
      ).toBe(true);
    });

    it('lịch sử: chỉ bộ đã hoàn thành của user hiện tại, mới nhất trước', async () => {
      seedSet(1n, {
        status: 'completed',
        user_id: 1n,
        score: 2,
        total: 3,
        completed_at: new Date('2026-09-01T00:00:00Z'),
      });
      seedSet(2n, {
        status: 'completed',
        user_id: 1n,
        score: 3,
        total: 3,
        topic_key: 'tenses',
        completed_at: new Date('2026-09-02T00:00:00Z'),
      });
      seedSet(3n, { status: 'in_progress', user_id: 1n });
      seedSet(4n, {
        status: 'completed',
        user_id: 2n,
        score: 1,
        total: 3,
        completed_at: new Date('2026-09-03T00:00:00Z'),
      });
      const res = await get('/api/grammar/practice/history').expect(200);
      expect(res.body.items.map((i: { id: number }) => i.id)).toEqual([2, 1]);
      expect(res.body.items[0]).toMatchObject({
        topicKey: 'tenses',
        score: 3,
        total: 3,
      });
    });
  });
});
