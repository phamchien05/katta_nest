import type { FakeTable } from './fake-table';

type R = Record<string, unknown>;
type Resolver = (row: R, spec: unknown) => unknown;

// Bọc một bảng giả để hiểu `include` của Prisma: mỗi quan hệ (tên) tương ứng một hàm nối do test tự định nghĩa.
// Các hàm nối nhận `spec` (phần con của include) để lồng nhau, ví dụ include: { passages: { include: { questions: true } } }.
export function withRelations(
  table: FakeTable<R>,
  joins: Record<string, Resolver>,
) {
  return { ...table, ...bind(table, joins) };
}

export function attach(
  row: R | null,
  include: unknown,
  joins: Record<string, Resolver>,
): R | null {
  if (!row || typeof include !== 'object' || include === null) return row;
  const extra: R = {};
  for (const [name, spec] of Object.entries(include as R)) {
    if (spec && joins[name]) extra[name] = joins[name](row, spec);
  }
  return { ...row, ...extra };
}

function bind(table: FakeTable<R>, joins: Record<string, Resolver>) {
  type Args = { include?: unknown } & Record<string, unknown>;
  return {
    findMany: (args?: Args) =>
      table
        .findMany(args as never)
        .then((rows) => rows.map((r) => attach(r, args?.include, joins))),
    findFirst: (args?: Args) =>
      table
        .findFirst(args as never)
        .then((r) => attach(r, args?.include, joins)),
    findUnique: (args: Args) =>
      table
        .findUnique(args as never)
        .then((r) => attach(r, args.include, joins)),
  };
}
