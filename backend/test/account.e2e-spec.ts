import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { SecretBox } from '../src/common/secret-box';
import { bootApp, cookieFor, makeUser, TEST_APP_KEY } from './helpers/app';
import { FakeTable } from './helpers/fake-table';
import { createFakeUsers, enableBigIntJson } from './helpers/fake-users';

type R = Record<string, unknown>;

// Băm nhanh (cost 4) cho các user dựng sẵn - việc đổi/kiểm tra mật khẩu vẫn chạy qua bcrypt thật
const HASH = bcrypt.hashSync('old-password', 4);

describe('Account & Settings (e2e)', () => {
  let app: INestApplication<App>;
  let users: ReturnType<typeof createFakeUsers>;
  let sets: FakeTable<R>;
  let feedback: FakeTable<R>;
  let uploadDir: string;
  let cookie: string;

  beforeAll(enableBigIntJson);

  const boot = async (env: Record<string, string> = {}) => {
    users = createFakeUsers();
    users.rows.push(
      makeUser(1n, {
        name: 'An',
        email: 'an@example.com',
        password: HASH,
        locale: 'en',
      }),
      makeUser(2n, { name: 'Bình', email: 'binh@example.com', password: HASH }),
    );
    sets = new FakeTable<R>();
    feedback = new FakeTable<R>();
    uploadDir = mkdtempSync(join(tmpdir(), 'katta-acct-'));
    const fake = {
      users: users.delegate,
      grammar_question_sets: sets,
      feedback,
      $transaction: <T>(fn: (tx: unknown) => Promise<T>) => fn(fake),
    };
    app = await bootApp(fake, { UPLOAD_DIR: uploadDir, ...env });
    cookie = cookieFor(app, 1);
  };
  afterEach(async () => {
    await app.close();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  const call = (
    method: 'get' | 'put' | 'patch' | 'delete',
    path: string,
    body?: object,
    c = cookie,
  ) => {
    const req = request(app.getHttpServer())[method](path).set('Cookie', c);
    return body ? req.send(body) : req;
  };
  const me = () => users.rows.find((u) => u.id === 1n)!;
  const box = () => new SecretBox({ get: () => TEST_APP_KEY } as never);

  describe('cài đặt', () => {
    beforeEach(() => boot());

    it('401 khi chưa đăng nhập', async () => {
      const s = request(app.getHttpServer());
      await s.get('/api/settings').expect(401);
      await s.put('/api/settings').send({ locale: 'vi' }).expect(401);
      await s.delete('/api/settings/gemini-key').expect(401);
      await s.patch('/api/account/profile').send({}).expect(401);
      await s.put('/api/account/password').send({}).expect(401);
      await s.delete('/api/account').send({}).expect(401);
    });

    it('đọc cài đặt: ngôn ngữ và cờ có key riêng, KHÔNG bao giờ trả key', async () => {
      me().gemini_api_key = box().encrypt('AIza-real-secret-key');
      const res = await call('get', '/api/settings').expect(200);
      expect(res.body).toEqual({ locale: 'en', hasOwnGeminiKey: true });
      expect(JSON.stringify(res.body)).not.toContain('AIza');
    });

    it('lưu ngôn ngữ; để trống key thì giữ nguyên key cũ', async () => {
      const before = box().encrypt('AIza-old-key-123');
      me().gemini_api_key = before;
      const res = await call('put', '/api/settings', {
        locale: 'vi',
        geminiApiKey: '',
      }).expect(200);
      expect(res.body).toEqual({ locale: 'vi', hasOwnGeminiKey: true });
      expect(me().locale).toBe('vi');
      expect(me().gemini_api_key).toBe(before);

      await call('put', '/api/settings', { locale: 'en' }).expect(200); // không gửi key
      expect(me().gemini_api_key).toBe(before);
    });

    it('lưu key mới: mã hóa trong DB (không lưu chữ thường), giải mã lại ra đúng, phản hồi không lộ key', async () => {
      const res = await call('put', '/api/settings', {
        locale: 'en',
        geminiApiKey: '  AIza-brand-new-key  ',
      }).expect(200);
      expect(res.body).toEqual({ locale: 'en', hasOwnGeminiKey: true });
      expect(JSON.stringify(res.body)).not.toContain('AIza');

      const stored = String(me().gemini_api_key);
      expect(stored).not.toContain('AIza');
      expect(box().decrypt(stored)).toBe('AIza-brand-new-key'); // đã cắt khoảng trắng
    });

    it('key quá ngắn / quá dài / ngôn ngữ lạ: 400 và không đổi gì', async () => {
      await call('put', '/api/settings', {
        locale: 'vi',
        geminiApiKey: 'short',
      }).expect(400);
      await call('put', '/api/settings', {
        locale: 'vi',
        geminiApiKey: 'x'.repeat(256),
      }).expect(400);
      await call('put', '/api/settings', { locale: 'fr' }).expect(400);
      await call('put', '/api/settings', {}).expect(400);
      expect(me().locale).toBe('en');
      expect(me().gemini_api_key).toBeNull();
    });

    it('xoá key riêng', async () => {
      me().gemini_api_key = box().encrypt('AIza-old-key-123');
      const res = await call('delete', '/api/settings/gemini-key').expect(200);
      expect(res.body).toEqual({ locale: 'en', hasOwnGeminiKey: false });
      expect(me().gemini_api_key).toBeNull();
    });

    it('bỏ qua field thừa: không tự đặt được password/email qua cài đặt', async () => {
      await call('put', '/api/settings', {
        locale: 'vi',
        password: 'hacked',
        email: 'x@y.z',
      }).expect(200);
      expect(me().password).toBe(HASH);
      expect(me().email).toBe('an@example.com');
    });

    it('server thiếu APP_KEY: lưu ngôn ngữ vẫn được nhưng lưu key trả 503 và không ghi gì', async () => {
      await app.close();
      await boot({ APP_KEY: '' });
      await call('put', '/api/settings', {
        locale: 'vi',
        geminiApiKey: 'AIza-some-long-key',
      }).expect(503);
      expect(me().gemini_api_key).toBeNull();
      await call('put', '/api/settings', { locale: 'vi' }).expect(200);
      expect(me().locale).toBe('vi');
    });
  });

  describe('hồ sơ', () => {
    beforeEach(() => boot());

    it('đổi tên và email (email được chuyển chữ thường, cắt khoảng trắng); không lộ mật khẩu', async () => {
      const res = await call('patch', '/api/account/profile', {
        name: '  An Nguyễn ',
        email: '  AN.New@Example.com ',
      }).expect(200);
      expect(res.body).toMatchObject({
        id: 1,
        name: 'An Nguyễn',
        email: 'an.new@example.com',
      });
      expect(JSON.stringify(res.body)).not.toContain('password');
      expect(me()).toMatchObject({
        name: 'An Nguyễn',
        email: 'an.new@example.com',
      });
    });

    it('giữ nguyên email của chính mình thì hợp lệ (kể cả khác hoa/thường)', async () => {
      await call('patch', '/api/account/profile', {
        name: 'An 2',
        email: 'AN@example.com',
      }).expect(200);
      expect(me().name).toBe('An 2');
    });

    it('email đã có người khác dùng: 409; không đổi gì', async () => {
      await call('patch', '/api/account/profile', {
        name: 'An',
        email: 'Binh@example.com',
      }).expect(409);
      expect(me().email).toBe('an@example.com');
    });

    it('dữ liệu sai: email sai định dạng, tên rỗng/quá dài -> 400', async () => {
      await call('patch', '/api/account/profile', {
        name: 'An',
        email: 'khong-phai-email',
      }).expect(400);
      await call('patch', '/api/account/profile', {
        name: '   ',
        email: 'an@example.com',
      }).expect(400);
      await call('patch', '/api/account/profile', {
        name: 'x'.repeat(256),
        email: 'an@example.com',
      }).expect(400);
      await call('patch', '/api/account/profile', {
        email: 'an@example.com',
      }).expect(400);
    });
  });

  describe('đổi mật khẩu', () => {
    beforeEach(() => boot());

    it('đúng mật khẩu hiện tại: đổi được, mật khẩu mới là bcrypt và đăng nhập được, mật khẩu cũ hết hiệu lực', async () => {
      await call('put', '/api/account/password', {
        currentPassword: 'old-password',
        password: 'brand-new-pass',
      }).expect(204);
      expect(me().password).toMatch(/^\$2[aby]\$12\$/);
      expect(bcrypt.compareSync('brand-new-pass', String(me().password))).toBe(
        true,
      );

      const server = request(app.getHttpServer());
      await server
        .post('/api/auth/login')
        .send({ email: 'an@example.com', password: 'brand-new-pass' })
        .expect(200);
      await server
        .post('/api/auth/login')
        .send({ email: 'an@example.com', password: 'old-password' })
        .expect(401);
    });

    it('sai mật khẩu hiện tại: 401 và không đổi', async () => {
      await call('put', '/api/account/password', {
        currentPassword: 'wrong-guess',
        password: 'brand-new-pass',
      }).expect(401);
      expect(me().password).toBe(HASH);
    });

    it('mật khẩu mới quá ngắn/quá dài hoặc thiếu trường: 400', async () => {
      await call('put', '/api/account/password', {
        currentPassword: 'old-password',
        password: 'short',
      }).expect(400);
      await call('put', '/api/account/password', {
        currentPassword: 'old-password',
        password: 'x'.repeat(73),
      }).expect(400);
      await call('put', '/api/account/password', {
        password: 'brand-new-pass',
      }).expect(400);
      expect(me().password).toBe(HASH);
    });
  });

  describe('xoá tài khoản', () => {
    beforeEach(() => boot());

    it('sai mật khẩu: 401, tài khoản còn nguyên', async () => {
      await call('delete', '/api/account', { password: 'nope-nope' }).expect(
        401,
      );
      expect(users.rows).toHaveLength(2);
    });

    it('thiếu mật khẩu: 400', async () => {
      await call('delete', '/api/account', {}).expect(400);
      expect(users.rows).toHaveLength(2);
    });

    it('đúng mật khẩu: xoá tài khoản và xoá cookie đăng nhập; chỉ xoá đúng tài khoản của mình', async () => {
      const res = await call('delete', '/api/account', {
        password: 'old-password',
      }).expect(204);
      expect(users.rows.map((u) => u.id)).toEqual([2n]);
      expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(
        /katta_token=;/,
      );
      // token cũ không còn dùng được vì user đã mất
      await call('get', '/api/settings').expect(401);
    });

    it('bộ đề ngữ pháp: bộ đang làm dở trả về kho, bộ đã xong bị xoá, bộ của người khác giữ nguyên', async () => {
      sets.seed(
        {
          id: 1n,
          user_id: 1n,
          status: 'in_progress',
          topic_key: 'tenses',
          started_at: new Date(),
          replenish_dispatched: true,
        },
        {
          id: 2n,
          user_id: 1n,
          status: 'completed',
          topic_key: 'tenses',
          score: 3,
        },
        { id: 3n, user_id: 2n, status: 'in_progress', topic_key: 'tenses' },
        { id: 4n, user_id: null, status: 'available', topic_key: 'tenses' },
      );
      await call('delete', '/api/account', { password: 'old-password' }).expect(
        204,
      );

      expect(sets.rows.map((s) => s.id)).toEqual([1n, 3n, 4n]); // bộ #2 đã xoá
      expect(sets.rows[0]).toMatchObject({
        status: 'available',
        user_id: null,
        started_at: null,
        replenish_dispatched: false,
      });
      expect(sets.rows[1]).toMatchObject({
        status: 'in_progress',
        user_id: 2n,
      });
    });

    it('xoá luôn các file ảnh chụp màn hình của user (không để ảnh mồ côi), giữ ảnh của người khác', async () => {
      const dir = join(uploadDir, 'feedback-screenshots');
      mkdirSync(dir, { recursive: true });
      for (const f of ['mine1.png', 'mine2.png', 'theirs.png'])
        writeFileSync(join(dir, f), 'x');
      writeFileSync(join(uploadDir, 'outside.txt'), 'giữ nguyên');
      feedback.seed(
        { user_id: 1n, screenshot_path: 'feedback-screenshots/mine1.png' },
        { user_id: 1n, screenshot_path: 'feedback-screenshots/mine2.png' },
        { user_id: 1n, screenshot_path: null },
        { user_id: 1n, screenshot_path: '../outside.txt' }, // đường dẫn thoát thư mục: không được đụng tới
        { user_id: 2n, screenshot_path: 'feedback-screenshots/theirs.png' },
      );

      await call('delete', '/api/account', { password: 'old-password' }).expect(
        204,
      );

      expect(existsSync(join(dir, 'mine1.png'))).toBe(false);
      expect(existsSync(join(dir, 'mine2.png'))).toBe(false);
      expect(existsSync(join(dir, 'theirs.png'))).toBe(true);
      expect(existsSync(join(uploadDir, 'outside.txt'))).toBe(true);
    });

    it('sai mật khẩu thì không xoá ảnh', async () => {
      const dir = join(uploadDir, 'feedback-screenshots');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'mine1.png'), 'x');
      feedback.seed({
        user_id: 1n,
        screenshot_path: 'feedback-screenshots/mine1.png',
      });
      await call('delete', '/api/account', { password: 'nope-nope' }).expect(
        401,
      );
      expect(existsSync(join(dir, 'mine1.png'))).toBe(true);
    });
  });
});
