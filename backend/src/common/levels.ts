import { NotFoundException } from '@nestjs/common';

// Kiểm tra tham số cấp độ trên URL: không thuộc danh sách cho phép -> 404 (giống abort(404) bên Laravel)
export function requireLevel<T extends string>(
  raw: string,
  allowed: readonly T[],
): T {
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new NotFoundException(`Unknown level "${raw}".`);
  }
  return raw as T;
}

// Chọn ngẫu nhiên 1 phần tử (undefined nếu mảng rỗng)
export function pickRandom<T>(
  items: readonly T[],
  random: () => number = Math.random,
): T | undefined {
  return items[Math.floor(random() * items.length)];
}
