import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const MAX_FAILURES = 5;
const WINDOW_MS = 60_000;
const MAX_ENTRIES = 10_000;

interface Entry {
  failures: number;
  windowEnd: number;
}

// Chặn dò mật khẩu: sau 5 lần đăng nhập SAI trong 1 phút với cùng (email, IP) thì khoá đến hết phút đó - giống RateLimiter
// của bản Laravel. Đăng nhập đúng thì xoá bộ đếm. Giữ trong bộ nhớ (khởi động lại server chỉ làm bộ đếm về 0).
@Injectable()
export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();

  static key(email: string, ip: string | undefined): string {
    return `${email.trim().toLowerCase()}|${ip ?? 'unknown'}`;
  }

  // Ném 429 kèm số giây phải chờ nếu đã bị khoá
  assertAllowed(key: string, now = Date.now()): void {
    const entry = this.live(key, now);
    if (entry && entry.failures >= MAX_FAILURES) {
      const seconds = Math.max(1, Math.ceil((entry.windowEnd - now) / 1000));
      throw new HttpException(
        `Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau ${seconds} giây.`,
        HttpStatus.TOO_MANY_REQUESTS,
        { cause: { retryAfterSeconds: seconds } },
      );
    }
  }

  recordFailure(key: string, now = Date.now()): void {
    const entry = this.live(key, now);
    if (entry) {
      entry.failures++;
      return;
    }
    if (this.entries.size >= MAX_ENTRIES) this.purge(now);
    this.entries.set(key, { failures: 1, windowEnd: now + WINDOW_MS });
  }

  clear(key: string): void {
    this.entries.delete(key);
  }

  // Bản ghi còn trong cửa sổ 1 phút (hết hạn thì bỏ)
  private live(key: string, now: number): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry && entry.windowEnd <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  private purge(now: number): void {
    for (const [k, e] of this.entries) {
      if (e.windowEnd <= now) this.entries.delete(k);
    }
    for (const k of this.entries.keys()) {
      if (this.entries.size < MAX_ENTRIES) break;
      this.entries.delete(k);
    }
  }
}
