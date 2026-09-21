import { pickRandom } from './levels';

interface PickOptions {
  // Các bài user đã nộp
  attempted: Iterable<bigint>;
  // Các bài user vừa lấy ra xem trong phiên (dù chưa nộp) - do trình duyệt ghi nhớ vì API không có session
  seen: readonly number[];
  // Bài đang xem - luôn tránh nếu còn bài khác
  excludeId?: number;
  random?: () => number;
}

// Chọn ngẫu nhiên 1 bài trong kho, ưu tiên bài chưa nộp và chưa xem. Xem hết rồi thì random trừ bài đang xem,
// cuối cùng (chỉ còn đúng bài đang xem) mới random toàn bộ. Kho rỗng thì undefined.
export function choosePassageId(
  ids: readonly bigint[],
  { attempted, seen, excludeId, random }: PickOptions,
): bigint | undefined {
  const current = excludeId ? BigInt(excludeId) : null;
  const excluded = new Set<bigint>([...attempted, ...seen.map(BigInt)]);
  if (current !== null) excluded.add(current);

  return (
    pickRandom(
      ids.filter((id) => !excluded.has(id)),
      random,
    ) ??
    pickRandom(
      ids.filter((id) => id !== current),
      random,
    ) ??
    pickRandom(ids, random)
  );
}
