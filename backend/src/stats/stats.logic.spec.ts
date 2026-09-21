import { calculateStreak, dayKey, shiftDay, weeklyCounts } from './stats.logic';

describe('dayKey', () => {
  it('tính ngày theo múi giờ của người học, không phải UTC', () => {
    // 18:30 UTC ngày 20 = 01:30 sáng ngày 21 ở Việt Nam
    const moment = new Date('2026-09-20T18:30:00Z');
    expect(dayKey(moment, 'UTC')).toBe('2026-09-20');
    expect(dayKey(moment, 'Asia/Ho_Chi_Minh')).toBe('2026-09-21');
  });

  it('đúng định dạng YYYY-MM-DD kể cả ngày/tháng một chữ số', () => {
    expect(dayKey(new Date('2026-01-05T12:00:00Z'), 'UTC')).toBe('2026-01-05');
  });
});

describe('shiftDay', () => {
  it('lùi/tiến qua ranh giới tháng và năm', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDay('2028-02-28', 1)).toBe('2028-02-29'); // năm nhuận
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('calculateStreak', () => {
  const days = (...d: string[]) => new Set(d);

  it('không có buổi học nào -> 0', () => {
    expect(calculateStreak(days(), '2026-09-21')).toBe(0);
  });

  it('đếm các ngày liên tiếp tính cả hôm nay', () => {
    expect(
      calculateStreak(
        days('2026-09-21', '2026-09-20', '2026-09-19'),
        '2026-09-21',
      ),
    ).toBe(3);
  });

  it('hôm nay chưa học vẫn giữ streak từ hôm qua', () => {
    expect(
      calculateStreak(days('2026-09-20', '2026-09-19'), '2026-09-21'),
    ).toBe(2);
  });

  it('bỏ lỡ hôm qua thì streak về 0 dù hôm kia có học', () => {
    expect(calculateStreak(days('2026-09-19'), '2026-09-21')).toBe(0);
  });

  it('gián đoạn giữa chừng chỉ tính đoạn liên tiếp gần nhất', () => {
    expect(
      calculateStreak(
        days('2026-09-21', '2026-09-20', '2026-09-18', '2026-09-17'),
        '2026-09-21',
      ),
    ).toBe(2);
  });

  it('vượt qua ranh giới tháng', () => {
    expect(
      calculateStreak(
        days('2026-10-01', '2026-09-30', '2026-09-29'),
        '2026-10-01',
      ),
    ).toBe(3);
  });
});

describe('weeklyCounts', () => {
  // 2026-09-21 là Thứ Hai
  it('luôn trả đủ 7 ngày Thứ 2 -> Chủ nhật, mặc định 0', () => {
    const week = weeklyCounts([], '2026-09-23');
    expect(week.map((w) => w.day)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    expect(week.every((w) => w.count === 0)).toBe(true);
  });

  it('gom đúng số buổi vào từng ngày của tuần hiện tại', () => {
    const week = weeklyCounts(
      ['2026-09-21', '2026-09-21', '2026-09-23', '2026-09-27'],
      '2026-09-23',
    );
    expect(week.map((w) => w.count)).toEqual([2, 0, 1, 0, 0, 0, 1]);
  });

  it('bỏ qua buổi học của tuần khác', () => {
    const week = weeklyCounts(
      ['2026-09-20', '2026-09-28', '2026-09-22'],
      '2026-09-23',
    );
    expect(week.map((w) => w.count)).toEqual([0, 1, 0, 0, 0, 0, 0]);
  });

  it('hôm nay là Chủ nhật vẫn thuộc tuần bắt đầu từ Thứ 2 trước đó', () => {
    const week = weeklyCounts(['2026-09-21', '2026-09-27'], '2026-09-27');
    expect(week.map((w) => w.count)).toEqual([1, 0, 0, 0, 0, 0, 1]);
  });
});
