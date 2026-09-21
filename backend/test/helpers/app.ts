import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';
import { FakeUser } from './fake-users';

// Khoá dùng để mã hóa key Gemini riêng của user trong test (32 byte 'k')
export const TEST_APP_KEY =
  'base64:' + Buffer.alloc(32, 'k').toString('base64');

export const TEST_ENV = {
  JWT_SECRET: 'test-secret-for-e2e-only',
  APP_KEY: TEST_APP_KEY,
  APP_TIMEZONE: 'UTC',
  // Đặt rỗng để không thừa hưởng key thật trong backend/.env - từng test tự bật khi cần
  GEMINI_API_KEY: '',
} as const;

// Dựng app Nest với DB giả thay cho Prisma thật (KHÔNG bao giờ đụng MySQL thật)
export async function bootApp(
  fakePrisma: object,
  env: Record<string, string> = {},
) {
  Object.assign(process.env, TEST_ENV, env);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(fakePrisma)
    .compile();
  const app: INestApplication<App> = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export const cookieFor = (app: INestApplication, userId: number | bigint) =>
  `katta_token=${app.get(JwtService).sign({ sub: Number(userId) })}`;

export function makeUser(id: bigint, extra: Partial<FakeUser> = {}): FakeUser {
  return {
    id,
    name: `User ${id}`,
    email: `u${id}@example.com`,
    password: 'x',
    locale: null,
    gemini_api_key: null,
    created_at: null,
    updated_at: null,
    ...extra,
  };
}
