import request from 'supertest';

// Phần DB giả (trong bộ nhớ) dùng chung cho các bài e2e cần đăng nhập - KHÔNG bao giờ đụng tới MySQL thật.
export interface FakeUser {
  id: bigint;
  name: string;
  email: string;
  password: string;
  locale: string | null;
  gemini_api_key: string | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export function createFakeUsers() {
  const rows: FakeUser[] = [];
  let nextId = 1n;
  return {
    rows,
    delegate: {
      findUnique: ({ where }: { where: { email?: string; id?: bigint } }) =>
        Promise.resolve(
          rows.find((u) =>
            where.email !== undefined
              ? u.email === where.email
              : u.id === where.id,
          ) ?? null,
        ),
      create: ({
        data,
      }: {
        data: Pick<
          FakeUser,
          'name' | 'email' | 'password' | 'created_at' | 'updated_at'
        >;
      }) => {
        const user: FakeUser = {
          id: nextId++,
          locale: null,
          gemini_api_key: null,
          ...data,
        };
        rows.push(user);
        return Promise.resolve(user);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: bigint };
        data: Partial<FakeUser>;
      }) => {
        const user = rows.find((u) => u.id === where.id);
        if (!user) return Promise.reject(new Error('fake users: not found'));
        Object.assign(
          user,
          Object.fromEntries(
            Object.entries(data).filter(([, v]) => v !== undefined),
          ),
        );
        return Promise.resolve(user);
      },
      delete: ({ where }: { where: { id: bigint } }) => {
        const i = rows.findIndex((u) => u.id === where.id);
        if (i < 0) return Promise.reject(new Error('fake users: not found'));
        return Promise.resolve(rows.splice(i, 1)[0]);
      },
    },
  };
}

// Giống main.ts: BigInt không tự chuyển được sang JSON
export function enableBigIntJson() {
  (BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (
    this: bigint,
  ) {
    return Number(this);
  };
}

// Gom các cookie Set-Cookie của 1 response thành chuỗi header "Cookie" để gửi kèm request sau
export function cookieOf(res: request.Response): string {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return (header ?? []).map((c) => c.split(';')[0]).join('; ');
}
