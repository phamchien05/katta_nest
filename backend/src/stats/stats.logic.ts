// Các phép tính ngày/tuần/streak dùng chung cho Trang chủ, Thống kê, Tiến trình.
// Toàn bộ là hàm thuần (không đụng DB) để test được, và tính "ngày" theo MÚI GIỜ của người học:
// 6:30 sáng ở Việt Nam là 23:30 hôm trước theo UTC - nếu tính theo UTC thì buổi học đó bị tính nhầm sang hôm qua.

export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

export const WEEKDAY_LABELS = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
] as const;

const formatters = new Map<string, Intl.DateTimeFormat>();

// "YYYY-MM-DD" của một thời điểm, theo múi giờ cho trước (locale en-CA cho đúng định dạng này)
export function dayKey(date: Date, timeZone: string): string {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter.format(date);
}

// Cộng/trừ ngày trên khoá "YYYY-MM-DD" (tính trên lịch thuần, không dính giờ mùa hè/múi giờ)
export function shiftDay(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Thứ trong tuần kiểu Thứ 2 = 0 ... Chủ nhật = 6
function mondayIndex(key: string): number {
  return (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * Chuỗi ngày học liên tiếp (streak) tính đến hôm nay.
 * Hôm nay chưa học thì vẫn tính từ hôm qua trở về trước (không mất streak ngay trong ngày).
 */
export function calculateStreak(
  studiedDays: ReadonlySet<string>,
  todayKey: string,
): number {
  let cursor = studiedDays.has(todayKey) ? todayKey : shiftDay(todayKey, -1);
  let streak = 0;
  while (studiedDays.has(cursor)) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

export interface WeekdayCount {
  day: (typeof WEEKDAY_LABELS)[number];
  count: number;
}

// Số buổi học mỗi ngày của tuần hiện tại (Thứ 2 -> Chủ nhật), luôn đủ 7 phần tử theo đúng thứ tự
export function weeklyCounts(
  sessionDays: readonly string[],
  todayKey: string,
): WeekdayCount[] {
  const monday = shiftDay(todayKey, -mondayIndex(todayKey));
  const perDay = new Map<string, number>();
  for (const key of sessionDays) {
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  return WEEKDAY_LABELS.map((day, i) => ({
    day,
    count: perDay.get(shiftDay(monday, i)) ?? 0,
  }));
}
