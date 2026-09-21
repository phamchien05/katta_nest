import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { createFakeUsers, enableBigIntJson } from './helpers/fake-users';

interface Vocab {
  id: bigint;
  level: string;
  word: string;
  part_of_speech: string | null;
  ipa: string | null;
  meaning_vi: string | null;
}
interface Progress {
  user_id: bigint;
  vocabulary_id: bigint;
  is_mastered: boolean;
  last_reviewed_at: Date | null;
}

// DB giả: chỉ hiểu đúng các kiểu truy vấn mà VocabularyService dùng
function createFakePrisma() {
  const users = createFakeUsers();
  const vocabularies: Vocab[] = [];
  const progress: Progress[] = [];
  const submissions: Array<Record<string, unknown>> = [];
  const sessions: Array<Record<string, unknown>> = [];

  const fake = {
    users: users.delegate,
    vocabularies: {
      findMany: ({
        where,
      }: {
        where: { level?: string; meaning_vi?: unknown; id?: { in: bigint[] } };
      }) =>
        Promise.resolve(
          vocabularies.filter(
            (v) =>
              (where.level === undefined || v.level === where.level) &&
              (where.meaning_vi === undefined || v.meaning_vi !== null) &&
              (where.id === undefined || where.id.in.includes(v.id)),
          ),
        ),
    },
    user_vocab_progress: {
      upsert: ({
        where,
        create,
        update,
      }: {
        where: {
          user_id_vocabulary_id: { user_id: bigint; vocabulary_id: bigint };
        };
        create: Progress;
        update: Partial<Progress>;
      }) => {
        const { user_id, vocabulary_id } = where.user_id_vocabulary_id;
        const existing = progress.find(
          (p) => p.user_id === user_id && p.vocabulary_id === vocabulary_id,
        );
        if (existing) Object.assign(existing, update);
        else progress.push({ ...create });
        return Promise.resolve();
      },
    },
    vocabulary_submissions: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        submissions.push(data);
        return Promise.resolve(data);
      },
    },
    study_sessions: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        sessions.push(data);
        return Promise.resolve(data);
      },
    },
    $transaction: <T>(fn: (tx: unknown) => Promise<T>) => fn(fake),
  };
  return { fake, users, vocabularies, progress, submissions, sessions };
}

describe('Vocabulary (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<typeof createFakePrisma>;
  let cookie: string;

  beforeAll(enableBigIntJson);

  const seedWords = (level: string, count: number, from = 1) => {
    for (let i = 0; i < count; i++) {
      db.vocabularies.push({
        id: BigInt(from + i),
        level,
        word: `${level}-word-${from + i}`,
        part_of_speech: 'noun',
        ipa: '/x/',
        meaning_vi: `nghĩa ${from + i} / nghĩa khác ${from + i}`,
      });
    }
  };

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-for-e2e-only';
    db = createFakePrisma();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db.fake)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    // Tạo sẵn user + cookie đăng nhập hợp lệ, không đi qua đăng ký (bcrypt cost 12 chậm, không phải thứ đang test)
    db.users.rows.push({
      id: 1n,
      name: 'An',
      email: 'an@example.com',
      password: 'x',
      locale: null,
      gemini_api_key: null,
      created_at: null,
      updated_at: null,
    });
    cookie = `katta_token=${app.get(JwtService).sign({ sub: 1 })}`;
  });

  afterEach(async () => {
    await app.close();
  });

  const get = (path: string, withCookie = true) => {
    const req = request(app.getHttpServer()).get(path);
    return withCookie ? req.set('Cookie', cookie) : req;
  };
  const submit = (level: string, body: object) =>
    request(app.getHttpServer())
      .post(`/api/vocabulary/${level}/submit`)
      .set('Cookie', cookie)
      .send(body);

  it('cần đăng nhập: không có cookie thì 401', async () => {
    await get('/api/vocabulary/A1/quiz', false).expect(401);
    await request(app.getHttpServer())
      .post('/api/vocabulary/A1/submit')
      .send({ answers: [] })
      .expect(401);
  });

  it('cấp độ không hợp lệ trả 404', async () => {
    await get('/api/vocabulary/Z9/quiz').expect(404);
    await get('/api/vocabulary/a1/quiz').expect(404);
    await submit('Z9', { answers: [{ vocabularyId: 1, answer: 'x' }] }).expect(
      404,
    );
  });

  it('liệt kê 6 cấp độ', async () => {
    const res = await get('/api/vocabulary/levels').expect(200);
    expect(res.body.levels).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });

  it('quiz: 50 từ ngẫu nhiên đúng cấp độ, không trùng, KHÔNG lộ nghĩa', async () => {
    seedWords('A1', 80);
    seedWords('B1', 10, 1000);

    const res = await get('/api/vocabulary/A1/quiz').expect(200);
    expect(res.body.level).toBe('A1');
    expect(res.body.questions).toHaveLength(50);
    const ids: number[] = res.body.questions.map((q: { id: number }) => q.id);
    expect(new Set(ids).size).toBe(50);
    expect(
      res.body.questions.every((q: { word: string }) =>
        q.word.startsWith('A1-'),
      ),
    ).toBe(true);
    expect(res.body.questions[0]).toEqual({
      id: expect.any(Number),
      word: expect.any(String),
      partOfSpeech: 'noun',
      ipa: '/x/',
    });
    expect(JSON.stringify(res.body)).not.toContain('nghĩa');
  });

  it('quiz: bỏ qua từ chưa có nghĩa tiếng Việt; kho ít hơn 50 thì trả hết', async () => {
    seedWords('A2', 5);
    db.vocabularies.push({
      id: 99n,
      level: 'A2',
      word: 'chua-dich',
      part_of_speech: null,
      ipa: null,
      meaning_vi: null,
    });

    const res = await get('/api/vocabulary/A2/quiz').expect(200);
    expect(res.body.questions).toHaveLength(5);
    expect(
      res.body.questions.map((q: { word: string }) => q.word),
    ).not.toContain('chua-dich');
  });

  it('quiz: cấp độ chưa có từ nào trả mảng rỗng', async () => {
    const res = await get('/api/vocabulary/C2/quiz').expect(200);
    expect(res.body.questions).toEqual([]);
  });

  describe('nộp bài', () => {
    beforeEach(() => seedWords('A1', 3));

    it('chấm điểm, trả kết quả chi tiết và lưu bài làm + buổi học', async () => {
      const res = await submit('A1', {
        answers: [
          { vocabularyId: 1, answer: '  NGHĨA 1 ' }, // đúng (không phân biệt hoa thường/khoảng trắng)
          { vocabularyId: 2, answer: 'nghĩa khác 2' }, // đúng (đáp án thứ hai sau dấu /)
          { vocabularyId: 3, answer: 'sai rồi' },
        ],
        durationSeconds: 95,
      }).expect(200);

      expect(res.body.score).toBe(2);
      expect(res.body.total).toBe(3);
      expect(
        res.body.results.map((r: { isCorrect: boolean }) => r.isCorrect),
      ).toEqual([true, true, false]);
      expect(res.body.results[2]).toMatchObject({
        word: 'A1-word-3',
        userAnswer: 'sai rồi',
        correctAnswer: 'nghĩa 3 / nghĩa khác 3',
      });

      // Bài làm lưu theo định dạng JSON snake_case của bản Laravel
      expect(db.submissions).toHaveLength(1);
      expect(db.submissions[0]).toMatchObject({
        user_id: 1n,
        level: 'A1',
        score: 2,
        total: 3,
      });
      const stored = JSON.parse(db.submissions[0].results as string);
      expect(stored[2]).toEqual({
        word: 'A1-word-3',
        ipa: '/x/',
        user_answer: 'sai rồi',
        correct_answer: 'nghĩa 3 / nghĩa khác 3',
        is_correct: false,
      });

      expect(db.sessions).toHaveLength(1);
      expect(db.sessions[0]).toMatchObject({
        user_id: 1n,
        type: 'vocabulary',
        duration_seconds: 95,
      });
    });

    it('từ trả lời đúng được đánh dấu đã thuộc, từ sai tạo bản ghi chưa thuộc', async () => {
      await submit('A1', {
        answers: [
          { vocabularyId: 1, answer: 'nghĩa 1' },
          { vocabularyId: 2, answer: 'sai' },
        ],
      }).expect(200);

      expect(db.progress.find((p) => p.vocabulary_id === 1n)?.is_mastered).toBe(
        true,
      );
      expect(db.progress.find((p) => p.vocabulary_id === 2n)?.is_mastered).toBe(
        false,
      );
      expect(db.progress).toHaveLength(2);
    });

    it('đã thuộc thì trả lời sai lần sau KHÔNG bị hạ xuống chưa thuộc; sai rồi đúng thì lên đã thuộc', async () => {
      await submit('A1', {
        answers: [
          { vocabularyId: 1, answer: 'nghĩa 1' },
          { vocabularyId: 2, answer: 'sai' },
        ],
      });
      await submit('A1', {
        answers: [
          { vocabularyId: 1, answer: 'sai' },
          { vocabularyId: 2, answer: 'nghĩa 2' },
        ],
      });

      expect(db.progress).toHaveLength(2);
      expect(db.progress.find((p) => p.vocabulary_id === 1n)?.is_mastered).toBe(
        true,
      );
      expect(db.progress.find((p) => p.vocabulary_id === 2n)?.is_mastered).toBe(
        true,
      );
    });

    it('câu bỏ trống hợp lệ và tính là sai', async () => {
      const res = await submit('A1', {
        answers: [{ vocabularyId: 1, answer: '' }],
      }).expect(200);
      expect(res.body.score).toBe(0);
      expect(res.body.results[0].userAnswer).toBe('');
    });

    it('thiếu durationSeconds thì ghi tối thiểu 1 giây', async () => {
      await submit('A1', {
        answers: [{ vocabularyId: 1, answer: 'x' }],
      }).expect(200);
      expect(db.sessions[0].duration_seconds).toBe(1);
    });

    it('từ chối dữ liệu sai: rỗng, sai kiểu, quá 50 câu, thời gian âm', async () => {
      await submit('A1', { answers: [] }).expect(400);
      await submit('A1', {}).expect(400);
      await submit('A1', {
        answers: [{ vocabularyId: 'abc', answer: 'x' }],
      }).expect(400);
      await submit('A1', { answers: [{ vocabularyId: 1 }] }).expect(400);
      await submit('A1', {
        answers: [{ vocabularyId: 1, answer: 'x' }],
        durationSeconds: -5,
      }).expect(400);
      const tooMany = Array.from({ length: 51 }, (_, i) => ({
        vocabularyId: i + 1,
        answer: 'x',
      }));
      await submit('A1', { answers: tooMany }).expect(400);
      expect(db.submissions).toHaveLength(0);
    });

    it('từ chối id trùng, id không tồn tại, hoặc id thuộc cấp độ khác - và không lưu gì', async () => {
      seedWords('B1', 1, 500);
      await submit('A1', {
        answers: [
          { vocabularyId: 1, answer: 'a' },
          { vocabularyId: 1, answer: 'b' },
        ],
      }).expect(400);
      await submit('A1', {
        answers: [{ vocabularyId: 9999, answer: 'a' }],
      }).expect(400);
      await submit('A1', {
        answers: [{ vocabularyId: 500, answer: 'a' }],
      }).expect(400);

      expect(db.submissions).toHaveLength(0);
      expect(db.sessions).toHaveLength(0);
      expect(db.progress).toHaveLength(0);
    });

    it('bỏ qua field thừa: client không tự đặt được điểm/user', async () => {
      const res = await submit('A1', {
        answers: [{ vocabularyId: 1, answer: 'sai', isCorrect: true }],
        score: 999,
        user_id: 42,
      }).expect(200);
      expect(res.body.score).toBe(0);
      expect(db.submissions[0]).toMatchObject({ user_id: 1n, score: 0 });
    });
  });
});
