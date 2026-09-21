import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { bootApp, cookieFor, makeUser } from './helpers/app';
import { FakeTable } from './helpers/fake-table';
import { createFakeUsers, enableBigIntJson } from './helpers/fake-users';
import { withRelations } from './helpers/relations';

type R = Record<string, unknown>;

function createDb() {
  const users = createFakeUsers();
  const vocabSubs = new FakeTable<R>();
  const sets = new FakeTable<R>();
  const setQuestions = new FakeTable<R>();
  const readingPassages = new FakeTable<R>();
  const readingQuestions = new FakeTable<R>();
  const readingSubs = new FakeTable<R>();
  const listeningPassages = new FakeTable<R>();
  const listeningQuestions = new FakeTable<R>();
  const listeningSubs = new FakeTable<R>();
  const translationPassages = new FakeTable<R>();
  const translationSubs = new FakeTable<R>();

  const questionsOf = (table: FakeTable<R>, passageId: unknown) =>
    table.rows
      .filter((q) => q.passage_id === passageId)
      .sort((a, b) => Number(a.order) - Number(b.order));
  const passageJoin =
    (passages: FakeTable<R>, questions: FakeTable<R>, qName: string) =>
    (row: R, spec: unknown) => {
      const p = passages.rows.find((x) => x.id === row.passage_id);
      const nested = (spec as { include?: R }).include;
      return p && nested?.[qName]
        ? { ...p, [qName]: questionsOf(questions, p.id) }
        : p;
    };

  const fake = {
    users: users.delegate,
    vocabulary_submissions: vocabSubs,
    grammar_question_sets: withRelations(sets, {
      grammar_questions: (row) =>
        setQuestions.rows
          .filter((q) => q.set_id === row.id)
          .sort((a, b) => Number(a.order) - Number(b.order)),
    }),
    reading_submissions: withRelations(readingSubs, {
      reading_passages: passageJoin(
        readingPassages,
        readingQuestions,
        'reading_questions',
      ),
    }),
    listening_submissions: withRelations(listeningSubs, {
      listening_passages: passageJoin(
        listeningPassages,
        listeningQuestions,
        'listening_questions',
      ),
    }),
    translation_submissions: withRelations(translationSubs, {
      translation_passages: (row) =>
        translationPassages.rows.find((p) => p.id === row.passage_id),
    }),
  };
  return {
    fake,
    users,
    vocabSubs,
    sets,
    setQuestions,
    readingPassages,
    readingQuestions,
    readingSubs,
    listeningPassages,
    listeningQuestions,
    listeningSubs,
    translationPassages,
    translationSubs,
  };
}

describe('Progress (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<typeof createDb>;
  let cookie: string;

  beforeAll(enableBigIntJson);
  beforeEach(async () => {
    db = createDb();
    db.users.rows.push(makeUser(1n), makeUser(2n));
    app = await bootApp(db.fake);
    cookie = cookieFor(app, 1);
  });
  afterEach(() => app.close());

  const get = (path: string, c = cookie) =>
    request(app.getHttpServer()).get(path).set('Cookie', c);

  const day = (d: number) =>
    new Date(`2026-09-${String(d).padStart(2, '0')}T10:00:00Z`);

  // Một bài đọc/nghe có 2 câu (fill + multi) để kiểm tra định dạng đáp án
  const seedPassage = (
    passages: FakeTable<R>,
    questions: FakeTable<R>,
    id: bigint,
    title: string,
  ) => {
    passages.seed({ id, topic: 't', title });
    questions.seed(
      {
        id: id * 10n,
        passage_id: id,
        type: 'fill',
        question: `${title} Q0`,
        options: '[]',
        correct_answer: '["sun"]',
        order: 0,
      },
      {
        id: id * 10n + 1n,
        passage_id: id,
        type: 'multi',
        question: `${title} Q1`,
        options: '["a","b","c"]',
        correct_answer: '["a","c"]',
        order: 1,
      },
    );
  };

  it('401 khi chưa đăng nhập', async () => {
    await request(app.getHttpServer()).get('/api/progress').expect(401);
    await request(app.getHttpServer())
      .get('/api/progress/reading/1')
      .expect(401);
  });

  describe('danh sách', () => {
    it('chưa làm gì thì rỗng', async () => {
      expect((await get('/api/progress').expect(200)).body.items).toEqual([]);
    });

    it('gộp cả 5 loại, mới nhất trước, đúng trường của từng loại; không lẫn dữ liệu user khác', async () => {
      seedPassage(db.readingPassages, db.readingQuestions, 1n, 'Solar Power');
      seedPassage(
        db.listeningPassages,
        db.listeningQuestions,
        2n,
        'Hotel Call',
      );
      db.translationPassages.seed({
        id: 3n,
        level: 'B1',
        direction: 'en_vi',
        source_text: 'src',
      });

      db.vocabSubs.seed(
        {
          id: 1n,
          user_id: 1n,
          level: 'A2',
          score: 30,
          total: 50,
          results: '[]',
          created_at: day(1),
        },
        {
          id: 2n,
          user_id: 2n,
          level: 'A1',
          score: 1,
          total: 50,
          results: '[]',
          created_at: day(9),
        },
      );
      db.sets.seed(
        {
          id: 1n,
          user_id: 1n,
          status: 'completed',
          topic_key: 'tenses',
          score: 20,
          total: 35,
          completed_at: day(2),
        },
        {
          id: 2n,
          user_id: 1n,
          status: 'in_progress',
          topic_key: 'tenses',
          score: null,
          total: null,
          completed_at: null,
        },
      );
      db.readingSubs.seed({
        id: 1n,
        user_id: 1n,
        passage_id: 1n,
        score: 4,
        total: 5,
        answers: '{}',
        created_at: day(3),
      });
      db.listeningSubs.seed({
        id: 1n,
        user_id: 1n,
        passage_id: 2n,
        score: 2,
        total: 5,
        answers: '{}',
        created_at: day(4),
      });
      db.translationSubs.seed({
        id: 1n,
        user_id: 1n,
        passage_id: 3n,
        user_translation: 'x',
        ai_score: 85,
        ai_feedback: 'ok',
        created_at: day(5),
      });

      const res = await get('/api/progress').expect(200);
      const items = res.body.items as R[];

      expect(items.map((i) => i.type)).toEqual([
        'translate',
        'listening',
        'reading',
        'grammar',
        'vocabulary',
      ]);
      expect(items[0]).toMatchObject({ level: 'B1', score: 85, total: 100 });
      expect(items[1]).toMatchObject({
        title: 'Hotel Call',
        score: 2,
        total: 5,
      });
      expect(items[2]).toMatchObject({
        title: 'Solar Power',
        score: 4,
        total: 5,
      });
      expect(items[3]).toMatchObject({
        topicKey: 'tenses',
        score: 20,
        total: 35,
      });
      expect(items[4]).toMatchObject({ level: 'A2', score: 30, total: 50 });
      // danh sách chỉ có tóm tắt, không kèm câu trả lời/bản dịch
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('user_translation');
      expect(text).not.toContain('"x"');
    });

    it('bài dịch chưa có điểm tính 0; thiếu ngày không làm sập việc sắp xếp', async () => {
      db.translationPassages.seed({
        id: 3n,
        level: 'A1',
        direction: 'en_vi',
        source_text: 's',
      });
      db.translationSubs.seed({
        id: 1n,
        user_id: 1n,
        passage_id: 3n,
        user_translation: 'x',
        ai_score: null,
        ai_feedback: null,
        created_at: null,
      });
      db.vocabSubs.seed({
        id: 1n,
        user_id: 1n,
        level: 'A1',
        score: 1,
        total: 2,
        results: '[]',
        created_at: day(1),
      });
      const items = (await get('/api/progress').expect(200)).body.items as R[];
      expect(items.map((i) => i.type)).toEqual(['vocabulary', 'translate']);
      expect(items[1]).toMatchObject({ score: 0, total: 100, date: null });
    });
  });

  describe('chi tiết', () => {
    it('từ vựng: đọc kết quả JSON lưu theo định dạng Laravel, kèm phiên âm', async () => {
      db.vocabSubs.seed({
        id: 1n,
        user_id: 1n,
        level: 'A1',
        score: 1,
        total: 2,
        created_at: day(1),
        results: JSON.stringify([
          {
            word: 'sun',
            ipa: '/sʌn/',
            user_answer: 'mặt trời',
            correct_answer: 'mặt trời',
            is_correct: true,
          },
          {
            word: 'moon',
            ipa: null,
            user_answer: '',
            correct_answer: 'mặt trăng',
            is_correct: false,
          },
        ]),
      });
      const res = await get('/api/progress/vocabulary/1').expect(200);
      expect(res.body).toEqual({
        kind: 'qa',
        items: [
          {
            question: 'sun [/sʌn/]',
            userAnswer: 'mặt trời',
            correctAnswer: 'mặt trời',
            isCorrect: true,
          },
          {
            question: 'moon',
            userAnswer: '',
            correctAnswer: 'mặt trăng',
            isCorrect: false,
          },
        ],
      });
    });

    it('đọc hiểu / nghe: chấm lại theo loại câu, multi hiển thị gộp bằng dấu phẩy', async () => {
      seedPassage(db.readingPassages, db.readingQuestions, 1n, 'Solar');
      seedPassage(db.listeningPassages, db.listeningQuestions, 2n, 'Hotel');
      db.readingSubs.seed({
        id: 1n,
        user_id: 1n,
        passage_id: 1n,
        score: 1,
        total: 2,
        created_at: day(1),
        answers: JSON.stringify({ '10': 'SUN', '11': ['c', 'a'] }),
      });
      db.listeningSubs.seed({
        id: 1n,
        user_id: 1n,
        passage_id: 2n,
        score: 0,
        total: 2,
        created_at: day(1),
        answers: JSON.stringify({ '20': 'moon', '21': ['a'] }),
      });

      const reading = await get('/api/progress/reading/1').expect(200);
      expect(reading.body.items).toEqual([
        {
          question: 'Solar Q0',
          userAnswer: 'SUN',
          correctAnswer: 'sun',
          isCorrect: true,
        },
        {
          question: 'Solar Q1',
          userAnswer: 'c, a',
          correctAnswer: 'a, c',
          isCorrect: true,
        },
      ]);
      const listening = await get('/api/progress/listening/1').expect(200);
      expect(
        listening.body.items.map((i: { isCorrect: boolean }) => i.isCorrect),
      ).toEqual([false, false]);
      expect(listening.body.items[1]).toMatchObject({
        userAnswer: 'a',
        correctAnswer: 'a, c',
      });
    });

    it('câu không có đáp án lưu lại (hoặc JSON hỏng) hiển thị rỗng và tính sai, không sập', async () => {
      seedPassage(db.readingPassages, db.readingQuestions, 1n, 'Solar');
      db.readingSubs.seed({
        id: 1n,
        user_id: 1n,
        passage_id: 1n,
        score: 0,
        total: 2,
        created_at: day(1),
        answers: '{hong',
      });
      const res = await get('/api/progress/reading/1').expect(200);
      expect(
        res.body.items.every(
          (i: { userAnswer: string; isCorrect: boolean }) =>
            i.userAnswer === '' && !i.isCorrect,
        ),
      ).toBe(true);
    });

    it('ngữ pháp: chỉ bộ đã hoàn thành; bộ đang làm là 404', async () => {
      db.sets.seed(
        {
          id: 1n,
          user_id: 1n,
          status: 'completed',
          topic_key: 'tenses',
          score: 1,
          total: 1,
          completed_at: day(1),
          answers: JSON.stringify({ '5': 'is' }),
        },
        { id: 2n, user_id: 1n, status: 'in_progress', topic_key: 'tenses' },
      );
      db.setQuestions.seed({
        id: 5n,
        set_id: 1n,
        type: 'fill',
        question: 'She ___ happy.',
        options: '[]',
        correct_answer: '["is"]',
        order: 0,
      });
      const ok = await get('/api/progress/grammar/1').expect(200);
      expect(ok.body.items).toEqual([
        {
          question: 'She ___ happy.',
          userAnswer: 'is',
          correctAnswer: 'is',
          isCorrect: true,
        },
      ]);
      await get('/api/progress/grammar/2').expect(404);
    });

    it('dịch: bài gốc, bản dịch và nhận xét', async () => {
      db.translationPassages.seed({
        id: 3n,
        level: 'B1',
        direction: 'en_vi',
        source_text: 'Hello world',
      });
      db.translationSubs.seed({
        id: 1n,
        user_id: 1n,
        passage_id: 3n,
        user_translation: 'Xin chào',
        ai_score: 90,
        ai_feedback: 'Tốt',
        created_at: day(1),
      });
      const res = await get('/api/progress/translate/1').expect(200);
      expect(res.body).toEqual({
        kind: 'translate',
        sourceText: 'Hello world',
        userTranslation: 'Xin chào',
        feedback: 'Tốt',
      });
    });

    it('bài của người khác, id không tồn tại: 404; loại lạ 404; id không phải số 400', async () => {
      seedPassage(db.readingPassages, db.readingQuestions, 1n, 'Solar');
      db.readingSubs.seed({
        id: 1n,
        user_id: 2n,
        passage_id: 1n,
        score: 1,
        total: 2,
        answers: '{}',
        created_at: day(1),
      });
      db.vocabSubs.seed({
        id: 1n,
        user_id: 2n,
        level: 'A1',
        score: 1,
        total: 1,
        results: '[]',
        created_at: day(1),
      });
      await get('/api/progress/reading/1').expect(404);
      await get('/api/progress/vocabulary/1').expect(404);
      await get('/api/progress/reading/999').expect(404);
      await get('/api/progress/essay/1').expect(404);
      await get('/api/progress/reading/abc').expect(400);
    });
  });
});
