import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

// Kiểm thử luồng đăng nhập (mục Đăng nhập/Tài khoản) - dùng DB giả trong bộ nhớ nên KHÔNG bao giờ
// đụng tới database MySQL thật.
interface FakeUser {
  id: bigint;
  name: string;
  email: string;
  password: string;
  locale: string | null;
  gemini_api_key: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

function createFakePrisma() {
  const rows: FakeUser[] = [];
  let nextId = 1n;
  return {
    rows,
    users: {
      findUnique: ({ where }: { where: { email?: string; id?: bigint } }) =>
        Promise.resolve(
          rows.find((u) => (where.email !== undefined ? u.email === where.email : u.id === where.id)) ?? null,
        ),
      create: ({ data }: { data: Pick<FakeUser, 'name' | 'email' | 'password' | 'created_at' | 'updated_at'> }) => {
        const user: FakeUser = { id: nextId++, locale: null, gemini_api_key: null, ...data };
        rows.push(user);
        return Promise.resolve(user);
      },
    },
  };
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let fake: ReturnType<typeof createFakePrisma>;

  beforeAll(() => {
    (BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
      return Number(this);
    };
  });

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-for-e2e-only';
    fake = createFakePrisma();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fake)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const register = (body: object) => request(app.getHttpServer()).post('/api/auth/register').send(body);
  const cookieOf = (res: request.Response): string => {
    const header = res.headers['set-cookie'] as unknown as string[] | undefined;
    return (header ?? []).map((c) => c.split(';')[0]).join('; ');
  };

  it('đăng ký hợp lệ: tạo user, set cookie httpOnly, không lộ mật khẩu', async () => {
    const res = await register({ name: 'An', email: 'An@Example.com', password: 'secret123' }).expect(201);

    expect(res.body).toEqual({ id: 1, name: 'An', email: 'an@example.com', locale: null, hasOwnGeminiKey: false });
    expect(JSON.stringify(res.body)).not.toContain('password');
    expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(/katta_token=.+HttpOnly/i);
    // mật khẩu lưu dạng bcrypt, không phải chữ thường
    expect(fake.rows[0].password).toMatch(/^\$2[aby]\$12\$/);
  });

  it('đăng ký: từ chối dữ liệu sai (email sai, mật khẩu ngắn)', async () => {
    await register({ name: 'An', email: 'khong-phai-email', password: '123' }).expect(400);
    expect(fake.rows).toHaveLength(0);
  });

  it('đăng ký: bỏ qua field thừa (không cho client tự đặt gemini_api_key/id)', async () => {
    await register({ name: 'An', email: 'an@example.com', password: 'secret123', gemini_api_key: 'hack', id: 99 }).expect(201);
    expect(fake.rows[0].gemini_api_key).toBeNull();
    expect(fake.rows[0].id).toBe(1n);
  });

  it('đăng ký: trùng email trả 409', async () => {
    await register({ name: 'An', email: 'an@example.com', password: 'secret123' }).expect(201);
    await register({ name: 'An 2', email: 'AN@example.com', password: 'secret123' }).expect(409);
  });

  it('đăng nhập đúng / sai mật khẩu / email không tồn tại', async () => {
    await register({ name: 'An', email: 'an@example.com', password: 'secret123' });
    const agent = () => request(app.getHttpServer()).post('/api/auth/login');

    await agent().send({ email: 'an@example.com', password: 'secret123' }).expect(200);
    const wrongPass = await agent().send({ email: 'an@example.com', password: 'sai-sai-sai' }).expect(401);
    const noUser = await agent().send({ email: 'khong-co@example.com', password: 'secret123' }).expect(401);
    // không lộ email nào đã đăng ký: cùng 1 thông báo cho cả hai trường hợp
    expect(wrongPass.body.message).toBe(noUser.body.message);
  });

  it('user cũ từ bản Laravel (hash $2y$) đăng nhập được', async () => {
    // hash do PHP password_hash('secret123', PASSWORD_BCRYPT, cost 12) sinh ra - tiền tố $2y$ của Laravel
    const laravelHash = bcrypt.hashSync('secret123', 12).replace(/^\$2b\$/, '$2y$');
    fake.rows.push({
      id: 7n, name: 'Cũ', email: 'cu@example.com', password: laravelHash,
      locale: 'vi', gemini_api_key: 'x', created_at: null, updated_at: null,
    });

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'cu@example.com', password: 'secret123' })
      .expect(200);
    expect(res.body).toMatchObject({ id: 7, locale: 'vi', hasOwnGeminiKey: true });
    // key thật không bao giờ được trả ra ngoài, chỉ báo "có/không"
    expect(JSON.stringify(res.body)).not.toContain('"x"');
  });

  it('GET /auth/me: 401 khi chưa đăng nhập, 200 khi có cookie', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);

    const res = await register({ name: 'An', email: 'an@example.com', password: 'secret123' });
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookieOf(res)).expect(200);
    expect(me.body.email).toBe('an@example.com');
  });

  it('GET /auth/me: token giả/hỏng bị từ chối', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', 'katta_token=khong.phai.jwt').expect(401);
  });

  it('đăng xuất xoá cookie', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
    expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(/katta_token=;/);
  });
});
