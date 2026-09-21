import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SecretBox } from '../src/common/secret-box';
import { TranslateService } from '../src/translate/translate.service';
import { bootApp, cookieFor, makeUser, TEST_APP_KEY } from './helpers/app';
import { FakeTable } from './helpers/fake-table';
import { createFakeUsers, enableBigIntJson } from './helpers/fake-users';

type R = Record<string, unknown>;

function createDb() {
  const users = createFakeUsers();
  const passages = new FakeTable<R>();
  const submissions = new FakeTable<R>();
  const sessions = new FakeTable<R>();

  const fake = {
    users: users.delegate,
    translation_passages: passages,
    translation_submissions: {
      ...submissions,
      findMany: (args?: { include?: unknown; where?: R; orderBy?: R }) =>
        submissions.findMany(args).then((rows) =>
          args?.include
            ? rows.map((r) => ({
                ...r,
                translation_passages: passages.rows.find(
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
  return { fake, users, passages, submissions, sessions };
}

const geminiOk = (payload: unknown) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
    { status: 200 },
  );

const passage = (
  id: bigint,
  level = 'A1',
  direction = 'en_vi',
  text = `Passage ${id} lorem ipsum dolor sit amet consectetur`,
): R => ({ id, level, direction, source_text: text });

describe('Translate (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<typeof createDb>;
  let fetchMock: jest.SpyInstance;
  let cookie: string;

  beforeAll(enableBigIntJson);

  const boot = async (userExtra = {}, env: Record<string, string> = {}) => {
    db = createDb();
    db.users.rows.push(makeUser(1n, userExtra));
    db.users.rows.push(makeUser(2n));
    app = await bootApp(db.fake, env);
    cookie = cookieFor(app, 1);
  };
  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Cookie', cookie);
  const post = (path: string, body: object) =>
    request(app.getHttpServer()).post(path).set('Cookie', cookie).send(body);
  const idle = () => app.get(TranslateService).whenIdle();
  const ownKey = (key: string) =>
    new SecretBox({ get: () => TEST_APP_KEY } as never).encrypt(key);

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  describe('cần đăng nhập & kiểm tra tham số', () => {
    beforeEach(() => boot());

    it('401 khi chưa đăng nhập', async () => {
      const server = request(app.getHttpServer());
      await server.get('/api/translate/history').expect(401);
      await server.get('/api/translate/A1/passage').expect(401);
      await server
        .post('/api/translate/grade')
        .send({ passageId: 1, translation: 'x' })
        .expect(401);
    });

    it('cấp độ không hợp lệ 404 (C2 không có ở Dịch); direction sai 400', async () => {
      await get('/api/translate/C2/passage').expect(404);
      await get('/api/translate/a1/passage').expect(404);
      await get('/api/translate/A1/passage?direction=xx_yy').expect(400);
      await get('/api/translate/A1/passage?passage=abc').expect(400);
    });

    it('liệt kê 5 cấp độ', async () => {
      const res = await get('/api/translate/levels').expect(200);
      expect(res.body.levels).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
    });

    it('nộp bài: từ chối dữ liệu sai', async () => {
      await post('/api/translate/grade', { passageId: 1 }).expect(400);
      await post('/api/translate/grade', {
        passageId: 0,
        translation: 'x',
      }).expect(400);
      await post('/api/translate/grade', {
        passageId: 1,
        translation: 'x'.repeat(8001),
      }).expect(400);
      await post('/api/translate/grade', {
        passageId: 1,
        translation: 'x',
        durationSeconds: -1,
      }).expect(400);
    });
  });

  describe('lấy đoạn văn', () => {
    beforeEach(async () => {
      await boot();
      db.passages.seed(
        passage(1n, 'A1', 'en_vi'),
        passage(2n, 'A1', 'en_vi'),
        passage(3n, 'A1', 'vi_en'),
        passage(4n, 'B1', 'en_vi'),
      );
    });

    it('chỉ trả đoạn đúng cấp độ và chiều dịch (mặc định en_vi)', async () => {
      for (let i = 0; i < 10; i++) {
        const { passage: p } = (await get('/api/translate/A1/passage')).body;
        expect(['1', '2']).toContain(String(p.id));
        expect(p).toMatchObject({ level: 'A1', direction: 'en_vi' });
      }
      const viEn = await get('/api/translate/A1/passage?direction=vi_en');
      expect(viEn.body.passage.id).toBe(3);
    });

    it('không có đoạn nào trong kho thì trả passage: null', async () => {
      const res = await get('/api/translate/C1/passage').expect(200);
      expect(res.body.passage).toBeNull();
    });

    it('ưu tiên đoạn user chưa làm; user khác đã làm không ảnh hưởng', async () => {
      db.submissions.seed(
        { user_id: 1n, passage_id: 1n },
        { user_id: 2n, passage_id: 2n },
      );
      for (let i = 0; i < 10; i++) {
        expect((await get('/api/translate/A1/passage')).body.passage.id).toBe(
          2,
        );
      }
    });

    it('làm hết rồi thì random lại toàn bộ (vẫn có đoạn)', async () => {
      db.submissions.seed(
        { user_id: 1n, passage_id: 1n },
        { user_id: 1n, passage_id: 2n },
      );
      const res = await get('/api/translate/A1/passage').expect(200);
      expect([1, 2]).toContain(res.body.passage.id);
    });

    it('"đoạn khác": loại đoạn đang xem ra', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await get('/api/translate/A1/passage?exclude=1');
        expect(res.body.passage.id).toBe(2);
      }
    });

    it('"dịch lại" đúng đoạn được chỉ định; sai cấp độ/chiều thì bỏ qua và random', async () => {
      const exact = await get('/api/translate/A1/passage?passage=2');
      expect(exact.body.passage.id).toBe(2);

      // đoạn 4 thuộc B1 -> không hợp lệ cho A1 -> random trong kho A1 en_vi
      const wrongLevel = await get('/api/translate/A1/passage?passage=4');
      expect([1, 2]).toContain(wrongLevel.body.passage.id);
      // đoạn 3 thuộc vi_en -> không hợp lệ cho en_vi
      const wrongDir = await get(
        '/api/translate/A1/passage?passage=3&direction=en_vi',
      );
      expect([1, 2]).toContain(wrongDir.body.passage.id);
    });
  });

  describe('kho tự bù (chạy ngầm, không chặn request)', () => {
    it('lấy 1 đoạn thì sinh thêm 1 đoạn mới vào kho, dùng key riêng của user', async () => {
      await boot({ gemini_api_key: ownKey('USER-OWN-KEY') });
      db.passages.seed(passage(1n));
      fetchMock.mockResolvedValue(
        geminiOk(['  An entirely new generated passage.  ']),
      );

      await get('/api/translate/A1/passage').expect(200);
      await idle();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.headers as R)['x-goog-api-key']).toBe('USER-OWN-KEY');
      expect(
        String(JSON.parse(init.body as string).contents[0].parts[0].text),
      ).toContain('CEFR A1');

      expect(db.passages.rows).toHaveLength(2);
      expect(db.passages.rows[1]).toMatchObject({
        level: 'A1',
        direction: 'en_vi',
        source_text: 'An entirely new generated passage.', // đã trim
      });
    });

    it('không có key nào (riêng lẫn chung) thì không gọi Gemini', async () => {
      await boot();
      db.passages.seed(passage(1n));
      await get('/api/translate/A1/passage').expect(200);
      await idle();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(db.passages.rows).toHaveLength(1);
    });

    it('dùng key chung khi user không có key riêng', async () => {
      await boot({}, { GEMINI_API_KEY: 'SHARED-KEY' });
      db.passages.seed(passage(1n));
      fetchMock.mockResolvedValue(geminiOk(['New one']));
      await get('/api/translate/A1/passage').expect(200);
      await idle();
      expect(
        ((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as R)[
          'x-goog-api-key'
        ],
      ).toBe('SHARED-KEY');
    });

    it('Gemini lỗi thì người dùng vẫn nhận đoạn bình thường, kho không đổi', async () => {
      await boot({}, { GEMINI_API_KEY: 'SHARED-KEY' });
      db.passages.seed(passage(1n));
      fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

      const res = await get('/api/translate/A1/passage').expect(200);
      await idle();
      expect(fetchMock).toHaveBeenCalledTimes(1); // đã thật sự thử gọi Gemini
      expect(res.body.passage.id).toBe(1);
      expect(db.passages.rows).toHaveLength(1);
    });

    it('bỏ qua đoạn rỗng mà Gemini trả về', async () => {
      await boot({}, { GEMINI_API_KEY: 'SHARED-KEY' });
      db.passages.seed(passage(1n));
      fetchMock.mockResolvedValue(geminiOk(['   ', '']));
      await get('/api/translate/A1/passage').expect(200);
      await idle();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(db.passages.rows).toHaveLength(1);
    });
  });

  describe('chấm điểm', () => {
    const SRC = 'one two three four five six seven eight nine ten'; // 10 từ

    beforeEach(async () => {
      await boot();
      db.passages.seed(passage(1n, 'A1', 'en_vi', SRC));
    });

    it('AI chấm: trả điểm/nhận xét/bản dịch mẫu/lỗi, lưu bài làm + buổi học', async () => {
      process.env.GEMINI_API_KEY = 'SHARED-KEY';
      fetchMock.mockResolvedValue(
        geminiOk({
          score: 85,
          feedback: 'Tốt lắm.',
          reference_translation: 'Một hai ba',
          issues: ['"hai" sai', '', 'lỗi khác'],
        }),
      );

      const res = await post('/api/translate/grade', {
        passageId: 1,
        translation: '  một hai ba  ',
        durationSeconds: 120,
      }).expect(200);

      expect(res.body).toMatchObject({
        score: 85,
        feedback: 'Tốt lắm.',
        referenceTranslation: 'Một hai ba',
        issues: ['"hai" sai', 'lỗi khác'], // bỏ chuỗi rỗng
        gradedBy: 'ai',
      });
      const prompt = String(
        JSON.parse(
          (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
        ).contents[0].parts[0].text,
      );
      expect(prompt).toContain('tiếng Anh-tiếng Việt');
      expect(prompt).toContain(SRC);
      expect(prompt).toContain('một hai ba');

      expect(db.submissions.rows).toHaveLength(1);
      expect(db.submissions.rows[0]).toMatchObject({
        user_id: 1n,
        passage_id: 1n,
        user_translation: 'một hai ba',
        ai_score: 85,
        ai_feedback: 'Tốt lắm.',
      });
      expect(db.sessions.rows[0]).toMatchObject({
        user_id: 1n,
        type: 'translate',
        duration_seconds: 120,
      });
    });

    it('điểm Gemini ngoài khoảng 0-100 bị kẹp lại', async () => {
      process.env.GEMINI_API_KEY = 'k';
      fetchMock.mockResolvedValueOnce(
        geminiOk({
          score: 250,
          feedback: '',
          reference_translation: '',
          issues: [],
        }),
      );
      expect(
        (await post('/api/translate/grade', { passageId: 1, translation: 'x' }))
          .body.score,
      ).toBe(100);

      fetchMock.mockResolvedValueOnce(
        geminiOk({
          score: -5,
          feedback: '',
          reference_translation: '',
          issues: [],
        }),
      );
      expect(
        (await post('/api/translate/grade', { passageId: 1, translation: 'x' }))
          .body.score,
      ).toBe(0);
    });

    it('chiều vi_en: prompt đảo ngôn ngữ', async () => {
      db.passages.seed(passage(9n, 'A1', 'vi_en', 'xin chào'));
      process.env.GEMINI_API_KEY = 'k';
      fetchMock.mockResolvedValue(
        geminiOk({
          score: 50,
          feedback: '',
          reference_translation: '',
          issues: [],
        }),
      );
      await post('/api/translate/grade', {
        passageId: 9,
        translation: 'hello',
      }).expect(200);
      const prompt = String(
        JSON.parse(
          (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
        ).contents[0].parts[0].text,
      );
      expect(prompt).toContain('tiếng Việt-tiếng Anh');
    });

    it('không có key: chấm tạm theo độ dài (tối đa 70), không gọi Gemini', async () => {
      const half = await post('/api/translate/grade', {
        passageId: 1,
        translation: 'một hai ba bốn năm', // 5/10 từ
      }).expect(200);
      expect(half.body).toMatchObject({
        score: 35,
        gradedBy: 'simple',
        feedback: null,
      });

      const full = await post('/api/translate/grade', {
        passageId: 1,
        translation: 'a b c d e f g h i j k l m n', // dài hơn gốc: kẹp ở 70
      });
      expect(full.body.score).toBe(70);
      expect(fetchMock).not.toHaveBeenCalled();
      // vẫn lưu lại bài (ai_feedback có thông báo để trang khác đọc được)
      expect(db.submissions.rows).toHaveLength(2);
      expect(String(db.submissions.rows[0].ai_feedback)).toContain(
        'not configured',
      );
    });

    it('Gemini lỗi hoặc trả sai định dạng: rơi về chấm đơn giản, không mất bài làm', async () => {
      process.env.GEMINI_API_KEY = 'k';
      fetchMock.mockResolvedValueOnce(new Response('x', { status: 500 }));
      const failed = await post('/api/translate/grade', {
        passageId: 1,
        translation: 'một hai',
      }).expect(200);
      expect(failed.body.gradedBy).toBe('simple');

      fetchMock.mockResolvedValueOnce(geminiOk({ feedback: 'thiếu score' }));
      const malformed = await post('/api/translate/grade', {
        passageId: 1,
        translation: 'một hai',
      }).expect(200);
      expect(malformed.body.gradedBy).toBe('simple');
      expect(db.submissions.rows).toHaveLength(2);
    });

    it('đoạn không tồn tại: 404 và không lưu gì', async () => {
      await post('/api/translate/grade', {
        passageId: 999,
        translation: 'x',
      }).expect(404);
      expect(db.submissions.rows).toHaveLength(0);
      expect(db.sessions.rows).toHaveLength(0);
    });

    it('bản dịch chỉ toàn khoảng trắng bị từ chối', async () => {
      await post('/api/translate/grade', {
        passageId: 1,
        translation: '   ',
      }).expect(400);
      expect(db.submissions.rows).toHaveLength(0);
    });
  });

  describe('lịch sử "Đã dịch"', () => {
    beforeEach(() => boot());

    it('chỉ của user hiện tại, mới nhất trước, kèm cấp độ/chiều/đoạn gốc', async () => {
      db.passages.seed(
        passage(1n, 'A1', 'en_vi', 'first'),
        passage(2n, 'B1', 'vi_en', 'second'),
      );
      db.submissions.seed(
        {
          user_id: 1n,
          passage_id: 1n,
          ai_score: 60,
          created_at: new Date('2026-09-01T00:00:00Z'),
        },
        {
          user_id: 1n,
          passage_id: 2n,
          ai_score: 90,
          created_at: new Date('2026-09-02T00:00:00Z'),
        },
        {
          user_id: 2n,
          passage_id: 1n,
          ai_score: 10,
          created_at: new Date('2026-09-03T00:00:00Z'),
        },
      );

      const res = await get('/api/translate/history').expect(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0]).toMatchObject({
        passageId: 2,
        score: 90,
        level: 'B1',
        direction: 'vi_en',
        sourceText: 'second',
      });
      expect(res.body.items[1].passageId).toBe(1);
      expect(JSON.stringify(res.body)).not.toContain('user_translation');
    });

    it('chưa làm gì thì rỗng', async () => {
      const res = await get('/api/translate/history').expect(200);
      expect(res.body.items).toEqual([]);
    });
  });
});
