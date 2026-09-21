import { Injectable } from '@nestjs/common';

const TTL_MS = 6 * 60 * 60 * 1000; // sau 6 giờ không nghe thì coi như bắt đầu lượt mới
const MAX_ENTRIES = 10_000;

interface Entry {
  used: number;
  expiresAt: number;
}

// Đếm số lượt nghe của (user, bài) TRÊN SERVER nên không sửa được qua devtools, và tải lại trang không được thêm lượt
// (bản Laravel đếm theo từng lần mở trang nên tải lại là được nghe lại). Giữ trong bộ nhớ: khởi động lại server chỉ
// làm lượt nghe được đặt lại, không ảnh hưởng dữ liệu nào.
@Injectable()
export class PlayCounter {
  private readonly entries = new Map<string, Entry>();

  private key(userId: bigint, passageId: number): string {
    return `${userId}:${passageId}`;
  }

  used(userId: bigint, passageId: number, now = Date.now()): number {
    const entry = this.entries.get(this.key(userId, passageId));
    return entry && entry.expiresAt > now ? entry.used : 0;
  }

  // Tăng lượt nghe nếu còn; trả false (không tăng) khi đã hết
  consume(
    userId: bigint,
    passageId: number,
    max: number,
    now = Date.now(),
  ): boolean {
    const used = this.used(userId, passageId, now);
    if (used >= max) return false;

    if (this.entries.size >= MAX_ENTRIES) this.purge(now);
    this.entries.set(this.key(userId, passageId), {
      used: used + 1,
      expiresAt: now + TTL_MS,
    });
    return true;
  }

  // Nộp bài xong thì lượt sau (làm lại bài) bắt đầu từ đầu
  reset(userId: bigint, passageId: number): void {
    this.entries.delete(this.key(userId, passageId));
  }

  private purge(now: number): void {
    for (const [k, e] of this.entries) {
      if (e.expiresAt <= now) this.entries.delete(k);
    }
    // Vẫn đầy (hiếm) thì bỏ các mục cũ nhất (Map giữ thứ tự thêm vào) để bộ nhớ không phình vô hạn
    for (const key of this.entries.keys()) {
      if (this.entries.size < MAX_ENTRIES) break;
      this.entries.delete(key);
    }
  }
}
