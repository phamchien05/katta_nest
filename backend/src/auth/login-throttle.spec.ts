import { HttpException } from '@nestjs/common';
import { LoginThrottle } from './login-throttle';

describe('LoginThrottle', () => {
  const T0 = 1_000_000;
  const fail = (t: LoginThrottle, key: string, n: number, at = T0) => {
    for (let i = 0; i < n; i++) t.recordFailure(key, at);
  };

  it('cho phép tới 5 lần sai; lần thứ 6 bị chặn 429 kèm số giây chờ', () => {
    const t = new LoginThrottle();
    fail(t, 'a|1', 4);
    expect(() => t.assertAllowed('a|1', T0)).not.toThrow();
    fail(t, 'a|1', 1);

    let error: HttpException | undefined;
    try {
      t.assertAllowed('a|1', T0 + 10_000);
    } catch (e) {
      error = e as HttpException;
    }
    expect(error?.getStatus()).toBe(429);
    expect(error?.message).toContain('50 giây');
  });

  it('hết 1 phút thì được thử lại và bộ đếm bắt đầu lại từ 0', () => {
    const t = new LoginThrottle();
    fail(t, 'a|1', 5);
    expect(() => t.assertAllowed('a|1', T0 + 59_000)).toThrow();
    expect(() => t.assertAllowed('a|1', T0 + 60_000)).not.toThrow();
    t.recordFailure('a|1', T0 + 61_000);
    fail(t, 'a|1', 3, T0 + 61_000);
    expect(() => t.assertAllowed('a|1', T0 + 62_000)).not.toThrow(); // mới 4 lần
  });

  it('đăng nhập đúng xoá bộ đếm', () => {
    const t = new LoginThrottle();
    fail(t, 'a|1', 4);
    t.clear('a|1');
    fail(t, 'a|1', 4);
    expect(() => t.assertAllowed('a|1', T0)).not.toThrow();
  });

  it('đếm riêng theo từng cặp (email, IP): người khác không bị vạ lây', () => {
    const t = new LoginThrottle();
    fail(t, 'a|1', 5);
    expect(() => t.assertAllowed('a|1', T0)).toThrow();
    expect(() => t.assertAllowed('a|2', T0)).not.toThrow(); // cùng email, IP khác
    expect(() => t.assertAllowed('b|1', T0)).not.toThrow(); // email khác, cùng IP
  });

  it('key chuẩn hoá email (hoa/thường, khoảng trắng) và IP thiếu', () => {
    expect(LoginThrottle.key('  An@Example.COM ', '1.2.3.4')).toBe(
      'an@example.com|1.2.3.4',
    );
    expect(LoginThrottle.key('a@b.c', undefined)).toBe('a@b.c|unknown');
  });

  it('không phình bộ nhớ quá 10.000 mục', () => {
    const t = new LoginThrottle();
    for (let i = 0; i < 10_000; i++) t.recordFailure(`k${i}`, T0);
    t.recordFailure('new', T0 + 1);
    expect(
      (t as unknown as { entries: Map<string, unknown> }).entries.size,
    ).toBeLessThanOrEqual(10_000);
    // sau khi hết hạn thì dọn sạch
    t.recordFailure('later', T0 + 120_000);
    expect(
      (t as unknown as { entries: Map<string, unknown> }).entries.size,
    ).toBeLessThanOrEqual(10_000);
  });
});
