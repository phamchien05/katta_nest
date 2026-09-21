import { PlayCounter } from './play-counter';

describe('PlayCounter', () => {
  const HOUR = 3600 * 1000;

  it('cho nghe đến hết lượt rồi từ chối, không tăng thêm khi bị từ chối', () => {
    const c = new PlayCounter();
    expect(c.consume(1n, 5, 3)).toBe(true);
    expect(c.consume(1n, 5, 3)).toBe(true);
    expect(c.consume(1n, 5, 3)).toBe(true);
    expect(c.used(1n, 5)).toBe(3);
    expect(c.consume(1n, 5, 3)).toBe(false);
    expect(c.used(1n, 5)).toBe(3);
  });

  it('đếm riêng theo từng user và từng bài', () => {
    const c = new PlayCounter();
    c.consume(1n, 5, 3);
    c.consume(1n, 5, 3);
    expect(c.used(2n, 5)).toBe(0);
    expect(c.used(1n, 6)).toBe(0);
    expect(c.used(1n, 5)).toBe(2);
  });

  it('reset đưa về 0 (làm lại bài sau khi nộp)', () => {
    const c = new PlayCounter();
    c.consume(1n, 5, 3);
    c.reset(1n, 5);
    expect(c.used(1n, 5)).toBe(0);
    c.reset(9n, 9); // reset thứ chưa có không lỗi
  });

  it('hết hạn sau 6 giờ không nghe', () => {
    const c = new PlayCounter();
    const t0 = 1_000_000;
    c.consume(1n, 5, 3, t0);
    c.consume(1n, 5, 3, t0);
    expect(c.used(1n, 5, t0 + 5 * HOUR)).toBe(2);
    expect(c.used(1n, 5, t0 + 7 * HOUR)).toBe(0);
    expect(c.consume(1n, 5, 3, t0 + 7 * HOUR)).toBe(true);
    expect(c.used(1n, 5, t0 + 7 * HOUR)).toBe(1);
  });

  it('mỗi lần nghe gia hạn thời hạn (tính từ lần nghe gần nhất)', () => {
    const c = new PlayCounter();
    const t0 = 1_000_000;
    c.consume(1n, 5, 3, t0);
    c.consume(1n, 5, 3, t0 + 5 * HOUR);
    expect(c.used(1n, 5, t0 + 10 * HOUR)).toBe(2);
  });
});

describe('PlayCounter giới hạn bộ nhớ', () => {
  it('không phình quá 10.000 mục: xoá mục hết hạn trước, rồi mục cũ nhất', () => {
    const c = new PlayCounter();
    const size = () =>
      (c as unknown as { entries: Map<string, unknown> }).entries.size;
    for (let i = 0; i < 10_000; i++) c.consume(BigInt(i), 1, 3, 1000);
    expect(size()).toBe(10_000);

    // thêm 1 mục khi tất cả vẫn còn hạn -> bỏ mục cũ nhất, kích thước không tăng
    c.consume(99_999n, 1, 3, 2000);
    expect(size()).toBe(10_000);
    expect(c.used(0n, 1, 2000)).toBe(0); // mục cũ nhất đã bị bỏ
    expect(c.used(99_999n, 1, 2000)).toBe(1);

    // sau 7 giờ, các mục đều hết hạn -> bị dọn khi có mục mới
    c.consume(100_000n, 1, 3, 1000 + 7 * 3600 * 1000);
    expect(size()).toBe(1);
  });
});
