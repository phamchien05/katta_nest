import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { bootApp, cookieFor, makeUser } from './helpers/app';
import { FakeTable } from './helpers/fake-table';
import { createFakeUsers, enableBigIntJson } from './helpers/fake-users';

type R = Record<string, unknown>;

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fake-but-valid-magic'),
]);

describe('Feedback (e2e)', () => {
  let app: INestApplication<App>;
  let feedback: FakeTable<R>;
  let uploadDir: string;
  let cookie: string;
  let failCreate = false;

  beforeAll(enableBigIntJson);

  beforeEach(async () => {
    uploadDir = mkdtempSync(join(tmpdir(), 'katta-upload-'));
    failCreate = false;
    const users = createFakeUsers();
    users.rows.push(makeUser(1n), makeUser(2n));
    feedback = new FakeTable<R>();
    app = await bootApp(
      {
        users: users.delegate,
        feedback: {
          ...feedback,
          create: (args: { data: R }) =>
            failCreate
              ? Promise.reject(new Error('db down'))
              : feedback.create(args),
        },
      },
      { UPLOAD_DIR: uploadDir },
    );
    cookie = cookieFor(app, 1);
  });
  afterEach(async () => {
    await app.close();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  const form = (fields: Record<string, string> = {}, c = cookie) => {
    const req = request(app.getHttpServer())
      .post('/api/feedback')
      .set('Cookie', c);
    const all = {
      category: 'bug',
      title: 'Nút bị lỗi',
      message: 'Bấm nộp bài không có phản hồi gì cả',
      ...fields,
    };
    for (const [k, v] of Object.entries(all)) req.field(k, v);
    return req;
  };
  const files = () => {
    const dir = join(uploadDir, 'feedback-screenshots');
    return existsSync(dir) ? readdirSync(dir) : [];
  };

  it('401 khi chưa đăng nhập', async () => {
    const s = request(app.getHttpServer());
    await s.get('/api/feedback').expect(401);
    await s.post('/api/feedback').expect(401);
    await s.get('/api/feedback/1/screenshot').expect(401);
  });

  describe('gửi phản hồi', () => {
    it('không kèm ảnh: lưu trạng thái pending kèm trang ngữ cảnh', async () => {
      const res = await form({ contextUrl: '/reading/5' }).expect(201);
      expect(res.body).toEqual({ id: 1 });
      expect(feedback.rows[0]).toMatchObject({
        user_id: 1n,
        category: 'bug',
        title: 'Nút bị lỗi',
        status: 'pending',
        screenshot_path: null,
        context_url: '/reading/5',
      });
      expect(files()).toEqual([]);
    });

    it('cắt khoảng trắng đầu/cuối của tiêu đề và nội dung', async () => {
      await form({
        title: '  Tiêu đề  ',
        message: '   Nội dung đủ dài để hợp lệ   ',
      }).expect(201);
      expect(feedback.rows[0]).toMatchObject({
        title: 'Tiêu đề',
        message: 'Nội dung đủ dài để hợp lệ',
      });
    });

    it('từ chối dữ liệu sai: loại lạ, tiêu đề/nội dung quá ngắn hoặc quá dài, thiếu trường', async () => {
      await form({ category: 'spam' }).expect(400);
      await form({ title: 'ab' }).expect(400);
      await form({ title: 'x'.repeat(151) }).expect(400);
      await form({ message: 'ngắn' }).expect(400);
      await form({ message: 'x'.repeat(5001) }).expect(400);
      await form({ contextUrl: 'x'.repeat(256) }).expect(400);
      await request(app.getHttpServer())
        .post('/api/feedback')
        .set('Cookie', cookie)
        .field('category', 'bug')
        .expect(400);
      expect(feedback.rows).toHaveLength(0);
    });

    it('bỏ qua field thừa: client không tự đặt được user_id/status', async () => {
      await form({ user_id: '2', status: 'resolved' }).expect(201);
      expect(feedback.rows[0]).toMatchObject({
        user_id: 1n,
        status: 'pending',
      });
    });
  });

  describe('ảnh chụp màn hình', () => {
    it('lưu ảnh hợp lệ với tên ngẫu nhiên do server đặt (không dùng tên client), đường dẫn theo định dạng Laravel', async () => {
      await form()
        .attach('screenshot', PNG, {
          filename: '../../evil.php',
          contentType: 'image/png',
        })
        .expect(201);
      const stored = String(feedback.rows[0].screenshot_path);
      expect(stored).toMatch(/^feedback-screenshots\/[0-9a-f]{40}\.png$/);
      expect(stored).not.toContain('evil');
      expect(files()).toHaveLength(1);
    });

    it('loại file được quyết định theo NỘI DUNG: file .png giả (thực ra là văn bản/HTML/SVG) bị từ chối', async () => {
      await form()
        .attach('screenshot', Buffer.from('<script>alert(1)</script>'), {
          filename: 'a.png',
          contentType: 'image/png',
        })
        .expect(400);
      await form()
        .attach(
          'screenshot',
          Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
          { filename: 'a.svg', contentType: 'image/svg+xml' },
        )
        .expect(400);
      expect(feedback.rows).toHaveLength(0);
      expect(files()).toEqual([]);
    });

    it('quá 5MB: 413 và không lưu gì', async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
      await form()
        .attach('screenshot', big, {
          filename: 'big.png',
          contentType: 'image/png',
        })
        .expect(413);
      expect(feedback.rows).toHaveLength(0);
      expect(files()).toEqual([]);
    });

    it('lưu DB lỗi thì file vừa ghi bị xoá, không để ảnh mồ côi', async () => {
      failCreate = true;
      await form()
        .attach('screenshot', PNG, {
          filename: 'a.png',
          contentType: 'image/png',
        })
        .expect(500);
      expect(files()).toEqual([]);
    });

    it('xem lại ảnh: chủ phản hồi nhận đúng nội dung, đúng Content-Type, có nosniff', async () => {
      await form()
        .attach('screenshot', PNG, {
          filename: 'a.png',
          contentType: 'image/png',
        })
        .expect(201);
      const res = await request(app.getHttpServer())
        .get('/api/feedback/1/screenshot')
        .set('Cookie', cookie)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect((res.body as Buffer).equals(PNG)).toBe(true);
    });

    it('người khác xem ảnh của bạn: 404; phản hồi không có ảnh hoặc không tồn tại: 404', async () => {
      await form()
        .attach('screenshot', PNG, {
          filename: 'a.png',
          contentType: 'image/png',
        })
        .expect(201);
      await form().expect(201); // phản hồi #2 không có ảnh
      await request(app.getHttpServer())
        .get('/api/feedback/1/screenshot')
        .set('Cookie', cookieFor(app, 2))
        .expect(404);
      await request(app.getHttpServer())
        .get('/api/feedback/2/screenshot')
        .set('Cookie', cookie)
        .expect(404);
      await request(app.getHttpServer())
        .get('/api/feedback/99/screenshot')
        .set('Cookie', cookie)
        .expect(404);
      await request(app.getHttpServer())
        .get('/api/feedback/abc/screenshot')
        .set('Cookie', cookie)
        .expect(400);
    });

    it('file đã mất khỏi ổ đĩa -> 404, không lộ đường dẫn', async () => {
      await form()
        .attach('screenshot', PNG, {
          filename: 'a.png',
          contentType: 'image/png',
        })
        .expect(201);
      rmSync(join(uploadDir, 'feedback-screenshots'), {
        recursive: true,
        force: true,
      });
      const res = await request(app.getHttpServer())
        .get('/api/feedback/1/screenshot')
        .set('Cookie', cookie)
        .expect(404);
      expect(JSON.stringify(res.body)).not.toContain(uploadDir);
    });

    it('đường dẫn trong DB thoát khỏi thư mục upload hoặc đuôi lạ bị chặn (404)', async () => {
      mkdirSync(join(uploadDir, 'feedback-screenshots'), { recursive: true });
      writeFileSync(join(uploadDir, 'secret.txt'), 'secret');
      writeFileSync(join(uploadDir, 'feedback-screenshots', 'x.svg'), '<svg/>');
      feedback.seed(
        { user_id: 1n, screenshot_path: '../secret.txt', status: 'pending' },
        {
          user_id: 1n,
          screenshot_path: 'feedback-screenshots/x.svg',
          status: 'pending',
        },
        {
          user_id: 1n,
          screenshot_path: '../../../../etc/passwd',
          status: 'pending',
        },
      );
      for (const id of [1, 2, 3]) {
        await request(app.getHttpServer())
          .get(`/api/feedback/${id}/screenshot`)
          .set('Cookie', cookie)
          .expect(404);
      }
    });
  });

  describe('lịch sử', () => {
    it('chỉ của user hiện tại, mới nhất trước, không lộ đường dẫn file', async () => {
      feedback.seed(
        {
          user_id: 1n,
          category: 'bug',
          title: 'A',
          message: 'm',
          screenshot_path: 'feedback-screenshots/a.png',
          context_url: '/x',
          status: 'pending',
          created_at: new Date('2026-09-01T00:00:00Z'),
        },
        {
          user_id: 1n,
          category: 'other',
          title: 'B',
          message: 'm',
          screenshot_path: null,
          context_url: null,
          status: 'resolved',
          created_at: new Date('2026-09-02T00:00:00Z'),
        },
        {
          user_id: 2n,
          category: 'bug',
          title: 'C',
          message: 'm',
          screenshot_path: null,
          status: 'pending',
          created_at: new Date('2026-09-03T00:00:00Z'),
        },
      );
      const res = await request(app.getHttpServer())
        .get('/api/feedback')
        .set('Cookie', cookie)
        .expect(200);
      expect(res.body.items.map((i: { title: string }) => i.title)).toEqual([
        'B',
        'A',
      ]);
      expect(res.body.items[1]).toMatchObject({
        hasScreenshot: true,
        contextUrl: '/x',
        status: 'pending',
      });
      expect(res.body.items[0]).toMatchObject({
        hasScreenshot: false,
        status: 'resolved',
      });
      expect(JSON.stringify(res.body)).not.toContain('feedback-screenshots');
    });
  });
});
